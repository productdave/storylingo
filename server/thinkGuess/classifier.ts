import OpenAI from "openai";
import {
  classifiedTurnSchema,
  type AnswerAttribute,
  type BroadQuestionTopic,
  type ClassifiedTurn,
  type ThinkGuessLanguage,
} from "@shared/thinkGuess";

const ATTRIBUTE_PATTERNS: [AnswerAttribute, RegExp][] = [
  ["has_trunk", /\b(trunk|long nose)\b|象鼻|长鼻|\btrompa\b/i],
  ["four_legs", /four legs|4 legs|四条腿|四只脚|cuatro patas/i],
  ["has_wings", /\b(wings?)\b|翅膀|\balas?\b/i],
  ["has_wheels", /\b(wheels?)\b|轮子|\bruedas?\b/i],
  ["flies", /\b(fly|flies|flying)\b|会飞|飞吗|\b(vuela|volar)\b/i],
  ["swims", /\b(swim|swims|water)\b|游泳|水里|\b(nada|nadar|agua)\b/i],
  ["edible", /\b(eat|edible|food)\b|能吃|食物|\b(comer|comida|comestible)\b/i],
  ["alive", /\b(alive|living)\b|活的|有生命|\b(vivo|viva)\b/i],
  ["animal", /\banimal\b|动物|\banimal\b/i],
  [
    "big",
    /\b(big|large|huge|tall)\b|大.*吗|很大|高吗|\b(grande|enorme|alto)\b/i,
  ],
  ["small", /\b(small|little|tiny)\b|小吗|很小|\b(pequeñ[oa]|chiquit[oa])\b/i],
  ["red", /\bred\b|红色|红的|\broj[oa]\b/i],
  ["yellow", /\byellow\b|黄色|黄的|\bamarill[oa]\b/i],
  ["green", /\bgreen\b|绿色|绿的|\bverde\b/i],
  ["orange", /\borange\b|橙色|橘色|\bnaranja\b/i],
  ["round", /\b(round|circle)\b|圆的|圆形|\b(redond[oa]|círculo)\b/i],
  ["soft", /\bsoft|fluffy\b|软的|柔软|\b(suave|blando)\b/i],
  ["crunchy", /\bcrunchy|crisp\b|脆的|\b(crujiente)\b/i],
  [
    "used_at_home",
    /\b(home|house|kitchen|bedroom)\b|家里|厨房|卧室|\b(casa|cocina|dormitorio)\b/i,
  ],
  [
    "from_a_story",
    /\b(story|fairy tale|book)\b|故事|童话|\b(cuento|historia|libro)\b/i,
  ],
  ["magical", /\b(magic|magical|spell)\b|魔法|\b(mágic[oa]|hechizo)\b/i],
];

const QUESTION_START =
  /^(is|are|does|do|can|could|has|have|what|where|who|how|是不是|它是|它有|会不会|会飞|能不能|可以|什么|哪里|es|son|tiene|puede|hace|qué|dónde)\b/i;
const HINT =
  /\b(hint|clue|help me|help)\b|提示|线索|帮帮我|\b(pista|ayuda|ayúdame)\b/i;
const REVEAL_ANSWER =
  /\b(tell me (?:the )?answer|what(?:'s| is) the answer|show me the answer|just tell me)\b|告诉我答案|答案是什么|直接告诉我|\b(dime la respuesta|cuál es la respuesta|muéstrame la respuesta)\b/i;
const REPEAT =
  /\b(repeat|again|say it again|what did you say)\b|再说|重复|没听清|\b(repite|otra vez|qué dijiste)\b/i;
const DONT_KNOW =
  /\b(i don'?t know|no idea|not sure|give up)\b|不知道|不清楚|放弃|\b(no sé|ni idea|no estoy segur[oa])\b/i;
const STOP =
  /\b(stop|quit|exit|done|don'?t want to play|no more)\b|不想玩|停止|退出|结束|\b(para|salir|terminar|no quiero jugar)\b/i;
const OFF_TOPIC =
  /\b(dinosaur story|tell me a story|poo|poop|butt)\b|讲故事|便便|屁|\b(caca|cuéntame un cuento)\b/i;
const FILLER_PREFIX = /^(?:um+|uh+|erm+|hmm+|well|okay|ok)[,.!?\s-]*/i;
const UNSUPPORTED_COLOR_QUESTION =
  /^(?:is|are) (?:it|they) (?:blue|purple|pink|white|black|brown|grey|gray)\??$/i;
const UNSUPPORTED_SOUND_QUESTION =
  /\b(?:make|have|hear)\s+(?:(?:a|any|the)\s+)?(?:\w+\s+){0,2}sounds?\b|\bwhat (?:kind of )?sounds?\b|\b(?:sound|sounds) like\b|\bnoisy\b|声音|会叫吗|发出.*声音|\b(?:hace|tiene) (?:un |algún )?sonido\b/i;

const BROAD_QUESTION_PATTERNS: [BroadQuestionTopic, RegExp][] = [
  [
    "color",
    /what colou?r(?: (?:is|are) (?:it|they))?|what(?:'s| is) (?:its|their) colou?r|which colou?r|什么颜色|哪种颜色|什么色|de qué color es|qué color tiene|cuál es su color/i,
  ],
  [
    "appearance",
    /what (?:does|do) (?:it|they) look like|what (?:is|are) (?:it|they) like|describe (?:it|them)|长什么样|什么样子|描述一下|cómo es|qué aspecto tiene|descríbelo/i,
  ],
  [
    "action",
    /what (?:does|do|can) (?:it|they) do|what it does|它会做什么|它能做什么|有什么用|qué hace|qué puede hacer|para qué sirve/i,
  ],
  [
    "location",
    /where (?:do|can|would|might) (?:i|you|we) find (?:it|them)|where (?:does|do) (?:it|they) live|where is it found|在哪里|哪里能找到|住在哪里|dónde (?:se encuentra|lo encuentro|vive|está)/i,
  ],
  [
    "category",
    /what kind of (?:thing|animal|food|toy|object) (?:is it|are they)|what type of thing|它是什么种类|它是哪一类|是什么东西|qué tipo de cosa es|qué clase de cosa es/i,
  ],
];

function cleanGuess(text: string): string {
  const corrected =
    text
      .replace(FILLER_PREFIX, "")
      .split(
        /\b(?:i mean|no,? i mean|no,? wait|wait,? no|quiero decir)\b|我是说|不对.*?是/i,
      )
      .filter(Boolean)
      .at(-1) ?? text;
  return corrected
    .replace(FILLER_PREFIX, "")
    .replace(
      /^(?:is it(?: maybe)?|it is|i think it is|my guess is|maybe|是不是|是|我猜是|es|es un|es una|creo que es)\s+/i,
      "",
    )
    .replace(/[?.!,。！？¡¿]/g, "")
    .trim()
    .toLocaleLowerCase();
}

export function classifyTurnHeuristically(
  transcript: string,
  speechConfidence?: number,
): ClassifiedTurn {
  const text = transcript.trim();
  if (!text || (speechConfidence !== undefined && speechConfidence < 0.35)) {
    return { intent: "unclear", confidence: 1 };
  }
  if (STOP.test(text)) return { intent: "stop", confidence: 0.99 };
  if (REPEAT.test(text)) return { intent: "request_repeat", confidence: 0.98 };
  if (REVEAL_ANSWER.test(text))
    return { intent: "reveal_answer", confidence: 0.99 };
  if (HINT.test(text)) return { intent: "request_hint", confidence: 0.98 };
  if (DONT_KNOW.test(text)) return { intent: "dont_know", confidence: 0.98 };
  if (OFF_TOPIC.test(text)) return { intent: "off_topic", confidence: 0.95 };

  const speech = text.replace(FILLER_PREFIX, "");
  if (UNSUPPORTED_COLOR_QUESTION.test(speech)) {
    return { intent: "question", questionTopic: "color", confidence: 0.9 };
  }
  if (UNSUPPORTED_SOUND_QUESTION.test(speech)) {
    return { intent: "question", confidence: 0.9 };
  }

  for (const [attribute, pattern] of ATTRIBUTE_PATTERNS) {
    if (pattern.test(speech)) {
      const expectedValue =
        !/\b(not|can'?t|cannot|doesn'?t|isn'?t|no)\b|不|不会|不能|没有|\b(no|sin|nunca)\b/i.test(
          text,
        );
      return { intent: "question", attribute, expectedValue, confidence: 0.9 };
    }
  }

  for (const [questionTopic, pattern] of BROAD_QUESTION_PATTERNS) {
    if (pattern.test(speech)) {
      return { intent: "question", questionTopic, confidence: 0.92 };
    }
  }

  const looksLikeQuestion = QUESTION_START.test(speech) || /[?？]$/.test(speech);
  const normalizedGuess = cleanGuess(speech);
  const wordCount = normalizedGuess.split(/\s+/).filter(Boolean).length;
  if (
    !looksLikeQuestion ||
    /^(is it|是不是|我猜|es un|es una|creo que)/i.test(speech) ||
    /\b(?:no,? wait|i mean|no,? i mean|wait,? no)\b/i.test(text)
  ) {
    if (normalizedGuess && wordCount <= 6) {
      return { intent: "direct_guess", normalizedGuess, confidence: 0.82 };
    }
  }

  return {
    intent: looksLikeQuestion ? "question" : "unclear",
    confidence: 0.55,
  };
}

const classifierJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "confidence",
    "normalizedGuess",
    "attribute",
    "questionTopic",
    "expectedValue",
  ],
  properties: {
    intent: {
      type: "string",
      enum: [
        "question",
        "direct_guess",
        "request_hint",
        "reveal_answer",
        "request_repeat",
        "dont_know",
        "off_topic",
        "stop",
        "unclear",
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    normalizedGuess: { type: ["string", "null"] },
    attribute: {
      type: ["string", "null"],
      enum: [...ATTRIBUTE_PATTERNS.map(([attribute]) => attribute), null],
    },
    questionTopic: {
      type: ["string", "null"],
      enum: ["color", "appearance", "action", "location", "category", null],
    },
    expectedValue: { type: ["boolean", "null"] },
  },
} as const;

export interface TurnClassifier {
  classify(
    transcript: string,
    language: ThinkGuessLanguage,
    speechConfidence?: number,
  ): Promise<ClassifiedTurn>;
}

export function keepClassificationGrounded(
  heuristic: ClassifiedTurn,
  candidate: ClassifiedTurn,
): ClassifiedTurn {
  if (
    heuristic.intent === "question" &&
    !heuristic.attribute &&
    !heuristic.questionTopic &&
    (candidate.attribute || candidate.questionTopic)
  ) {
    return heuristic;
  }
  return candidate;
}

export class BoundedTurnClassifier implements TurnClassifier {
  private readonly client: OpenAI | null;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    this.client = apiKey
      ? new OpenAI({ apiKey, timeout: 3_000, maxRetries: 0 })
      : null;
  }

  async classify(
    transcript: string,
    language: ThinkGuessLanguage,
    speechConfidence?: number,
  ): Promise<ClassifiedTurn> {
    const heuristic = classifyTurnHeuristically(transcript, speechConfidence);
    if (heuristic.confidence >= 0.8 || !this.client) return heuristic;

    try {
      const response = await this.client.responses.create({
        model: process.env.THINK_GUESS_CLASSIFIER_MODEL || "gpt-4o-mini",
        store: false,
        max_output_tokens: 120,
        instructions:
          "Classify one child's utterance in a bounded guessing game. Never answer the child. Extract only the supported intent, one supported yes/no attribute if asked, one broad question topic (color, appearance, action, location, or category) when applicable, and a concise normalized guess if present. A child asking what color something is means the color topic, not generic appearance. Mixed or incomplete language is valid. If uncertain, use unclear.",
        input: `Target language: ${language}\nChild utterance: ${transcript}`,
        text: {
          format: {
            type: "json_schema",
            name: "think_guess_turn",
            strict: true,
            schema: classifierJsonSchema,
          },
        },
      });
      const parsed = JSON.parse(response.output_text) as Record<
        string,
        unknown
      >;
      const candidate = classifiedTurnSchema.parse({
        ...parsed,
        normalizedGuess: parsed.normalizedGuess ?? undefined,
        attribute: parsed.attribute ?? undefined,
        questionTopic: parsed.questionTopic ?? undefined,
        expectedValue: parsed.expectedValue ?? undefined,
      });
      return keepClassificationGrounded(heuristic, candidate);
    } catch (error) {
      console.warn("Think & Guess classifier fallback:", error);
      return heuristic;
    }
  }
}
