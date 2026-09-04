import { createHash, randomUUID } from "node:crypto";
import {
  roundStateSchema,
  turnDecisionSchema,
  type AnswerObject,
  type AnswerAttribute,
  type BroadQuestionTopic,
  type ChildIntent,
  type ClassifiedTurn,
  type CreateRoundRequest,
  type CreateRoundResponse,
  type RoundState,
  type ThinkGuessLanguage,
  type TurnDecision,
  classifiedTurnSchema,
} from "@shared/thinkGuess";
import { THINK_GUESS_ANSWERS } from "./content";
import type { ThinkGuessAnalytics } from "./analytics";
import type { RoundLookup, RoundRepository } from "./repository";
import type { TurnClassifier } from "./classifier";
import {
  OpenAIThinkGuessResponseWriter,
  PassthroughResponseWriter,
  type ConversationOutcome,
  type SupportStage,
  type ThinkGuessConversationTurn,
  type ThinkGuessResponseWriter,
} from "./thinkGuessPrompt";

function defaultResponseWriter(): ThinkGuessResponseWriter {
  return process.env.THINK_GUESS_ENABLE_AI_RESPONSES === "false"
    ? new PassthroughResponseWriter()
    : new OpenAIThinkGuessResponseWriter();
}

const ROUND_TTL_MS = 30 * 60 * 1000;
const REASONING_TURN_LIMIT = 10;
const REASONING_INTENTS = new Set<ChildIntent>([
  "question",
  "direct_guess",
  "request_hint",
]);

type ResponseWriterOutcome =
  | "accepted"
  | "deterministic"
  | "error_fallback"
  | "rejected_empty"
  | "rejected_too_long"
  | "rejected_secret_leak"
  | "rejected_answer_removed"
  | "rejected_not_speakable";

function replyIsSpeakable(
  reply: string,
  language: ThinkGuessLanguage,
  isCompletion: boolean,
): boolean {
  const questionCount = reply.match(/[?？]/g)?.length ?? 0;
  if (questionCount > 1) return false;
  if (
    /our clue collection says|what would you like to find out next|which kind of clue should we investigate/i.test(
      reply,
    )
  ) {
    return false;
  }
  const spokenUnits =
    language === "zh"
      ? [...reply.replace(/\s/g, "")].length
      : reply.trim().split(/\s+/).filter(Boolean).length;
  const limit = isCompletion
    ? language === "zh"
      ? 130
      : 80
    : language === "zh"
      ? 90
      : 55;
  return spokenUnits <= limit;
}

function replyFingerprint(reply: string): string {
  return createHash("sha256").update(reply).digest("hex").slice(0, 12);
}

function speechConfidenceBucket(
  speechConfidence?: number,
): "low" | "medium" | "high" | undefined {
  if (speechConfidence === undefined) return undefined;
  if (speechConfidence < 0.5) return "low";
  if (speechConfidence < 0.8) return "medium";
  return "high";
}

function responseLatencyBucket(
  responseLatency: number,
): "fast" | "normal" | "slow" {
  if (responseLatency < 800) return "fast";
  if (responseLatency < 2_000) return "normal";
  return "slow";
}

const categoryNames: Record<
  ThinkGuessLanguage,
  Record<AnswerObject["category"], string>
> = {
  en: {
    animal: "an animal",
    food: "some food",
    toy: "a toy",
    home: "a home object",
    transport: "a vehicle",
    fairy_tale: "a fairy-tale object",
  },
  zh: {
    animal: "一种动物",
    food: "一种食物",
    toy: "一个玩具",
    home: "一个家里的东西",
    transport: "一种交通工具",
    fairy_tale: "一个童话里的东西",
  },
  es: {
    animal: "un animal",
    food: "una comida",
    toy: "un juguete",
    home: "un objeto de casa",
    transport: "un vehículo",
    fairy_tale: "un objeto de cuento",
  },
};

const broadQuestionSuggestions: Record<
  ThinkGuessLanguage,
  Record<BroadQuestionTopic, string>
> = {
  en: {
    color: "Try asking, ‘What colour is it?’",
    appearance: "Try asking, ‘What does it look like?’",
    action: "Try asking, ‘What does it do?’",
    location: "Try asking, ‘Where might I find it?’",
    category: "Try asking, ‘What kind of thing is it?’",
  },
  zh: {
    color: "试着问：“它是什么颜色？”",
    appearance: "试着问：“它长什么样？”",
    action: "试着问：“它会做什么？”",
    location: "试着问：“在哪里能找到它？”",
    category: "试着问：“它是什么种类？”",
  },
  es: {
    color: "Prueba a preguntar: «¿De qué color es?»",
    appearance: "Prueba a preguntar: «¿Cómo es?»",
    action: "Prueba a preguntar: «¿Qué hace?»",
    location: "Prueba a preguntar: «¿Dónde puedo encontrarlo?»",
    category: "Prueba a preguntar: «¿Qué tipo de cosa es?»",
  },
};

const copy = {
  en: {
    opening: (category?: string) =>
      category
        ? `I am thinking of ${category}. Ask me a question.`
        : "I am thinking of something. Ask me a question.",
    yes: "Yes!",
    no: "Not this time!",
    wrong: (guess: string) =>
      `Not this time—it is not ${guess}. Now we can cross that idea off!`,
    unknown: (suggestion: string) => `I do not have that clue. ${suggestion}`,
    questionAnswer: (fact: string, turn: number) =>
      `${fact} ${["That helps!", "Nice clue!", "We can use that!"][turn % 3]}`,
    broadAnswer: (fact: string, turn: number) =>
      `${fact} ${["Handy clue!", "That helps!", "Now we know more!"][turn % 3]}`,
    repeat: (reply: string) => `Sure. ${reply}`,
    unclear: "My owl ears missed that. Could you say it once more?",
    dontKnow:
      "That is okay. Try one easy question: “What kind of thing is it?”",
    offTopic: "Hehe, silly one! Let us hop back to the mystery.",
    coach: "Let us use one clue to narrow it down.",
    strategy: "Let us start easy: find out what kind of thing it is.",
    discover: (base: string) => base,
    connect: (base: string, clue: string) =>
      clue ? `${base} That fits with this clue: ${clue}` : base,
    coachProgress: (base: string, hint: string) =>
      `${base} Here is one more clue: ${hint}`,
    narrow: (base: string, choices: string) =>
      `${base} One last choice: ${choices}`,
    turnLimitReveal: (answer: string, clues: string) =>
      `The answer is ${answer}! ${clues ? `This clue helped us: ${clues}` : "Every question narrowed the mystery."} Nice thinking!`,
    choices: (items: string[]) =>
      `Is it ${items[0]}, ${items[1]}, or ${items[2]}?`,
    revealLocked: (remaining: number) =>
      `Let us try ${remaining} more ${remaining === 1 ? "clue" : "clues"} together first.`,
    revealed: (answer: string) =>
      `The answer is ${answer}. Nice thinking—you used the clues to learn something new!`,
    solved: (answer: string) =>
      `Yes! It is ${answer}. You used questions and clues to work it out!`,
    stopped: "Of course! We can stop now. Thanks for playing with me!",
    alreadyDone: "This round is finished. Start a new mystery to play again.",
  },
  zh: {
    opening: (category?: string) =>
      category
        ? `我想的是${category}。问我一个问题吧。`
        : "我在想一样东西。问我一个问题吧。",
    yes: "是的！",
    no: "这次不是哦！",
    wrong: (guess: string) => `这次不是${guess}。我们又排除了一个可能！`,
    unknown: (suggestion: string) => `我还没有这条线索。${suggestion}`,
    questionAnswer: (fact: string, turn: number) =>
      `${fact}${["这很有帮助！", "好线索！", "这条能用上！"][turn % 3]}`,
    broadAnswer: (fact: string, turn: number) =>
      `${fact}${["好线索！", "这很有帮助！", "我们又知道了一点！"][turn % 3]}`,
    repeat: (reply: string) => `好的。${reply}`,
    unclear: "我的猫头鹰耳朵没听清楚。可以再说一次吗？",
    dontKnow: "没关系。试一个简单问题：“它是什么种类？”",
    offTopic: "嘿嘿，真有趣！我们回到谜题吧。",
    coach: "我们用一条线索来缩小范围吧。",
    strategy: "我们先从它是什么种类开始。",
    discover: (base: string) => base,
    connect: (base: string, clue: string) =>
      clue ? `${base}这和之前的线索很搭：${clue}` : base,
    coachProgress: (base: string, hint: string) =>
      `${base}再给你一条线索：${hint}`,
    narrow: (base: string, choices: string) => `${base}最后选一次：${choices}`,
    turnLimitReveal: (answer: string, clues: string) =>
      `答案是${answer}！${clues ? `这条线索很有帮助：${clues}` : "每一个问题都缩小了范围。"}你想得真认真！`,
    choices: (items: string[]) =>
      `它是${items[0]}、${items[1]}，还是${items[2]}？`,
    revealLocked: (remaining: number) =>
      `你做得很棒！我们先一起再试${remaining}个线索吧。`,
    revealed: (answer: string) =>
      `答案是${answer}。你认真思考，也用线索学到了新东西！`,
    solved: (answer: string) =>
      `答对了！是${answer}。你用问题和线索找到了答案！`,
    stopped: "当然可以！我们现在停下来。谢谢你陪我玩！",
    alreadyDone: "这一轮已经结束了。开始一个新谜题再玩吧。",
  },
  es: {
    opening: (category?: string) =>
      category
        ? `Estoy pensando en ${category}. Hazme una pregunta.`
        : "Estoy pensando en algo. Hazme una pregunta.",
    yes: "¡Sí!",
    no: "¡Esta vez no!",
    wrong: (guess: string) =>
      `Esta vez no es ${guess}. ¡Ya descartamos una posibilidad!`,
    unknown: (suggestion: string) => `No tengo esa pista. ${suggestion}`,
    questionAnswer: (fact: string, turn: number) =>
      `${fact} ${["¡Eso ayuda!", "¡Buena pista!", "¡Podemos usarla!"][turn % 3]}`,
    broadAnswer: (fact: string, turn: number) =>
      `${fact} ${["¡Pista útil!", "¡Eso ayuda!", "¡Ahora sabemos más!"][turn % 3]}`,
    repeat: (reply: string) => `Claro. ${reply}`,
    unclear: "Mis orejas de búho no lo oyeron bien. ¿Puedes repetirlo?",
    dontKnow:
      "No pasa nada. Prueba una pregunta fácil: «¿Qué tipo de cosa es?»",
    offTopic: "Je, je, ¡qué idea tan divertida! Volvamos al misterio.",
    coach: "Usemos una pista para reducir las opciones.",
    strategy: "Empecemos por descubrir qué tipo de cosa es.",
    discover: (base: string) => base,
    connect: (base: string, clue: string) =>
      clue ? `${base} Encaja con esta pista: ${clue}` : base,
    coachProgress: (base: string, hint: string) =>
      `${base} Aquí tienes otra pista: ${hint}`,
    narrow: (base: string, choices: string) =>
      `${base} Una última elección: ${choices}`,
    turnLimitReveal: (answer: string, clues: string) =>
      `¡La respuesta es ${answer}! ${clues ? `Esta pista nos ayudó: ${clues}` : "Cada pregunta redujo el misterio."} ¡Pensaste muy bien!`,
    choices: (items: string[]) => `¿Es ${items[0]}, ${items[1]} o ${items[2]}?`,
    revealLocked: (remaining: number) =>
      `¡Lo estás haciendo genial! Probemos juntos ${remaining} ${remaining === 1 ? "pista más" : "pistas más"} primero.`,
    revealed: (answer: string) =>
      `La respuesta es ${answer}. ¡Pensaste bien y usaste las pistas para aprender algo nuevo!`,
    solved: (answer: string) =>
      `¡Sí! Es ${answer}. ¡Usaste preguntas y pistas para descubrirlo!`,
    stopped: "¡Claro! Podemos parar ahora. ¡Gracias por jugar conmigo!",
    alreadyDone:
      "Esta ronda terminó. Empieza otro misterio para jugar de nuevo.",
  },
} satisfies Record<ThinkGuessLanguage, Record<string, unknown>>;

const attributeReplies: Record<
  ThinkGuessLanguage,
  Partial<Record<keyof AnswerObject["attributes"], [string, string]>>
> = {
  en: {
    alive: ["Yes, it is alive.", "No, it is not alive."],
    animal: ["Yes, it is an animal.", "No, it is not an animal."],
    edible: ["Yes, you can eat it.", "No, you cannot eat it."],
    big: ["Yes, it is big.", "No, it is not big."],
    small: ["Yes, it is small.", "No, it is not small."],
    flies: ["Yes, it can fly.", "No, it cannot fly."],
    swims: ["Yes, it can swim.", "No, it cannot swim."],
    four_legs: ["Yes, it has four legs.", "No, it does not have four legs."],
    has_wings: ["Yes, it has wings.", "No, it does not have wings."],
    has_trunk: ["Yes, it has a trunk.", "No, it does not have a trunk."],
    has_wheels: ["Yes, it has wheels.", "No, it does not have wheels."],
    red: ["Yes, it can be red.", "No, it is not red."],
    yellow: ["Yes, it can be yellow.", "No, it is not yellow."],
    green: ["Yes, it can be green.", "No, it is not green."],
    orange: ["Yes, it is orange.", "No, it is not orange."],
    round: ["Yes, it is round.", "No, it is not round."],
    soft: ["Yes, it is soft.", "No, it is not soft."],
    crunchy: ["Yes, it is crunchy.", "No, it is not crunchy."],
    used_at_home: [
      "Yes, you can find it at home.",
      "No, you do not usually find it at home.",
    ],
    from_a_story: [
      "Yes, it appears in a story.",
      "No, it is not from a story.",
    ],
    magical: ["Yes, it is magical.", "No, it is not magical."],
  },
  zh: {
    alive: ["是的，它是活的。", "不是，它不是活的。"],
    animal: ["是的，它是动物。", "不是，它不是动物。"],
    edible: ["是的，它可以吃。", "不，它不能吃。"],
    big: ["是的，它很大。", "不，它不大。"],
    small: ["是的，它很小。", "不，它不小。"],
    flies: ["是的，它会飞。", "不，它不会飞。"],
    swims: ["是的，它会游泳。", "不，它不会游泳。"],
    four_legs: ["是的，它有四条腿。", "不，它没有四条腿。"],
    has_wings: ["是的，它有翅膀。", "不，它没有翅膀。"],
    has_trunk: ["是的，它有长鼻子。", "不，它没有长鼻子。"],
    has_wheels: ["是的，它有轮子。", "不，它没有轮子。"],
    red: ["是的，它可以是红色的。", "不，它不是红色的。"],
    yellow: ["是的，它可以是黄色的。", "不，它不是黄色的。"],
    green: ["是的，它可以是绿色的。", "不，它不是绿色的。"],
    orange: ["是的，它是橙色的。", "不，它不是橙色的。"],
    round: ["是的，它是圆的。", "不，它不是圆的。"],
    soft: ["是的，它很柔软。", "不，它不柔软。"],
    crunchy: ["是的，它很脆。", "不，它不脆。"],
    used_at_home: ["是的，家里可以找到它。", "不，家里通常找不到它。"],
    from_a_story: ["是的，它会出现在故事里。", "不，它不是故事里的东西。"],
    magical: ["是的，它有魔法。", "不，它没有魔法。"],
  },
  es: {
    alive: ["Sí, está vivo.", "No, no está vivo."],
    animal: ["Sí, es un animal.", "No, no es un animal."],
    edible: ["Sí, se puede comer.", "No, no se puede comer."],
    big: ["Sí, es grande.", "No, no es grande."],
    small: ["Sí, es pequeño.", "No, no es pequeño."],
    flies: ["Sí, puede volar.", "No, no puede volar."],
    swims: ["Sí, puede nadar.", "No, no puede nadar."],
    four_legs: ["Sí, tiene cuatro patas.", "No, no tiene cuatro patas."],
    has_wings: ["Sí, tiene alas.", "No, no tiene alas."],
    has_trunk: ["Sí, tiene trompa.", "No, no tiene trompa."],
    has_wheels: ["Sí, tiene ruedas.", "No, no tiene ruedas."],
    red: ["Sí, puede ser rojo.", "No, no es rojo."],
    yellow: ["Sí, puede ser amarillo.", "No, no es amarillo."],
    green: ["Sí, puede ser verde.", "No, no es verde."],
    orange: ["Sí, es naranja.", "No, no es naranja."],
    round: ["Sí, es redondo.", "No, no es redondo."],
    soft: ["Sí, es suave.", "No, no es suave."],
    crunchy: ["Sí, es crujiente.", "No, no es crujiente."],
    used_at_home: [
      "Sí, puede estar en casa.",
      "No, normalmente no está en casa.",
    ],
    from_a_story: ["Sí, aparece en un cuento.", "No, no viene de un cuento."],
    magical: ["Sí, es mágico.", "No, no es mágico."],
  },
};

function answerAttribute(
  language: ThinkGuessLanguage,
  attribute: keyof AnswerObject["attributes"],
  value: boolean,
): string {
  return (
    attributeReplies[language][attribute]?.[value ? 0 : 1] ??
    (value ? copy[language].yes : copy[language].no)
  );
}

const appearanceAttributes: AnswerAttribute[] = [
  "big",
  "small",
  "red",
  "yellow",
  "green",
  "orange",
  "round",
  "soft",
  "crunchy",
  "four_legs",
  "has_wings",
  "has_trunk",
  "has_wheels",
];

const broadCategoryFacts: Record<
  ThinkGuessLanguage,
  Record<AnswerObject["category"], { action: string; location: string }>
> = {
  en: {
    animal: {
      action: "It can move around like an animal.",
      location: "You can find it where animals live.",
    },
    food: {
      action: "You can eat it.",
      location: "You might find it in a kitchen or a shop.",
    },
    toy: {
      action: "You can play with it.",
      location: "You might find it where children play.",
    },
    home: {
      action: "People use it at home.",
      location: "You can find it at home.",
    },
    transport: {
      action: "It helps people move from place to place.",
      location: "You might find it where people travel.",
    },
    fairy_tale: {
      action: "It has a special part in a fairy tale.",
      location: "You can find it in a fairy tale.",
    },
  },
  zh: {
    animal: {
      action: "它会像动物一样活动。",
      location: "在动物生活的地方可以找到它。",
    },
    food: { action: "它可以吃。", location: "厨房或商店里可能会有它。" },
    toy: { action: "可以用它来玩。", location: "小朋友玩耍的地方可能会有它。" },
    home: { action: "人们会在家里使用它。", location: "家里可以找到它。" },
    transport: {
      action: "它能帮助人们从一个地方去另一个地方。",
      location: "人们出行的地方可能会有它。",
    },
    fairy_tale: {
      action: "它在童话里有特别的作用。",
      location: "童话故事里可以找到它。",
    },
  },
  es: {
    animal: {
      action: "Puede moverse como un animal.",
      location: "Puedes encontrarlo donde viven los animales.",
    },
    food: {
      action: "Se puede comer.",
      location: "Podrías encontrarlo en una cocina o una tienda.",
    },
    toy: {
      action: "Puedes jugar con él.",
      location: "Podrías encontrarlo donde juegan los niños.",
    },
    home: {
      action: "La gente lo usa en casa.",
      location: "Puedes encontrarlo en casa.",
    },
    transport: {
      action: "Ayuda a las personas a ir de un lugar a otro.",
      location: "Podrías encontrarlo donde viaja la gente.",
    },
    fairy_tale: {
      action: "Tiene una función especial en un cuento de hadas.",
      location: "Puedes encontrarlo en un cuento de hadas.",
    },
  },
};

const approvedActionHintIndex: Partial<Record<string, number>> = {
  animal_lion: 2,
  animal_penguin: 2,
  animal_butterfly: 1,
  toy_teddy_bear: 2,
  toy_ball: 2,
  toy_kite: 3,
  toy_blocks: 3,
  toy_doll: 3,
  home_chair: 3,
  home_spoon: 3,
  home_toothbrush: 3,
  home_clock: 3,
  home_pillow: 3,
  transport_bicycle: 0,
  transport_bus: 3,
  transport_train: 3,
  transport_airplane: 3,
  transport_boat: 3,
  fairy_magic_wand: 3,
  fairy_crown: 3,
  fairy_glass_slipper: 1,
  fairy_magic_mirror: 2,
  fairy_pirate_ship: 2,
};

function withoutAgreement(language: ThinkGuessLanguage, value: string): string {
  const fact =
    language === "zh"
      ? value.replace(/^是的，/, "")
      : value.replace(/^(?:Yes|Sí),?\s*/i, "");
  return language === "zh"
    ? fact
    : `${fact.charAt(0).toLocaleUpperCase()}${fact.slice(1)}`;
}

function broadQuestionFact(
  answer: AnswerObject,
  language: ThinkGuessLanguage,
  topic: BroadQuestionTopic,
): string {
  if (topic === "color") {
    return answer.localized[language].facts.color;
  }

  if (topic === "category") {
    const category = categoryNames[language][answer.category];
    if (language === "zh") return `它是${category}。`;
    if (language === "es") return `Es ${category}.`;
    return `It is ${category}.`;
  }

  if (topic === "location") {
    return broadCategoryFacts[language][answer.category].location;
  }

  if (topic === "action") {
    const hintIndex = approvedActionHintIndex[answer.id];
    if (hintIndex !== undefined) {
      return answer.localized[language].hints[hintIndex];
    }
    return broadCategoryFacts[language][answer.category].action;
  }

  const attribute = appearanceAttributes.find(
    (candidate) => answer.attributes[candidate] === true,
  );
  if (attribute) {
    return withoutAgreement(
      language,
      answerAttribute(language, attribute, true),
    );
  }

  return answer.localized[language].hints[0];
}

export function supportStageFor(reasoningTurnNumber: number): SupportStage {
  if (reasoningTurnNumber >= 10) return "resolve";
  if (reasoningTurnNumber === 9) return "narrow";
  if (reasoningTurnNumber >= 7) return "coach";
  if (reasoningTurnNumber >= 4) return "connect";
  return "discover";
}

function addKnownClue(state: RoundState, clue: string): void {
  if (!state.knownClues.includes(clue) && state.knownClues.length < 10) {
    state.knownClues.push(clue);
  }
}

function clueSummary(state: RoundState): string {
  return state.knownClues.slice(-3).join(state.language === "zh" ? "" : " ");
}

export class RoundAccessError extends Error {
  constructor(
    public readonly code:
      | "ROUND_NOT_FOUND"
      | "ROUND_EXPIRED"
      | "ROUND_NOT_ACTIVE",
    message: string,
  ) {
    super(message);
  }
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[?.!,。！？¡¿'’]/g, "")
    .replace(
      /^(?:(?:a|an|the|un|una|el|la)\s+|(?:一个|一只|一辆|一架|一艘|一把|一根|一面|一顶)\s*)/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesFor(
  answer: AnswerObject,
  language: ThinkGuessLanguage,
): Set<string> {
  return new Set(answer.localized[language].aliases.map(normalize));
}

function answerMatches(
  answer: AnswerObject,
  language: ThinkGuessLanguage,
  guess?: string,
): boolean {
  if (!guess) return false;
  return aliasesFor(answer, language).has(normalize(guess));
}

export function replyNamesAnswer(reply: string, answer: AnswerObject): boolean {
  const normalizedReply = ` ${normalize(reply)} `;
  return (["en", "zh", "es"] as ThinkGuessLanguage[]).some((language) =>
    [...aliasesFor(answer, language)].some((alias) => {
      if (!alias) return false;
      return language === "zh"
        ? normalizedReply.includes(alias)
        : normalizedReply.includes(` ${alias} `);
    }),
  );
}

function nextQuestionSuggestion(state: RoundState): string {
  const topics: BroadQuestionTopic[] = [
    "color",
    "action",
    "location",
    "appearance",
    "category",
  ];
  const topic =
    topics.find((candidate) => !state.askedTopics.includes(candidate)) ??
    "color";
  // Recovery prompts are part of the conversation too. Remember the topic we
  // suggested so consecutive unknown questions do not send a child in a loop.
  if (!state.askedTopics.includes(topic)) {
    state.askedTopics.push(topic);
  }
  return broadQuestionSuggestions[state.language][topic];
}

function openingFor(
  answer: AnswerObject,
  state: Pick<RoundState, "language" | "reasoningLevel">,
): string {
  const category =
    state.reasoningLevel <= 2
      ? categoryNames[state.language][answer.category]
      : undefined;
  return copy[state.language].opening(category);
}

function distractorsFor(
  answer: AnswerObject,
  language: ThinkGuessLanguage,
  answers: AnswerObject[],
): string[] {
  return answers
    .filter(
      (candidate) =>
        candidate.id !== answer.id && candidate.category === answer.category,
    )
    .slice(0, 2)
    .map((candidate) => candidate.localized[language].canonical);
}

function hintReply(
  answer: AnswerObject,
  state: RoundState,
  answers: AnswerObject[],
): string {
  const level = state.hintLevel;
  if (level === 1) return copy[state.language].strategy;
  if (level >= 2 && level <= 4)
    return answer.localized[state.language].hints[level - 2];
  const choices = [
    answer.localized[state.language].canonical,
    ...distractorsFor(answer, state.language, answers),
  ];
  return copy[state.language].choices(choices.sort(() => 0.5 - Math.random()));
}

function choiceReply(
  answer: AnswerObject,
  language: ThinkGuessLanguage,
  answers: AnswerObject[],
): string {
  const choices = [
    answer.localized[language].canonical,
    ...distractorsFor(answer, language, answers),
  ];
  return copy[language].choices(choices.sort(() => 0.5 - Math.random()));
}

function applyProgressSupport(
  baseReply: string,
  state: RoundState,
  answer: AnswerObject,
  answers: AnswerObject[],
): string {
  const text = copy[state.language];
  const stage = supportStageFor(state.reasoningTurnNumber);
  if (stage === "discover") return text.discover(baseReply);
  if (stage === "connect") {
    const previousClue = state.knownClues.at(-2) ?? "";
    return text.connect(baseReply, previousClue);
  }
  if (stage === "coach") {
    const hintIndex = state.reasoningTurnNumber === 7 ? 1 : 2;
    const hint = answer.localized[state.language].hints[hintIndex];
    addKnownClue(state, hint);
    return text.coachProgress(baseReply, hint);
  }
  if (stage === "narrow") {
    return text.narrow(baseReply, choiceReply(answer, state.language, answers));
  }
  return baseReply;
}

export type EngineResult = {
  state: RoundState;
  decision: TurnDecision;
  currentFact?: string;
};

export function applyTurn(
  current: RoundState,
  answer: AnswerObject,
  classification: ClassifiedTurn,
  answers: AnswerObject[] = THINK_GUESS_ANSWERS,
  now = Date.now(),
): EngineResult {
  const text = copy[current.language];
  if (
    ["solved", "complete", "stopped", "abandoned", "expired"].includes(
      current.status,
    )
  ) {
    return {
      state: current,
      decision: turnDecisionSchema.parse({
        status: current.status,
        reply: text.alreadyDone,
        intent: classification.intent,
        turnNumber: current.turnNumber,
        hintLevel: current.hintLevel,
        voiceState:
          current.status === "solved" || current.status === "complete"
            ? "round_complete"
            : "idle",
      }),
    };
  }

  const state: RoundState = {
    ...current,
    status: "responding",
    turnNumber: current.turnNumber + 1,
    reasoningTurnNumber:
      current.reasoningTurnNumber +
      (REASONING_INTENTS.has(classification.intent) ? 1 : 0),
    knownClues: [...current.knownClues],
    askedAttributes: [...current.askedAttributes],
    askedTopics: [...current.askedTopics],
    updatedAt: now,
    expiresAt: now + ROUND_TTL_MS,
  };
  let reply: string;
  let completion: TurnDecision["completion"];
  let currentFact: string | undefined;

  switch (classification.intent) {
    case "stop":
      state.status = "stopped";
      reply = text.stopped;
      break;
    case "request_repeat":
      reply = text.repeat(current.lastReply);
      break;
    case "request_hint":
      state.hintLevel = Math.min(5, state.hintLevel + 1);
      state.hintsUsed += 1;
      state.consecutiveDirectGuesses = 0;
      reply = hintReply(answer, state, answers);
      if (state.hintLevel >= 2 && state.hintLevel <= 4) {
        currentFact = reply;
        addKnownClue(state, reply);
      }
      break;
    case "reveal_answer": {
      state.consecutiveDirectGuesses = 0;
      if (state.hintLevel < 3) {
        reply = text.revealLocked(3 - state.hintLevel);
        break;
      }
      const canonicalAnswer = answer.localized[state.language].canonical;
      state.status = "complete";
      reply = text.revealed(canonicalAnswer);
      completion = {
        solved: false,
        canonicalAnswer,
        usefulQuestions: state.usefulQuestions,
        hintsUsed: state.hintsUsed,
        reasoningLevel: state.reasoningLevel,
      };
      break;
    }
    case "dont_know":
      state.dontKnowCount += 1;
      state.consecutiveDirectGuesses = 0;
      reply = text.dontKnow;
      break;
    case "off_topic":
      reply = text.offTopic;
      break;
    case "unclear":
      state.speechFailures += 1;
      state.status = "error_recovery";
      reply = text.unclear;
      break;
    case "question": {
      state.consecutiveDirectGuesses = 0;
      const attributeValue = classification.attribute
        ? answer.attributes[classification.attribute]
        : undefined;
      if (classification.attribute && attributeValue !== undefined) {
        state.usefulQuestions += 1;
        if (!state.askedAttributes.includes(classification.attribute)) {
          state.askedAttributes.push(classification.attribute);
        }
        const fact = answerAttribute(
          state.language,
          classification.attribute,
          attributeValue,
        );
        currentFact = fact;
        addKnownClue(state, fact);
        reply = text.questionAnswer(fact, state.reasoningTurnNumber);
      } else if (classification.questionTopic) {
        state.usefulQuestions += 1;
        if (!state.askedTopics.includes(classification.questionTopic)) {
          state.askedTopics.push(classification.questionTopic);
        }
        const fact = broadQuestionFact(
          answer,
          state.language,
          classification.questionTopic,
        );
        currentFact = fact;
        addKnownClue(state, fact);
        reply = text.broadAnswer(fact, state.reasoningTurnNumber);
      } else {
        reply = text.unknown(nextQuestionSuggestion(state));
      }
      break;
    }
    case "direct_guess":
      if (
        answerMatches(answer, state.language, classification.normalizedGuess)
      ) {
        state.status = "solved";
        const canonicalAnswer = answer.localized[state.language].canonical;
        reply = text.solved(canonicalAnswer);
        completion = {
          solved: true,
          canonicalAnswer,
          usefulQuestions: state.usefulQuestions,
          hintsUsed: state.hintsUsed,
          reasoningLevel: state.reasoningLevel,
        };
      } else {
        state.consecutiveDirectGuesses += 1;
        const guess =
          classification.normalizedGuess ||
          (state.language === "zh"
            ? "这个答案"
            : state.language === "es"
              ? "esa respuesta"
              : "that");
        reply = text.wrong(guess);
        if (state.consecutiveDirectGuesses >= 3) {
          reply = `${reply} ${text.coach}`;
          state.consecutiveDirectGuesses = 0;
        }
      }
      break;
    default: {
      const exhaustive: never = classification.intent;
      throw new Error(`Unhandled intent: ${exhaustive}`);
    }
  }

  if (
    REASONING_INTENTS.has(classification.intent) &&
    state.status !== "solved" &&
    state.status !== "complete" &&
    state.reasoningTurnNumber >= REASONING_TURN_LIMIT
  ) {
    const canonicalAnswer = answer.localized[state.language].canonical;
    state.status = "complete";
    reply = text.turnLimitReveal(canonicalAnswer, clueSummary(state));
    completion = {
      solved: false,
      canonicalAnswer,
      usefulQuestions: state.usefulQuestions,
      hintsUsed: state.hintsUsed,
      reasoningLevel: state.reasoningLevel,
    };
  } else if (
    REASONING_INTENTS.has(classification.intent) &&
    state.status !== "solved" &&
    state.status !== "complete"
  ) {
    reply =
      classification.intent === "request_hint" ||
      (classification.intent === "question" && !currentFact)
        ? reply
        : applyProgressSupport(reply, state, answer, answers);
  }

  if (state.status === "responding" || state.status === "error_recovery") {
    state.status = "waiting_for_child";
  }
  state.lastReply = reply;
  return {
    state: roundStateSchema.parse(state),
    currentFact,
    decision: turnDecisionSchema.parse({
      status: state.status,
      reply,
      intent: classification.intent,
      turnNumber: state.turnNumber,
      hintLevel: state.hintLevel,
      voiceState:
        state.status === "solved" || state.status === "complete"
          ? "round_complete"
          : "ai_speaking",
      completion,
    }),
  };
}

function lookupError(
  lookup: Exclude<RoundLookup, { kind: "found" }>,
): RoundAccessError {
  return lookup.kind === "expired"
    ? new RoundAccessError(
        "ROUND_EXPIRED",
        "This mystery expired. Start a new round.",
      )
    : new RoundAccessError(
        "ROUND_NOT_FOUND",
        "This mystery could not be found.",
      );
}

export class ThinkGuessService {
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly repository: RoundRepository,
    private readonly classifier: TurnClassifier,
    private readonly analytics: ThinkGuessAnalytics,
    private readonly answers: AnswerObject[] = THINK_GUESS_ANSWERS,
    private readonly now: () => number = Date.now,
    private readonly chooseAnswer: (
      eligible: AnswerObject[],
    ) => AnswerObject = (eligible) =>
      eligible[Math.floor(Math.random() * eligible.length)],
    private readonly responseWriter: ThinkGuessResponseWriter = defaultResponseWriter(),
  ) {}

  async createRound(request: CreateRoundRequest): Promise<CreateRoundResponse> {
    if (request.mode !== "child_guesses") {
      throw new RoundAccessError(
        "ROUND_NOT_ACTIVE",
        "AI Guesses is not available in this pilot.",
      );
    }
    const eligible = this.answers.filter(
      (answer) => answer.difficulty <= Math.max(1, request.reasoningLevel),
    );
    const answer = this.chooseAnswer(eligible.length ? eligible : this.answers);
    const timestamp = this.now();
    const state = roundStateSchema.parse({
      id: randomUUID(),
      mode: request.mode,
      language: request.language,
      languageLevel: request.languageLevel,
      reasoningLevel: request.reasoningLevel,
      answerId: answer.id,
      status: "waiting_for_child",
      turnNumber: 0,
      reasoningTurnNumber: 0,
      hintLevel: 0,
      knownClues: [],
      askedAttributes: [],
      askedTopics: [],
      consecutiveDirectGuesses: 0,
      usefulQuestions: 0,
      hintsUsed: 0,
      dontKnowCount: 0,
      speechFailures: 0,
      lastReply: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: timestamp + ROUND_TTL_MS,
    });
    state.lastReply = openingFor(answer, state);
    await this.repository.create(state);
    this.emit(state, "think_guess_round_started");
    return {
      roundId: state.id,
      mode: state.mode,
      status: state.status,
      opening: state.lastReply,
      category: state.reasoningLevel <= 2 ? answer.category : undefined,
      turnNumber: 0,
      voiceState: "ai_speaking",
      voiceSession: {
        transport: "webrtc",
        interaction: "push_to_talk",
        replyAuthority: "ai_with_server_guardrails",
      },
      expiresAt: state.expiresAt,
    };
  }

  async submitTurn(
    roundId: string,
    transcript: string,
    speechConfidence?: number,
  ): Promise<TurnDecision> {
    return this.withLock(roundId, async () => {
      const startedAt = this.now();
      const lookup = await this.repository.get(roundId);
      if (lookup.kind !== "found") throw lookupError(lookup);
      const round = lookup.round;
      if (
        round.status !== "waiting_for_child" &&
        round.status !== "error_recovery"
      ) {
        throw new RoundAccessError(
          "ROUND_NOT_ACTIVE",
          "This round is not accepting a turn.",
        );
      }
      const classification = classifiedTurnSchema.parse(
        await this.classifier.classify(
          transcript,
          round.language,
          speechConfidence,
        ),
      );
      const answer = this.answers.find(
        (candidate) => candidate.id === round.answerId,
      );
      if (!answer) throw new Error(`Missing answer content: ${round.answerId}`);
      const priorReplyFingerprint = replyFingerprint(round.lastReply);
      const result = applyTurn(
        round,
        answer,
        classification,
        this.answers,
        this.now(),
      );
      const fallbackReplyFingerprint = replyFingerprint(result.decision.reply);
      const writerOutcome = await this.applyThinkGuessConversation(
        result,
        answer,
        classification,
        transcript,
        round.lastReply,
      );
      await this.repository.save(result.state);
      const responseLatency = this.now() - startedAt;
      const finalReplyFingerprint = replyFingerprint(result.decision.reply);
      console.info(
        "think_guess_turn_trace",
        JSON.stringify({
          traceVersion: 1,
          roundId: result.state.id,
          turnNumber: result.state.turnNumber,
          reasoningTurnNumber: result.state.reasoningTurnNumber,
          language: result.state.language,
          intent: classification.intent,
          attribute: classification.attribute,
          questionTopic: classification.questionTopic,
          speechConfidenceBucket: speechConfidenceBucket(speechConfidence),
          priorReplyFingerprint,
          fallbackReplyFingerprint,
          finalReplyFingerprint,
          writerOutcome,
          fallbackDuplicatedPrior:
            fallbackReplyFingerprint === priorReplyFingerprint,
          finalDuplicatedPrior: finalReplyFingerprint === priorReplyFingerprint,
          writerChangedReply:
            finalReplyFingerprint !== fallbackReplyFingerprint,
          knownClueCount: result.state.knownClues.length,
          responseLatencyBucket: responseLatencyBucket(responseLatency),
        }),
      );
      this.emitForDecision(
        result.state,
        classification.intent,
        speechConfidence,
        responseLatency,
      );
      return result.decision;
    });
  }

  async stopRound(roundId: string): Promise<TurnDecision> {
    return this.withLock(roundId, async () => {
      const lookup = await this.repository.get(roundId);
      if (lookup.kind !== "found") throw lookupError(lookup);
      const answer = this.answers.find(
        (candidate) => candidate.id === lookup.round.answerId,
      );
      if (!answer)
        throw new Error(`Missing answer content: ${lookup.round.answerId}`);
      const result = applyTurn(
        lookup.round,
        answer,
        { intent: "stop", confidence: 1 },
        this.answers,
        this.now(),
      );
      await this.applyThinkGuessConversation(
        result,
        answer,
        { intent: "stop", confidence: 1 },
        undefined,
        lookup.round.lastReply,
      );
      await this.repository.save(result.state);
      this.emit(result.state, "think_guess_round_abandoned", false);
      return result.decision;
    });
  }

  async assertRoundAvailable(roundId: string): Promise<RoundState> {
    const lookup = await this.repository.get(roundId);
    if (lookup.kind !== "found") throw lookupError(lookup);
    return lookup.round;
  }

  private async applyThinkGuessConversation(
    result: EngineResult,
    answer: AnswerObject,
    classification: ClassifiedTurn,
    childTranscript: string | undefined,
    previousReply: string,
  ): Promise<ResponseWriterOutcome> {
    const stage = supportStageFor(result.state.reasoningTurnNumber);
    const fallbackNamesAnswer = replyNamesAnswer(result.decision.reply, answer);
    const isTurnLimitReveal =
      result.state.status === "complete" &&
      result.state.reasoningTurnNumber >= REASONING_TURN_LIMIT &&
      classification.intent !== "reveal_answer";
    const outcome: ConversationOutcome =
      result.state.status === "solved"
        ? "solved"
        : isTurnLimitReveal
          ? "turn_limit_reveal"
          : result.state.status === "complete"
            ? "answer_revealed"
            : result.state.status === "stopped"
              ? "stopped"
              : classification.intent === "direct_guess"
                ? "incorrect_guess"
                : classification.intent === "reveal_answer"
                  ? "reveal_locked"
                  : classification.intent === "request_repeat"
                    ? "repeat"
                    : classification.intent === "unclear"
                      ? "unclear"
                      : classification.intent === "dont_know"
                        ? "dont_know"
                        : classification.intent === "off_topic"
                          ? "off_topic"
                          : "continue";
    const localizedObject = answer.localized[result.state.language];
    const update: ThinkGuessConversationTurn = {
      targetLanguage: result.state.language,
      languageLevel: result.state.languageLevel,
      reasoningLevel: result.state.reasoningLevel,
      childTranscript,
      childIntent: classification.intent,
      normalizedGuess: classification.normalizedGuess,
      outcome,
      reasoningTurnNumber: result.state.reasoningTurnNumber,
      remainingReasoningTurns: Math.max(
        0,
        REASONING_TURN_LIMIT - result.state.reasoningTurnNumber,
      ),
      turnLimit: REASONING_TURN_LIMIT,
      supportStage: stage,
      hintLevel: result.state.hintLevel,
      hintsUsed: result.state.hintsUsed,
      remainingHintsBeforeReveal: Math.max(0, 3 - result.state.hintLevel),
      currentFact: result.currentFact,
      knownClues: result.state.knownClues,
      questionTypesAsked: [
        ...result.state.askedAttributes,
        ...result.state.askedTopics,
      ],
      previousReply,
      categoryMayBeNamed: result.state.reasoningLevel <= 2,
      answerMayBeNamed: fallbackNamesAnswer,
      secretObject: {
        canonicalAnswer: localizedObject.canonical,
        category: answer.category,
        approvedAttributes: answer.attributes,
        seedFacts: [localizedObject.facts.color, ...localizedObject.hints],
      },
      fallbackReply: result.decision.reply,
    };
    let candidate: string;
    try {
      candidate = (await this.responseWriter.write(update)).trim();
    } catch (error) {
      console.warn("Think & Guess response writer fallback:", error);
      return "error_fallback";
    }
    const candidateNamesAnswer = replyNamesAnswer(candidate, answer);
    if (candidate.length === 0) return "rejected_empty";
    if (candidate.length > 600) return "rejected_too_long";
    if (candidateNamesAnswer && !fallbackNamesAnswer)
      return "rejected_secret_leak";
    if (fallbackNamesAnswer && !candidateNamesAnswer)
      return "rejected_answer_removed";
    if (
      !replyIsSpeakable(
        candidate,
        result.state.language,
        result.state.status === "solved" || result.state.status === "complete",
      )
    )
      return "rejected_not_speakable";

    result.state.lastReply = candidate;
    result.decision = turnDecisionSchema.parse({
      ...result.decision,
      reply: candidate,
    });
    return candidate === update.fallbackReply ? "deterministic" : "accepted";
  }

  private emitForDecision(
    state: RoundState,
    intent: ChildIntent,
    speechConfidence?: number,
    responseLatency?: number,
  ): void {
    const event =
      intent === "question"
        ? "reasoning_question_asked"
        : intent === "direct_guess"
          ? "direct_guess_made"
          : intent === "request_hint"
            ? "hint_requested"
            : intent === "reveal_answer"
              ? "answer_reveal_requested"
              : intent === "unclear"
                ? "speech_recovery_requested"
                : undefined;
    if (event)
      this.emit(state, event, undefined, speechConfidence, responseLatency);
    if (intent === "request_hint") this.emit(state, "hint_given");
    if (state.status === "complete") {
      this.emit(state, "answer_revealed", false);
      this.emit(state, "think_guess_round_completed", false);
    }
    if (state.status === "solved") {
      this.emit(state, "answer_solved", true);
      this.emit(state, "think_guess_round_completed", true);
    }
  }

  private emit(
    state: RoundState,
    event: Parameters<ThinkGuessAnalytics["emit"]>[0]["event"],
    completion?: boolean,
    speechConfidence?: number,
    responseLatency?: number,
  ): void {
    const answer = this.answers.find(
      (candidate) => candidate.id === state.answerId,
    );
    this.analytics.emit({
      event,
      roundId: state.id,
      language: state.language,
      languageLevel: state.languageLevel,
      reasoningLevel: state.reasoningLevel,
      category: answer?.category,
      turnNumber: state.turnNumber,
      hintLevel: state.hintLevel,
      completion,
      speechConfidenceBucket: speechConfidenceBucket(speechConfidence),
      responseLatencyBucket:
        responseLatency === undefined
          ? undefined
          : responseLatencyBucket(responseLatency),
      timestamp: this.now(),
    });
  }

  private async withLock<T>(
    roundId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const previous = this.locks.get(roundId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.locks.set(roundId, queued);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.locks.get(roundId) === queued) this.locks.delete(roundId);
    }
  }
}
