// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";

// server/languageConfig.ts
var DEFAULT_PROMPT_ID = "pmpt_69a90d800bd48194b453b5797a6145350421cafc908bc7e5";
var languageConfigs = {
  en: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: `IMPORTANT: This is an IMMERSIVE LANGUAGE LEARNING experience for children ages 3-10.
Speak ONLY in English for this entire session - no translations or explanations in other languages.
Use very simple vocabulary and short sentences appropriate for toddlers.
Repeat key words naturally to help children learn them.
Speak slowly and clearly with enthusiasm.
Use lots of expression, sound effects, and encourage children to repeat words and phrases.`,
    languageName: "English"
  },
  zh: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: `IMPORTANT: This is an IMMERSIVE LANGUAGE LEARNING experience for children ages 3-10.
Speak ONLY in Chinese (Mandarin) for this entire session - no translations or explanations in other languages.
Use very simple vocabulary and short sentences appropriate for toddlers.
Repeat key words naturally to help children learn them.
Speak slowly and clearly with enthusiasm.
Use lots of expression, sound effects, and encourage children to repeat words and phrases.`,
    languageName: "Chinese (Mandarin)"
  },
  es: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: `IMPORTANT: This is an IMMERSIVE LANGUAGE LEARNING experience for children ages 3-10.
Speak ONLY in Spanish for this entire session - no translations or explanations in other languages.
Use very simple vocabulary and short sentences appropriate for toddlers.
Repeat key words naturally to help children learn them.
Speak slowly and clearly with enthusiasm.
Use lots of expression, sound effects, and encourage children to repeat words and phrases.`,
    languageName: "Spanish"
  }
};
function getLanguageConfig(language) {
  if (language in languageConfigs) {
    return languageConfigs[language];
  }
  return languageConfigs.en;
}

// server/routes.ts
import * as fs from "fs";
import * as path from "path";

// shared/thinkGuess.ts
import { z } from "zod";
var supportedLanguageSchema = z.enum(["en", "zh", "es"]);
var gameModeSchema = z.enum(["child_guesses", "ai_guesses"]);
var roundStatusSchema = z.enum([
  "initializing",
  "intro",
  "waiting_for_child",
  "processing",
  "responding",
  "solved",
  "complete",
  "stopped",
  "abandoned",
  "error_recovery",
  "expired"
]);
var voiceStateSchema = z.enum([
  "idle",
  "connecting",
  "ai_speaking",
  "child_turn",
  "child_speaking",
  "ai_thinking",
  "round_complete",
  "error"
]);
var childIntentSchema = z.enum([
  "question",
  "direct_guess",
  "request_hint",
  "reveal_answer",
  "request_repeat",
  "dont_know",
  "off_topic",
  "stop",
  "unclear"
]);
var answerCategorySchema = z.enum([
  "animal",
  "food",
  "toy",
  "home",
  "transport",
  "fairy_tale"
]);
var answerAttributeSchema = z.enum([
  "alive",
  "animal",
  "edible",
  "big",
  "small",
  "flies",
  "swims",
  "four_legs",
  "has_wings",
  "has_trunk",
  "has_wheels",
  "red",
  "yellow",
  "green",
  "orange",
  "round",
  "soft",
  "crunchy",
  "used_at_home",
  "from_a_story",
  "magical"
]);
var broadQuestionTopicSchema = z.enum([
  "color",
  "appearance",
  "action",
  "location",
  "category"
]);
var localizedAnswerSchema = z.object({
  canonical: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
  hints: z.array(z.string().min(1)).length(4),
  facts: z.object({
    color: z.string().min(1)
  })
});
var answerObjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  category: answerCategorySchema,
  minimumAge: z.number().int().min(4).max(7),
  difficulty: z.number().int().min(1).max(5),
  attributes: z.record(answerAttributeSchema, z.boolean()).refine(
    (attributes) => Object.keys(attributes).length >= 4,
    "Each answer needs at least four approved attributes"
  ),
  localized: z.object({
    en: localizedAnswerSchema,
    zh: localizedAnswerSchema,
    es: localizedAnswerSchema
  }),
  storyConnections: z.array(z.string()).default([])
});
var classifiedTurnSchema = z.object({
  intent: childIntentSchema,
  confidence: z.number().min(0).max(1),
  normalizedGuess: z.string().min(1).optional(),
  attribute: answerAttributeSchema.optional(),
  questionTopic: broadQuestionTopicSchema.optional(),
  expectedValue: z.boolean().optional()
});
var roundStateSchema = z.object({
  id: z.string().uuid(),
  mode: gameModeSchema,
  language: supportedLanguageSchema,
  languageLevel: z.number().int().min(1).max(5),
  reasoningLevel: z.number().int().min(1).max(5),
  answerId: z.string(),
  status: roundStatusSchema,
  turnNumber: z.number().int().nonnegative(),
  reasoningTurnNumber: z.number().int().min(0).max(10),
  hintLevel: z.number().int().min(0).max(5),
  knownClues: z.array(z.string().min(1)).max(10),
  askedAttributes: z.array(answerAttributeSchema).max(10),
  askedTopics: z.array(broadQuestionTopicSchema).max(10),
  consecutiveDirectGuesses: z.number().int().nonnegative(),
  usefulQuestions: z.number().int().nonnegative(),
  hintsUsed: z.number().int().nonnegative(),
  dontKnowCount: z.number().int().nonnegative(),
  speechFailures: z.number().int().nonnegative(),
  lastReply: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  expiresAt: z.number().int()
});
var turnDecisionSchema = z.object({
  status: roundStatusSchema,
  reply: z.string().min(1),
  intent: childIntentSchema,
  turnNumber: z.number().int().nonnegative(),
  hintLevel: z.number().int().min(0).max(5),
  voiceState: voiceStateSchema,
  completion: z.object({
    solved: z.boolean(),
    canonicalAnswer: z.string().min(1),
    usefulQuestions: z.number().int().nonnegative(),
    hintsUsed: z.number().int().nonnegative(),
    reasoningLevel: z.number().int().min(1).max(5)
  }).optional()
});
var createRoundRequestSchema = z.object({
  mode: gameModeSchema.default("child_guesses"),
  language: supportedLanguageSchema,
  languageLevel: z.number().int().min(1).max(5),
  reasoningLevel: z.number().int().min(1).max(5)
});
var createRoundResponseSchema = z.object({
  roundId: z.string().uuid(),
  mode: gameModeSchema,
  status: roundStatusSchema,
  opening: z.string().min(1),
  category: answerCategorySchema.optional(),
  turnNumber: z.number().int().nonnegative(),
  voiceState: voiceStateSchema,
  voiceSession: z.object({
    transport: z.literal("webrtc"),
    interaction: z.literal("push_to_talk"),
    replyAuthority: z.literal("ai_with_server_guardrails")
  }),
  expiresAt: z.number().int()
});
var submitTurnRequestSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
  speechConfidence: z.number().min(0).max(1).optional()
});
var thinkGuessEventNameSchema = z.enum([
  "think_guess_entry_tapped",
  "think_guess_mode_selected",
  "think_guess_round_started",
  "think_guess_round_completed",
  "think_guess_round_abandoned",
  "think_guess_replay_tapped",
  "reasoning_question_asked",
  "direct_guess_made",
  "hint_requested",
  "hint_given",
  "answer_reveal_requested",
  "answer_revealed",
  "answer_solved",
  "speech_recovery_requested"
]);
var thinkGuessAnalyticsEventSchema = z.object({
  event: thinkGuessEventNameSchema,
  roundId: z.string().uuid().optional(),
  language: supportedLanguageSchema,
  languageLevel: z.number().int().min(1).max(5),
  reasoningLevel: z.number().int().min(1).max(5),
  category: answerCategorySchema.optional(),
  turnNumber: z.number().int().nonnegative().optional(),
  hintLevel: z.number().int().min(0).max(5).optional(),
  completion: z.boolean().optional(),
  speechConfidenceBucket: z.enum(["low", "medium", "high"]).optional(),
  responseLatencyBucket: z.enum(["fast", "normal", "slow"]).optional(),
  timestamp: z.number().int()
});
var apiErrorSchema = z.object({
  error: z.string(),
  code: z.enum([
    "INVALID_REQUEST",
    "ROUND_NOT_FOUND",
    "ROUND_EXPIRED",
    "MODE_NOT_AVAILABLE",
    "ROUND_NOT_ACTIVE",
    "VOICE_UNAVAILABLE",
    "INTERNAL_ERROR"
  ])
});

// server/thinkGuess/routes.ts
import { ZodError } from "zod";

// server/thinkGuess/classifier.ts
import OpenAI from "openai";
var ATTRIBUTE_PATTERNS = [
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
    /\b(big|large|huge|tall)\b|大.*吗|很大|高吗|\b(grande|enorme|alto)\b/i
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
    /\b(home|house|kitchen|bedroom)\b|家里|厨房|卧室|\b(casa|cocina|dormitorio)\b/i
  ],
  [
    "from_a_story",
    /\b(story|fairy tale|book)\b|故事|童话|\b(cuento|historia|libro)\b/i
  ],
  ["magical", /\b(magic|magical|spell)\b|魔法|\b(mágic[oa]|hechizo)\b/i]
];
var QUESTION_START = /^(is|are|does|do|can|could|has|have|what|where|who|how|是不是|它是|它有|会不会|会飞|能不能|可以|什么|哪里|es|son|tiene|puede|hace|qué|dónde)\b/i;
var HINT = /\b(hint|clue|help me|help)\b|提示|线索|帮帮我|\b(pista|ayuda|ayúdame)\b/i;
var REVEAL_ANSWER = /\b(tell me (?:the )?answer|what(?:'s| is) the answer|show me the answer|just tell me)\b|告诉我答案|答案是什么|直接告诉我|\b(dime la respuesta|cuál es la respuesta|muéstrame la respuesta)\b/i;
var REPEAT = /\b(repeat|again|say it again|what did you say)\b|再说|重复|没听清|\b(repite|otra vez|qué dijiste)\b/i;
var DONT_KNOW = /\b(i don'?t know|no idea|not sure|give up)\b|不知道|不清楚|放弃|\b(no sé|ni idea|no estoy segur[oa])\b/i;
var STOP = /\b(stop|quit|exit|done|don'?t want to play|no more)\b|不想玩|停止|退出|结束|\b(para|salir|terminar|no quiero jugar)\b/i;
var OFF_TOPIC = /\b(dinosaur story|tell me a story|poo|poop|butt)\b|讲故事|便便|屁|\b(caca|cuéntame un cuento)\b/i;
var FILLER_PREFIX = /^(?:um+|uh+|erm+|hmm+|well|okay|ok)[,.!?\s-]*/i;
var UNSUPPORTED_COLOR_QUESTION = /^(?:is|are) (?:it|they) (?:blue|purple|pink|white|black|brown|grey|gray)\??$/i;
var UNSUPPORTED_SOUND_QUESTION = /\b(?:make|have|hear)\s+(?:(?:a|any|the)\s+)?(?:\w+\s+){0,2}sounds?\b|\bwhat (?:kind of )?sounds?\b|\b(?:sound|sounds) like\b|\bnoisy\b|声音|会叫吗|发出.*声音|\b(?:hace|tiene) (?:un |algún )?sonido\b/i;
var BROAD_QUESTION_PATTERNS = [
  [
    "color",
    /what colou?r(?: (?:is|are) (?:it|they))?|what(?:'s| is) (?:its|their) colou?r|which colou?r|什么颜色|哪种颜色|什么色|de qué color es|qué color tiene|cuál es su color/i
  ],
  [
    "appearance",
    /what (?:does|do) (?:it|they) look like|what (?:is|are) (?:it|they) like|describe (?:it|them)|长什么样|什么样子|描述一下|cómo es|qué aspecto tiene|descríbelo/i
  ],
  [
    "action",
    /what (?:does|do|can) (?:it|they) do|what it does|它会做什么|它能做什么|有什么用|qué hace|qué puede hacer|para qué sirve/i
  ],
  [
    "location",
    /where (?:do|can|would|might) (?:i|you|we) find (?:it|them)|where (?:does|do) (?:it|they) live|where is it found|在哪里|哪里能找到|住在哪里|dónde (?:se encuentra|lo encuentro|vive|está)/i
  ],
  [
    "category",
    /what kind of (?:thing|animal|food|toy|object) (?:is it|are they)|what type of thing|它是什么种类|它是哪一类|是什么东西|qué tipo de cosa es|qué clase de cosa es/i
  ]
];
function cleanGuess(text) {
  const corrected = text.replace(FILLER_PREFIX, "").split(
    /\b(?:i mean|no,? i mean|no,? wait|wait,? no|quiero decir)\b|我是说|不对.*?是/i
  ).filter(Boolean).at(-1) ?? text;
  return corrected.replace(FILLER_PREFIX, "").replace(
    /^(?:is it(?: maybe)?|it is|i think it is|my guess is|maybe|是不是|是|我猜是|es|es un|es una|creo que es)\s+/i,
    ""
  ).replace(/[?.!,。！？¡¿]/g, "").trim().toLocaleLowerCase();
}
function classifyTurnHeuristically(transcript, speechConfidence) {
  const text = transcript.trim();
  if (!text || speechConfidence !== void 0 && speechConfidence < 0.35) {
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
      const expectedValue = !/\b(not|can'?t|cannot|doesn'?t|isn'?t|no)\b|不|不会|不能|没有|\b(no|sin|nunca)\b/i.test(
        text
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
  if (!looksLikeQuestion || /^(is it|是不是|我猜|es un|es una|creo que)/i.test(speech) || /\b(?:no,? wait|i mean|no,? i mean|wait,? no)\b/i.test(text)) {
    if (normalizedGuess && wordCount <= 6) {
      return { intent: "direct_guess", normalizedGuess, confidence: 0.82 };
    }
  }
  return {
    intent: looksLikeQuestion ? "question" : "unclear",
    confidence: 0.55
  };
}
var classifierJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "confidence",
    "normalizedGuess",
    "attribute",
    "questionTopic",
    "expectedValue"
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
        "unclear"
      ]
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    normalizedGuess: { type: ["string", "null"] },
    attribute: {
      type: ["string", "null"],
      enum: [...ATTRIBUTE_PATTERNS.map(([attribute]) => attribute), null]
    },
    questionTopic: {
      type: ["string", "null"],
      enum: ["color", "appearance", "action", "location", "category", null]
    },
    expectedValue: { type: ["boolean", "null"] }
  }
};
function keepClassificationGrounded(heuristic, candidate) {
  if (heuristic.intent === "question" && !heuristic.attribute && !heuristic.questionTopic && (candidate.attribute || candidate.questionTopic)) {
    return heuristic;
  }
  return candidate;
}
var BoundedTurnClassifier = class {
  client;
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    this.client = apiKey ? new OpenAI({ apiKey, timeout: 3e3, maxRetries: 0 }) : null;
  }
  async classify(transcript, language, speechConfidence) {
    const heuristic = classifyTurnHeuristically(transcript, speechConfidence);
    if (heuristic.confidence >= 0.8 || !this.client) return heuristic;
    try {
      const response = await this.client.responses.create({
        model: process.env.THINK_GUESS_CLASSIFIER_MODEL || "gpt-4o-mini",
        store: false,
        max_output_tokens: 120,
        instructions: "Classify one child's utterance in a bounded guessing game. Never answer the child. Extract only the supported intent, one supported yes/no attribute if asked, one broad question topic (color, appearance, action, location, or category) when applicable, and a concise normalized guess if present. A child asking what color something is means the color topic, not generic appearance. Mixed or incomplete language is valid. If uncertain, use unclear.",
        input: `Target language: ${language}
Child utterance: ${transcript}`,
        text: {
          format: {
            type: "json_schema",
            name: "think_guess_turn",
            strict: true,
            schema: classifierJsonSchema
          }
        }
      });
      const parsed = JSON.parse(response.output_text);
      const candidate = classifiedTurnSchema.parse({
        ...parsed,
        normalizedGuess: parsed.normalizedGuess ?? void 0,
        attribute: parsed.attribute ?? void 0,
        questionTopic: parsed.questionTopic ?? void 0,
        expectedValue: parsed.expectedValue ?? void 0
      });
      return keepClassificationGrounded(heuristic, candidate);
    } catch (error) {
      console.warn("Think & Guess classifier fallback:", error);
      return heuristic;
    }
  }
};

// server/thinkGuess/analytics.ts
var StructuredLogAnalytics = class {
  emit(event) {
    const safeEvent = thinkGuessAnalyticsEventSchema.parse(event);
    console.log("think_guess_event", JSON.stringify(safeEvent));
  }
};

// server/thinkGuess/engine.ts
import { createHash, randomUUID } from "node:crypto";

// server/thinkGuess/content.ts
var seeds = [
  {
    id: "animal_elephant",
    category: "animal",
    difficulty: 1,
    attributes: {
      alive: true,
      animal: true,
      big: true,
      four_legs: true,
      has_trunk: true,
      flies: false
    },
    en: [
      "elephant",
      ["elephant", "an elephant"],
      [
        "It is very big.",
        "It has four legs.",
        "It has big ears.",
        "It has a long trunk."
      ]
    ],
    zh: [
      "\u5927\u8C61",
      ["\u5927\u8C61", "\u4E00\u53EA\u5927\u8C61"],
      ["\u5B83\u5F88\u5927\u3002", "\u5B83\u6709\u56DB\u6761\u817F\u3002", "\u5B83\u6709\u5927\u8033\u6735\u3002", "\u5B83\u6709\u957F\u9F3B\u5B50\u3002"]
    ],
    es: [
      "elefante",
      ["elefante", "un elefante"],
      [
        "Es muy grande.",
        "Tiene cuatro patas.",
        "Tiene orejas grandes.",
        "Tiene una trompa larga."
      ]
    ]
  },
  {
    id: "animal_lion",
    category: "animal",
    difficulty: 1,
    attributes: {
      alive: true,
      animal: true,
      big: true,
      four_legs: true,
      flies: false,
      has_wings: false
    },
    en: [
      "lion",
      ["lion", "a lion"],
      [
        "It is a big animal.",
        "It has four legs.",
        "It has a loud roar.",
        "The male has a mane."
      ]
    ],
    zh: [
      "\u72EE\u5B50",
      ["\u72EE\u5B50", "\u4E00\u53EA\u72EE\u5B50"],
      ["\u5B83\u662F\u4E00\u79CD\u5927\u578B\u52A8\u7269\u3002", "\u5B83\u6709\u56DB\u6761\u817F\u3002", "\u5B83\u4F1A\u5927\u58F0\u543C\u53EB\u3002", "\u96C4\u72EE\u6709\u9B03\u6BDB\u3002"]
    ],
    es: [
      "le\xF3n",
      ["le\xF3n", "un le\xF3n"],
      [
        "Es un animal grande.",
        "Tiene cuatro patas.",
        "Ruge muy fuerte.",
        "El macho tiene melena."
      ]
    ]
  },
  {
    id: "animal_giraffe",
    category: "animal",
    difficulty: 1,
    attributes: {
      alive: true,
      animal: true,
      big: true,
      four_legs: true,
      flies: false,
      has_wings: false
    },
    en: [
      "giraffe",
      ["giraffe", "a giraffe"],
      [
        "It is a tall animal.",
        "It has four legs.",
        "It has brown patches.",
        "Its neck is very long."
      ]
    ],
    zh: [
      "\u957F\u9888\u9E7F",
      ["\u957F\u9888\u9E7F", "\u4E00\u53EA\u957F\u9888\u9E7F"],
      [
        "\u5B83\u662F\u4E00\u79CD\u5F88\u9AD8\u7684\u52A8\u7269\u3002",
        "\u5B83\u6709\u56DB\u6761\u817F\u3002",
        "\u5B83\u8EAB\u4E0A\u6709\u68D5\u8272\u6591\u5757\u3002",
        "\u5B83\u7684\u8116\u5B50\u5F88\u957F\u3002"
      ]
    ],
    es: [
      "jirafa",
      ["jirafa", "una jirafa"],
      [
        "Es un animal alto.",
        "Tiene cuatro patas.",
        "Tiene manchas marrones.",
        "Su cuello es muy largo."
      ]
    ]
  },
  {
    id: "animal_penguin",
    category: "animal",
    difficulty: 2,
    attributes: {
      alive: true,
      animal: true,
      small: true,
      swims: true,
      has_wings: true,
      flies: false
    },
    en: [
      "penguin",
      ["penguin", "a penguin"],
      [
        "It is a bird.",
        "It is black and white.",
        "It swims very well.",
        "It has wings but cannot fly."
      ]
    ],
    zh: [
      "\u4F01\u9E45",
      ["\u4F01\u9E45", "\u4E00\u53EA\u4F01\u9E45"],
      [
        "\u5B83\u662F\u4E00\u79CD\u9E1F\u3002",
        "\u5B83\u662F\u9ED1\u767D\u76F8\u95F4\u7684\u3002",
        "\u5B83\u5F88\u4F1A\u6E38\u6CF3\u3002",
        "\u5B83\u6709\u7FC5\u8180\u4F46\u4E0D\u4F1A\u98DE\u3002"
      ]
    ],
    es: [
      "ping\xFCino",
      ["ping\xFCino", "un ping\xFCino"],
      [
        "Es un ave.",
        "Es blanco y negro.",
        "Nada muy bien.",
        "Tiene alas pero no vuela."
      ]
    ]
  },
  {
    id: "animal_butterfly",
    category: "animal",
    difficulty: 2,
    attributes: {
      alive: true,
      animal: true,
      small: true,
      flies: true,
      has_wings: true,
      four_legs: false
    },
    en: [
      "butterfly",
      ["butterfly", "a butterfly"],
      [
        "It is small.",
        "It can fly.",
        "It has colourful wings.",
        "It begins life as a caterpillar."
      ]
    ],
    zh: [
      "\u8774\u8776",
      ["\u8774\u8776", "\u4E00\u53EA\u8774\u8776"],
      ["\u5B83\u5F88\u5C0F\u3002", "\u5B83\u4F1A\u98DE\u3002", "\u5B83\u6709\u5F69\u8272\u7684\u7FC5\u8180\u3002", "\u5B83\u5C0F\u65F6\u5019\u662F\u6BDB\u6BDB\u866B\u3002"]
    ],
    es: [
      "mariposa",
      ["mariposa", "una mariposa"],
      [
        "Es peque\xF1a.",
        "Puede volar.",
        "Tiene alas de colores.",
        "Empieza su vida como oruga."
      ]
    ]
  },
  {
    id: "food_apple",
    category: "food",
    difficulty: 1,
    attributes: {
      alive: false,
      edible: true,
      small: true,
      red: true,
      round: true,
      crunchy: true
    },
    en: [
      "apple",
      ["apple", "an apple"],
      [
        "You can eat it.",
        "It grows on a tree.",
        "It can be red or green.",
        "It is round and crunchy."
      ]
    ],
    zh: [
      "\u82F9\u679C",
      ["\u82F9\u679C", "\u4E00\u4E2A\u82F9\u679C"],
      ["\u5B83\u53EF\u4EE5\u5403\u3002", "\u5B83\u957F\u5728\u6811\u4E0A\u3002", "\u5B83\u53EF\u4EE5\u662F\u7EA2\u8272\u6216\u7EFF\u8272\u3002", "\u5B83\u53C8\u5706\u53C8\u8106\u3002"]
    ],
    es: [
      "manzana",
      ["manzana", "una manzana"],
      [
        "Se puede comer.",
        "Crece en un \xE1rbol.",
        "Puede ser roja o verde.",
        "Es redonda y crujiente."
      ]
    ],
    stories: ["snow-white"]
  },
  {
    id: "food_banana",
    category: "food",
    difficulty: 1,
    attributes: {
      alive: false,
      edible: true,
      small: true,
      yellow: true,
      round: false,
      soft: true
    },
    en: [
      "banana",
      ["banana", "a banana"],
      [
        "It is a fruit.",
        "It is soft inside.",
        "It is usually yellow.",
        "Monkeys are famous for liking it."
      ]
    ],
    zh: [
      "\u9999\u8549",
      ["\u9999\u8549", "\u4E00\u6839\u9999\u8549"],
      [
        "\u5B83\u662F\u4E00\u79CD\u6C34\u679C\u3002",
        "\u91CC\u9762\u662F\u8F6F\u7684\u3002",
        "\u5B83\u901A\u5E38\u662F\u9EC4\u8272\u7684\u3002",
        "\u7334\u5B50\u5E38\u88AB\u8BF4\u6210\u559C\u6B22\u5403\u5B83\u3002"
      ]
    ],
    es: [
      "pl\xE1tano",
      ["pl\xE1tano", "banana", "un pl\xE1tano"],
      [
        "Es una fruta.",
        "Es blando por dentro.",
        "Normalmente es amarillo.",
        "A los monos les gusta mucho."
      ]
    ]
  },
  {
    id: "food_carrot",
    category: "food",
    difficulty: 1,
    attributes: {
      alive: false,
      edible: true,
      small: true,
      orange: true,
      round: false,
      crunchy: true
    },
    en: [
      "carrot",
      ["carrot", "a carrot"],
      [
        "It is a vegetable.",
        "It grows underground.",
        "It is orange and crunchy.",
        "Rabbits are famous for eating it."
      ]
    ],
    zh: [
      "\u80E1\u841D\u535C",
      ["\u80E1\u841D\u535C", "\u4E00\u6839\u80E1\u841D\u535C"],
      [
        "\u5B83\u662F\u4E00\u79CD\u852C\u83DC\u3002",
        "\u5B83\u957F\u5728\u5730\u4E0B\u3002",
        "\u5B83\u662F\u6A59\u8272\u800C\u4E14\u5F88\u8106\u3002",
        "\u5154\u5B50\u5E38\u88AB\u8BF4\u6210\u559C\u6B22\u5403\u5B83\u3002"
      ]
    ],
    es: [
      "zanahoria",
      ["zanahoria", "una zanahoria"],
      [
        "Es una verdura.",
        "Crece bajo tierra.",
        "Es naranja y crujiente.",
        "A los conejos les gusta comerla."
      ]
    ]
  },
  {
    id: "food_strawberry",
    category: "food",
    difficulty: 1,
    attributes: {
      alive: false,
      edible: true,
      small: true,
      red: true,
      round: false,
      soft: true
    },
    en: [
      "strawberry",
      ["strawberry", "a strawberry"],
      [
        "It is a fruit.",
        "It is small and sweet.",
        "It is red with tiny seeds outside.",
        "It has green leaves on top."
      ]
    ],
    zh: [
      "\u8349\u8393",
      ["\u8349\u8393", "\u4E00\u9897\u8349\u8393"],
      [
        "\u5B83\u662F\u4E00\u79CD\u6C34\u679C\u3002",
        "\u5B83\u53C8\u5C0F\u53C8\u751C\u3002",
        "\u5B83\u662F\u7EA2\u8272\u7684\uFF0C\u7C7D\u5728\u5916\u9762\u3002",
        "\u5B83\u9876\u90E8\u6709\u7EFF\u8272\u53F6\u5B50\u3002"
      ]
    ],
    es: [
      "fresa",
      ["fresa", "una fresa"],
      [
        "Es una fruta.",
        "Es peque\xF1a y dulce.",
        "Es roja con semillas por fuera.",
        "Tiene hojas verdes arriba."
      ]
    ]
  },
  {
    id: "food_pizza",
    category: "food",
    difficulty: 2,
    attributes: {
      alive: false,
      edible: true,
      big: true,
      round: true,
      soft: true,
      crunchy: false
    },
    en: [
      "pizza",
      ["pizza", "a pizza"],
      [
        "It is food.",
        "It is often round.",
        "It has cheese on top.",
        "It is cut into triangle slices."
      ]
    ],
    zh: [
      "\u62AB\u8428",
      ["\u62AB\u8428", "\u4E00\u4E2A\u62AB\u8428", "\u6BD4\u8428"],
      [
        "\u5B83\u662F\u4E00\u79CD\u98DF\u7269\u3002",
        "\u5B83\u901A\u5E38\u662F\u5706\u7684\u3002",
        "\u4E0A\u9762\u6709\u5976\u916A\u3002",
        "\u5B83\u4F1A\u88AB\u5207\u6210\u4E09\u89D2\u5F62\u3002"
      ]
    ],
    es: [
      "pizza",
      ["pizza", "una pizza"],
      [
        "Es comida.",
        "Suele ser redonda.",
        "Tiene queso encima.",
        "Se corta en trozos triangulares."
      ]
    ]
  },
  {
    id: "toy_teddy_bear",
    category: "toy",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      soft: true,
      animal: false,
      used_at_home: true,
      four_legs: false
    },
    en: [
      "teddy bear",
      ["teddy bear", "a teddy bear", "toy bear"],
      [
        "It is a toy.",
        "It is soft.",
        "You can cuddle it.",
        "It looks like a bear."
      ]
    ],
    zh: [
      "\u6CF0\u8FEA\u718A",
      ["\u6CF0\u8FEA\u718A", "\u73A9\u5177\u718A", "\u4E00\u53EA\u73A9\u5177\u718A"],
      ["\u5B83\u662F\u4E00\u4E2A\u73A9\u5177\u3002", "\u5B83\u5F88\u67D4\u8F6F\u3002", "\u4F60\u53EF\u4EE5\u62B1\u7740\u5B83\u3002", "\u5B83\u770B\u8D77\u6765\u50CF\u4E00\u53EA\u718A\u3002"]
    ],
    es: [
      "osito de peluche",
      ["osito de peluche", "oso de peluche", "un osito de peluche"],
      ["Es un juguete.", "Es suave.", "Puedes abrazarlo.", "Parece un oso."]
    ]
  },
  {
    id: "toy_ball",
    category: "toy",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      round: true,
      soft: false,
      used_at_home: true,
      has_wheels: false
    },
    en: [
      "ball",
      ["ball", "a ball"],
      [
        "You play with it.",
        "It can bounce.",
        "You can throw or kick it.",
        "It is round."
      ]
    ],
    zh: [
      "\u7403",
      ["\u7403", "\u4E00\u4E2A\u7403"],
      ["\u4F60\u53EF\u4EE5\u7528\u5B83\u73A9\u3002", "\u5B83\u53EF\u4EE5\u5F39\u8D77\u6765\u3002", "\u4F60\u53EF\u4EE5\u6254\u5B83\u6216\u8E22\u5B83\u3002", "\u5B83\u662F\u5706\u7684\u3002"]
    ],
    es: [
      "pelota",
      ["pelota", "bal\xF3n", "una pelota"],
      [
        "Juegas con ella.",
        "Puede rebotar.",
        "Puedes lanzarla o patearla.",
        "Es redonda."
      ]
    ]
  },
  {
    id: "toy_kite",
    category: "toy",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      flies: true,
      has_wings: false,
      used_at_home: false,
      soft: false
    },
    en: [
      "kite",
      ["kite", "a kite"],
      [
        "It is a toy.",
        "You use it outside.",
        "A string keeps it with you.",
        "The wind makes it fly."
      ]
    ],
    zh: [
      "\u98CE\u7B5D",
      ["\u98CE\u7B5D", "\u4E00\u4E2A\u98CE\u7B5D"],
      ["\u5B83\u662F\u4E00\u4E2A\u73A9\u5177\u3002", "\u4F60\u5728\u6237\u5916\u73A9\u5B83\u3002", "\u4F60\u7528\u7EBF\u7275\u7740\u5B83\u3002", "\u98CE\u8BA9\u5B83\u98DE\u8D77\u6765\u3002"]
    ],
    es: [
      "cometa",
      ["cometa", "una cometa"],
      [
        "Es un juguete.",
        "Se usa afuera.",
        "Una cuerda la mantiene contigo.",
        "El viento la hace volar."
      ]
    ]
  },
  {
    id: "toy_blocks",
    category: "toy",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      round: false,
      soft: false,
      used_at_home: true,
      has_wheels: false
    },
    en: [
      "building blocks",
      ["building blocks", "blocks", "toy blocks"],
      [
        "They are toys.",
        "They come in many colours.",
        "You stack them.",
        "You can build towers with them."
      ]
    ],
    zh: [
      "\u79EF\u6728",
      ["\u79EF\u6728", "\u73A9\u5177\u79EF\u6728"],
      [
        "\u5B83\u4EEC\u662F\u73A9\u5177\u3002",
        "\u5B83\u4EEC\u6709\u5F88\u591A\u989C\u8272\u3002",
        "\u4F60\u53EF\u4EE5\u628A\u5B83\u4EEC\u53E0\u8D77\u6765\u3002",
        "\u4F60\u53EF\u4EE5\u7528\u5B83\u4EEC\u642D\u9AD8\u5854\u3002"
      ]
    ],
    es: [
      "bloques",
      ["bloques", "bloques de construcci\xF3n", "bloques de juguete"],
      [
        "Son juguetes.",
        "Tienen muchos colores.",
        "Los apilas.",
        "Puedes construir torres con ellos."
      ]
    ]
  },
  {
    id: "toy_doll",
    category: "toy",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      soft: false,
      used_at_home: true,
      animal: false,
      has_wheels: false
    },
    en: [
      "doll",
      ["doll", "a doll"],
      [
        "It is a toy.",
        "It can wear tiny clothes.",
        "It looks like a person.",
        "Children make stories while playing with it."
      ]
    ],
    zh: [
      "\u73A9\u5076",
      ["\u73A9\u5076", "\u5A03\u5A03", "\u4E00\u4E2A\u73A9\u5076"],
      [
        "\u5B83\u662F\u4E00\u4E2A\u73A9\u5177\u3002",
        "\u5B83\u53EF\u4EE5\u7A7F\u5C0F\u8863\u670D\u3002",
        "\u5B83\u770B\u8D77\u6765\u50CF\u4EBA\u3002",
        "\u5B69\u5B50\u4EEC\u4F1A\u7528\u5B83\u6765\u7F16\u6545\u4E8B\u3002"
      ]
    ],
    es: [
      "mu\xF1eca",
      ["mu\xF1eca", "una mu\xF1eca"],
      [
        "Es un juguete.",
        "Puede llevar ropa peque\xF1a.",
        "Parece una persona.",
        "Los ni\xF1os inventan historias con ella."
      ]
    ]
  },
  {
    id: "home_chair",
    category: "home",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      used_at_home: true,
      four_legs: true,
      soft: false,
      has_wheels: false
    },
    en: [
      "chair",
      ["chair", "a chair"],
      [
        "You find it at home.",
        "It often has four legs.",
        "It has a back.",
        "You sit on it."
      ]
    ],
    zh: [
      "\u6905\u5B50",
      ["\u6905\u5B50", "\u4E00\u628A\u6905\u5B50"],
      [
        "\u4F60\u5728\u5BB6\u91CC\u80FD\u627E\u5230\u5B83\u3002",
        "\u5B83\u901A\u5E38\u6709\u56DB\u6761\u817F\u3002",
        "\u5B83\u6709\u9760\u80CC\u3002",
        "\u4F60\u5750\u5728\u5B83\u4E0A\u9762\u3002"
      ]
    ],
    es: [
      "silla",
      ["silla", "una silla"],
      [
        "La encuentras en casa.",
        "Suele tener cuatro patas.",
        "Tiene respaldo.",
        "Te sientas en ella."
      ]
    ]
  },
  {
    id: "home_spoon",
    category: "home",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      used_at_home: true,
      round: false,
      soft: false,
      edible: false
    },
    en: [
      "spoon",
      ["spoon", "a spoon"],
      [
        "You find it in a kitchen.",
        "It is small.",
        "It has a handle.",
        "You use it to eat soup."
      ]
    ],
    zh: [
      "\u52FA\u5B50",
      ["\u52FA\u5B50", "\u6C64\u5319", "\u4E00\u628A\u52FA\u5B50"],
      ["\u4F60\u5728\u53A8\u623F\u91CC\u80FD\u627E\u5230\u5B83\u3002", "\u5B83\u5F88\u5C0F\u3002", "\u5B83\u6709\u4E00\u4E2A\u67C4\u3002", "\u4F60\u7528\u5B83\u559D\u6C64\u3002"]
    ],
    es: [
      "cuchara",
      ["cuchara", "una cuchara"],
      [
        "La encuentras en la cocina.",
        "Es peque\xF1a.",
        "Tiene un mango.",
        "La usas para comer sopa."
      ]
    ]
  },
  {
    id: "home_toothbrush",
    category: "home",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      used_at_home: true,
      soft: false,
      edible: false,
      round: false
    },
    en: [
      "toothbrush",
      ["toothbrush", "a toothbrush"],
      [
        "You use it at home.",
        "It has a handle.",
        "It has little bristles.",
        "It cleans your teeth."
      ]
    ],
    zh: [
      "\u7259\u5237",
      ["\u7259\u5237", "\u4E00\u628A\u7259\u5237"],
      ["\u4F60\u5728\u5BB6\u91CC\u7528\u5B83\u3002", "\u5B83\u6709\u4E00\u4E2A\u67C4\u3002", "\u5B83\u6709\u5C0F\u5237\u6BDB\u3002", "\u5B83\u7528\u6765\u6E05\u6D01\u7259\u9F7F\u3002"]
    ],
    es: [
      "cepillo de dientes",
      ["cepillo de dientes", "un cepillo de dientes"],
      [
        "Lo usas en casa.",
        "Tiene un mango.",
        "Tiene cerdas peque\xF1as.",
        "Limpia tus dientes."
      ]
    ]
  },
  {
    id: "home_clock",
    category: "home",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      used_at_home: true,
      round: true,
      soft: false,
      edible: false
    },
    en: [
      "clock",
      ["clock", "a clock"],
      [
        "You often see it at home.",
        "It may be round.",
        "It has numbers.",
        "It tells you the time."
      ]
    ],
    zh: [
      "\u65F6\u949F",
      ["\u65F6\u949F", "\u949F", "\u4E00\u4E2A\u65F6\u949F"],
      [
        "\u4F60\u5E38\u5728\u5BB6\u91CC\u770B\u5230\u5B83\u3002",
        "\u5B83\u53EF\u80FD\u662F\u5706\u7684\u3002",
        "\u5B83\u4E0A\u9762\u6709\u6570\u5B57\u3002",
        "\u5B83\u544A\u8BC9\u4F60\u65F6\u95F4\u3002"
      ]
    ],
    es: [
      "reloj",
      ["reloj", "un reloj"],
      [
        "Lo ves a menudo en casa.",
        "Puede ser redondo.",
        "Tiene n\xFAmeros.",
        "Te dice la hora."
      ]
    ]
  },
  {
    id: "home_pillow",
    category: "home",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      used_at_home: true,
      soft: true,
      round: false,
      edible: false
    },
    en: [
      "pillow",
      ["pillow", "a pillow"],
      [
        "You find it at home.",
        "It is soft.",
        "It goes on a bed.",
        "You rest your head on it."
      ]
    ],
    zh: [
      "\u6795\u5934",
      ["\u6795\u5934", "\u4E00\u4E2A\u6795\u5934"],
      ["\u4F60\u5728\u5BB6\u91CC\u80FD\u627E\u5230\u5B83\u3002", "\u5B83\u5F88\u67D4\u8F6F\u3002", "\u5B83\u653E\u5728\u5E8A\u4E0A\u3002", "\u4F60\u628A\u5934\u9760\u5728\u4E0A\u9762\u3002"]
    ],
    es: [
      "almohada",
      ["almohada", "una almohada"],
      [
        "La encuentras en casa.",
        "Es suave.",
        "Va sobre la cama.",
        "Apoyas la cabeza en ella."
      ]
    ]
  },
  {
    id: "transport_bicycle",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      has_wheels: true,
      used_at_home: false,
      flies: false,
      swims: false
    },
    en: [
      "bicycle",
      ["bicycle", "bike", "a bicycle", "a bike"],
      [
        "It takes you places.",
        "It has two wheels.",
        "You use pedals.",
        "You wear a helmet when riding it."
      ]
    ],
    zh: [
      "\u81EA\u884C\u8F66",
      ["\u81EA\u884C\u8F66", "\u5355\u8F66", "\u4E00\u8F86\u81EA\u884C\u8F66"],
      [
        "\u5B83\u53EF\u4EE5\u5E26\u4F60\u53BB\u522B\u7684\u5730\u65B9\u3002",
        "\u5B83\u6709\u4E24\u4E2A\u8F6E\u5B50\u3002",
        "\u4F60\u8981\u8E29\u8E0F\u677F\u3002",
        "\u9A91\u5B83\u65F6\u8981\u6234\u5934\u76D4\u3002"
      ]
    ],
    es: [
      "bicicleta",
      ["bicicleta", "bici", "una bicicleta"],
      [
        "Te lleva a lugares.",
        "Tiene dos ruedas.",
        "Usas pedales.",
        "Llevas casco para montarla."
      ]
    ]
  },
  {
    id: "transport_bus",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      has_wheels: true,
      used_at_home: false,
      flies: false,
      swims: false
    },
    en: [
      "bus",
      ["bus", "a bus"],
      [
        "It is a vehicle.",
        "It is big.",
        "Many people ride together.",
        "It stops to pick up passengers."
      ]
    ],
    zh: [
      "\u516C\u5171\u6C7D\u8F66",
      ["\u516C\u5171\u6C7D\u8F66", "\u516C\u4EA4\u8F66", "\u4E00\u8F86\u516C\u4EA4\u8F66"],
      [
        "\u5B83\u662F\u4E00\u79CD\u4EA4\u901A\u5DE5\u5177\u3002",
        "\u5B83\u5F88\u5927\u3002",
        "\u5F88\u591A\u4EBA\u4E00\u8D77\u4E58\u5750\u3002",
        "\u5B83\u4F1A\u505C\u4E0B\u6765\u63A5\u4E58\u5BA2\u3002"
      ]
    ],
    es: [
      "autob\xFAs",
      ["autob\xFAs", "bus", "un autob\xFAs"],
      [
        "Es un veh\xEDculo.",
        "Es grande.",
        "Muchas personas viajan juntas.",
        "Se detiene para recoger pasajeros."
      ]
    ]
  },
  {
    id: "transport_train",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      has_wheels: true,
      used_at_home: false,
      flies: false,
      swims: false
    },
    en: [
      "train",
      ["train", "a train"],
      [
        "It carries people.",
        "It is very long.",
        "Its carriages join together.",
        "It travels on tracks."
      ]
    ],
    zh: [
      "\u706B\u8F66",
      ["\u706B\u8F66", "\u4E00\u5217\u706B\u8F66"],
      ["\u5B83\u53EF\u4EE5\u8F7D\u4EBA\u3002", "\u5B83\u5F88\u957F\u3002", "\u8F66\u53A2\u8FDE\u63A5\u5728\u4E00\u8D77\u3002", "\u5B83\u5728\u94C1\u8F68\u4E0A\u884C\u9A76\u3002"]
    ],
    es: [
      "tren",
      ["tren", "un tren"],
      [
        "Lleva personas.",
        "Es muy largo.",
        "Sus vagones est\xE1n unidos.",
        "Viaja por v\xEDas."
      ]
    ]
  },
  {
    id: "transport_airplane",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      has_wheels: true,
      flies: true,
      has_wings: true,
      swims: false
    },
    en: [
      "airplane",
      ["airplane", "aeroplane", "plane", "an airplane"],
      [
        "It is a vehicle.",
        "It is very big.",
        "It has wings.",
        "It flies high in the sky."
      ]
    ],
    zh: [
      "\u98DE\u673A",
      ["\u98DE\u673A", "\u4E00\u67B6\u98DE\u673A"],
      ["\u5B83\u662F\u4E00\u79CD\u4EA4\u901A\u5DE5\u5177\u3002", "\u5B83\u5F88\u5927\u3002", "\u5B83\u6709\u7FC5\u8180\u3002", "\u5B83\u5728\u9AD8\u7A7A\u98DE\u884C\u3002"]
    ],
    es: [
      "avi\xF3n",
      ["avi\xF3n", "un avi\xF3n"],
      [
        "Es un veh\xEDculo.",
        "Es muy grande.",
        "Tiene alas.",
        "Vuela alto en el cielo."
      ]
    ]
  },
  {
    id: "transport_boat",
    category: "transport",
    difficulty: 1,
    attributes: {
      alive: false,
      big: true,
      swims: true,
      has_wheels: false,
      flies: false,
      used_at_home: false
    },
    en: [
      "boat",
      ["boat", "a boat", "ship"],
      [
        "It carries people or things.",
        "It has no road wheels.",
        "It floats.",
        "It travels on water."
      ]
    ],
    zh: [
      "\u8239",
      ["\u8239", "\u5C0F\u8239", "\u4E00\u8258\u8239"],
      [
        "\u5B83\u53EF\u4EE5\u8F7D\u4EBA\u6216\u7269\u54C1\u3002",
        "\u5B83\u6CA1\u6709\u516C\u8DEF\u8F6E\u5B50\u3002",
        "\u5B83\u4F1A\u6F02\u6D6E\u3002",
        "\u5B83\u5728\u6C34\u4E0A\u884C\u9A76\u3002"
      ]
    ],
    es: [
      "barco",
      ["barco", "bote", "un barco"],
      [
        "Lleva personas o cosas.",
        "No tiene ruedas de carretera.",
        "Flota.",
        "Viaja por el agua."
      ]
    ]
  },
  {
    id: "fairy_magic_wand",
    category: "fairy_tale",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      magical: true,
      from_a_story: true,
      used_at_home: false,
      soft: false
    },
    en: [
      "magic wand",
      ["magic wand", "a magic wand", "wand"],
      [
        "It appears in stories.",
        "It is small enough to hold.",
        "A fairy or wizard may use it.",
        "It can cast magic spells."
      ]
    ],
    zh: [
      "\u9B54\u6CD5\u68D2",
      ["\u9B54\u6CD5\u68D2", "\u9B54\u6756", "\u4E00\u6839\u9B54\u6CD5\u68D2"],
      [
        "\u5B83\u4F1A\u51FA\u73B0\u5728\u6545\u4E8B\u91CC\u3002",
        "\u5B83\u53EF\u4EE5\u62FF\u5728\u624B\u91CC\u3002",
        "\u4ED9\u5973\u6216\u5DEB\u5E08\u4F1A\u4F7F\u7528\u5B83\u3002",
        "\u5B83\u53EF\u4EE5\u65BD\u9B54\u6CD5\u3002"
      ]
    ],
    es: [
      "varita m\xE1gica",
      ["varita m\xE1gica", "varita", "una varita m\xE1gica"],
      [
        "Aparece en cuentos.",
        "Cabe en una mano.",
        "La usa un hada o un mago.",
        "Puede hacer hechizos."
      ]
    ]
  },
  {
    id: "fairy_crown",
    category: "fairy_tale",
    difficulty: 1,
    attributes: {
      alive: false,
      small: true,
      magical: false,
      from_a_story: true,
      used_at_home: false,
      round: true
    },
    en: [
      "crown",
      ["crown", "a crown"],
      [
        "You see it in many stories.",
        "It can be shiny and golden.",
        "It sits on a head.",
        "A king or queen wears it."
      ]
    ],
    zh: [
      "\u738B\u51A0",
      ["\u738B\u51A0", "\u7687\u51A0", "\u4E00\u9876\u738B\u51A0"],
      [
        "\u5F88\u591A\u6545\u4E8B\u91CC\u90FD\u6709\u5B83\u3002",
        "\u5B83\u53EF\u80FD\u91D1\u5149\u95EA\u95EA\u3002",
        "\u5B83\u6234\u5728\u5934\u4E0A\u3002",
        "\u56FD\u738B\u6216\u738B\u540E\u4F1A\u6234\u5B83\u3002"
      ]
    ],
    es: [
      "corona",
      ["corona", "una corona"],
      [
        "Aparece en muchos cuentos.",
        "Puede ser dorada y brillante.",
        "Se lleva en la cabeza.",
        "La usa un rey o una reina."
      ]
    ]
  },
  {
    id: "fairy_glass_slipper",
    category: "fairy_tale",
    difficulty: 2,
    attributes: {
      alive: false,
      small: true,
      magical: true,
      from_a_story: true,
      used_at_home: false,
      soft: false
    },
    en: [
      "glass slipper",
      ["glass slipper", "a glass slipper", "Cinderella's slipper"],
      [
        "It comes from a fairy tale.",
        "It is worn on a foot.",
        "It looks like glass.",
        "Cinderella leaves one behind."
      ]
    ],
    zh: [
      "\u6C34\u6676\u978B",
      ["\u6C34\u6676\u978B", "\u4E00\u53EA\u6C34\u6676\u978B", "\u7070\u59D1\u5A18\u7684\u6C34\u6676\u978B"],
      [
        "\u5B83\u6765\u81EA\u7AE5\u8BDD\u6545\u4E8B\u3002",
        "\u5B83\u7A7F\u5728\u811A\u4E0A\u3002",
        "\u5B83\u770B\u8D77\u6765\u50CF\u6C34\u6676\u3002",
        "\u7070\u59D1\u5A18\u843D\u4E0B\u4E86\u4E00\u53EA\u3002"
      ]
    ],
    es: [
      "zapatilla de cristal",
      [
        "zapatilla de cristal",
        "zapato de cristal",
        "la zapatilla de Cenicienta"
      ],
      [
        "Viene de un cuento.",
        "Se lleva en el pie.",
        "Parece de cristal.",
        "Cenicienta deja una atr\xE1s."
      ]
    ]
  },
  {
    id: "fairy_magic_mirror",
    category: "fairy_tale",
    difficulty: 2,
    attributes: {
      alive: false,
      big: true,
      magical: true,
      from_a_story: true,
      used_at_home: true,
      round: false
    },
    en: [
      "magic mirror",
      ["magic mirror", "a magic mirror", "mirror"],
      [
        "A normal one can be at home.",
        "You see your reflection in it.",
        "This one can talk.",
        "The Queen asks it questions in Snow White."
      ]
    ],
    zh: [
      "\u9B54\u955C",
      ["\u9B54\u955C", "\u4E00\u9762\u9B54\u955C", "\u955C\u5B50"],
      [
        "\u666E\u901A\u7684\u955C\u5B50\u53EF\u4EE5\u5728\u5BB6\u91CC\u627E\u5230\u3002",
        "\u4F60\u80FD\u5728\u91CC\u9762\u770B\u5230\u81EA\u5DF1\u3002",
        "\u8FD9\u9762\u955C\u5B50\u4F1A\u8BF4\u8BDD\u3002",
        "\u300A\u767D\u96EA\u516C\u4E3B\u300B\u91CC\u7684\u738B\u540E\u4F1A\u95EE\u5B83\u95EE\u9898\u3002"
      ]
    ],
    es: [
      "espejo m\xE1gico",
      ["espejo m\xE1gico", "un espejo m\xE1gico", "espejo"],
      [
        "Uno normal puede estar en casa.",
        "Ves tu reflejo en \xE9l.",
        "Este puede hablar.",
        "La Reina le hace preguntas en Blancanieves."
      ]
    ],
    stories: ["snow-white"]
  },
  {
    id: "fairy_pirate_ship",
    category: "fairy_tale",
    difficulty: 2,
    attributes: {
      alive: false,
      big: true,
      from_a_story: true,
      swims: true,
      has_wheels: false,
      flies: false
    },
    en: [
      "pirate ship",
      ["pirate ship", "a pirate ship", "Captain Hook's ship"],
      [
        "It is very big.",
        "It travels on water.",
        "Pirates sail in it.",
        "Captain Hook has one in Peter Pan."
      ]
    ],
    zh: [
      "\u6D77\u76D7\u8239",
      ["\u6D77\u76D7\u8239", "\u4E00\u8258\u6D77\u76D7\u8239", "\u864E\u514B\u8239\u957F\u7684\u8239"],
      [
        "\u5B83\u5F88\u5927\u3002",
        "\u5B83\u5728\u6C34\u4E0A\u884C\u9A76\u3002",
        "\u6D77\u76D7\u4E58\u5750\u5B83\u822A\u884C\u3002",
        "\u300A\u5F7C\u5F97\xB7\u6F58\u300B\u91CC\u7684\u864E\u514B\u8239\u957F\u6709\u4E00\u8258\u3002"
      ]
    ],
    es: [
      "barco pirata",
      ["barco pirata", "un barco pirata", "el barco del Capit\xE1n Garfio"],
      [
        "Es muy grande.",
        "Viaja por el agua.",
        "Los piratas navegan en \xE9l.",
        "El Capit\xE1n Garfio tiene uno en Peter Pan."
      ]
    ],
    stories: ["peter-pan"]
  }
];
var colorFacts = {
  animal_elephant: {
    en: "It is usually gray.",
    zh: "\u5B83\u901A\u5E38\u662F\u7070\u8272\u7684\u3002",
    es: "Suele ser gris."
  },
  animal_lion: {
    en: "It is usually golden brown.",
    zh: "\u5B83\u901A\u5E38\u662F\u91D1\u68D5\u8272\u7684\u3002",
    es: "Suele ser marr\xF3n dorado."
  },
  animal_giraffe: {
    en: "It is yellow or tan with brown patches.",
    zh: "\u5B83\u662F\u9EC4\u8272\u6216\u6D45\u68D5\u8272\u7684\uFF0C\u8EAB\u4E0A\u6709\u68D5\u8272\u6591\u5757\u3002",
    es: "Es amarilla o beige con manchas marrones."
  },
  animal_penguin: {
    en: "It is black and white.",
    zh: "\u5B83\u662F\u9ED1\u767D\u76F8\u95F4\u7684\u3002",
    es: "Es blanco y negro."
  },
  animal_butterfly: {
    en: "Its wings can have many bright colours.",
    zh: "\u5B83\u7684\u7FC5\u8180\u53EF\u4EE5\u6709\u8BB8\u591A\u9C9C\u8273\u7684\u989C\u8272\u3002",
    es: "Sus alas pueden tener muchos colores vivos."
  },
  food_apple: {
    en: "It can be red or green.",
    zh: "\u5B83\u53EF\u4EE5\u662F\u7EA2\u8272\u6216\u7EFF\u8272\u7684\u3002",
    es: "Puede ser roja o verde."
  },
  food_banana: {
    en: "It is yellow when it is ready to eat.",
    zh: "\u6210\u719F\u53EF\u4EE5\u5403\u7684\u65F6\u5019\uFF0C\u5B83\u662F\u9EC4\u8272\u7684\u3002",
    es: "Es amarilla cuando est\xE1 lista para comer."
  },
  food_carrot: {
    en: "It is usually orange.",
    zh: "\u5B83\u901A\u5E38\u662F\u6A59\u8272\u7684\u3002",
    es: "Suele ser naranja."
  },
  food_strawberry: {
    en: "It is red with tiny yellow seeds.",
    zh: "\u5B83\u662F\u7EA2\u8272\u7684\uFF0C\u4E0A\u9762\u6709\u5C0F\u5C0F\u7684\u9EC4\u8272\u79CD\u5B50\u3002",
    es: "Es roja con peque\xF1as semillas amarillas."
  },
  food_pizza: {
    en: "It has several colours, often red, yellow, and golden brown.",
    zh: "\u5B83\u6709\u597D\u51E0\u79CD\u989C\u8272\uFF0C\u5E38\u89C1\u7684\u662F\u7EA2\u8272\u3001\u9EC4\u8272\u548C\u91D1\u68D5\u8272\u3002",
    es: "Tiene varios colores, a menudo rojo, amarillo y marr\xF3n dorado."
  },
  toy_teddy_bear: {
    en: "It is often brown, but it can be other colours too.",
    zh: "\u5B83\u5E38\u5E38\u662F\u68D5\u8272\u7684\uFF0C\u4E5F\u53EF\u4EE5\u662F\u5176\u4ED6\u989C\u8272\u3002",
    es: "Suele ser marr\xF3n, pero tambi\xE9n puede tener otros colores."
  },
  toy_ball: {
    en: "It can be almost any colour.",
    zh: "\u5B83\u51E0\u4E4E\u53EF\u4EE5\u662F\u4EFB\u4F55\u989C\u8272\u3002",
    es: "Puede ser de casi cualquier color."
  },
  toy_kite: {
    en: "It can have many bright colours.",
    zh: "\u5B83\u53EF\u4EE5\u6709\u8BB8\u591A\u9C9C\u8273\u7684\u989C\u8272\u3002",
    es: "Puede tener muchos colores vivos."
  },
  toy_blocks: {
    en: "They usually come in many bright colours.",
    zh: "\u5B83\u4EEC\u901A\u5E38\u6709\u8BB8\u591A\u9C9C\u8273\u7684\u989C\u8272\u3002",
    es: "Suelen venir en muchos colores vivos."
  },
  toy_doll: {
    en: "It can have many different colours.",
    zh: "\u5B83\u53EF\u4EE5\u6709\u8BB8\u591A\u4E0D\u540C\u7684\u989C\u8272\u3002",
    es: "Puede tener muchos colores diferentes."
  },
  home_chair: {
    en: "It can be many different colours.",
    zh: "\u5B83\u53EF\u4EE5\u662F\u8BB8\u591A\u4E0D\u540C\u7684\u989C\u8272\u3002",
    es: "Puede ser de muchos colores diferentes."
  },
  home_spoon: {
    en: "It is often shiny silver, though some are colourful.",
    zh: "\u5B83\u5E38\u5E38\u662F\u95EA\u4EAE\u7684\u94F6\u8272\uFF0C\u6709\u4E9B\u4E5F\u6709\u5F69\u8272\u3002",
    es: "Suele ser plateada y brillante, aunque algunas tienen colores."
  },
  home_toothbrush: {
    en: "It can be many bright colours.",
    zh: "\u5B83\u53EF\u4EE5\u662F\u8BB8\u591A\u9C9C\u8273\u7684\u989C\u8272\u3002",
    es: "Puede ser de muchos colores vivos."
  },
  home_clock: {
    en: "It can be many different colours.",
    zh: "\u5B83\u53EF\u4EE5\u662F\u8BB8\u591A\u4E0D\u540C\u7684\u989C\u8272\u3002",
    es: "Puede ser de muchos colores diferentes."
  },
  home_pillow: {
    en: "It can be almost any colour.",
    zh: "\u5B83\u51E0\u4E4E\u53EF\u4EE5\u662F\u4EFB\u4F55\u989C\u8272\u3002",
    es: "Puede ser de casi cualquier color."
  },
  transport_bicycle: {
    en: "It can be many different colours.",
    zh: "\u5B83\u53EF\u4EE5\u662F\u8BB8\u591A\u4E0D\u540C\u7684\u989C\u8272\u3002",
    es: "Puede ser de muchos colores diferentes."
  },
  transport_bus: {
    en: "It can be many colours, such as yellow, red, blue, or white.",
    zh: "\u5B83\u53EF\u4EE5\u6709\u8BB8\u591A\u989C\u8272\uFF0C\u6BD4\u5982\u9EC4\u8272\u3001\u7EA2\u8272\u3001\u84DD\u8272\u6216\u767D\u8272\u3002",
    es: "Puede ser de muchos colores, como amarillo, rojo, azul o blanco."
  },
  transport_train: {
    en: "It can be many different colours.",
    zh: "\u5B83\u53EF\u4EE5\u662F\u8BB8\u591A\u4E0D\u540C\u7684\u989C\u8272\u3002",
    es: "Puede ser de muchos colores diferentes."
  },
  transport_airplane: {
    en: "It is often white with coloured markings.",
    zh: "\u5B83\u5E38\u5E38\u662F\u767D\u8272\u7684\uFF0C\u4E0A\u9762\u6709\u5F69\u8272\u6807\u8BB0\u3002",
    es: "Suele ser blanco con detalles de colores."
  },
  transport_boat: {
    en: "It can be many different colours.",
    zh: "\u5B83\u53EF\u4EE5\u662F\u8BB8\u591A\u4E0D\u540C\u7684\u989C\u8272\u3002",
    es: "Puede ser de muchos colores diferentes."
  },
  fairy_magic_wand: {
    en: "It is often gold, silver, or sparkly.",
    zh: "\u5B83\u5E38\u5E38\u662F\u91D1\u8272\u3001\u94F6\u8272\u6216\u95EA\u95EA\u53D1\u5149\u7684\u3002",
    es: "Suele ser dorada, plateada o brillante."
  },
  fairy_crown: {
    en: "It is usually gold and may have colourful jewels.",
    zh: "\u5B83\u901A\u5E38\u662F\u91D1\u8272\u7684\uFF0C\u4E5F\u53EF\u80FD\u6709\u5F69\u8272\u5B9D\u77F3\u3002",
    es: "Suele ser dorada y puede tener joyas de colores."
  },
  fairy_glass_slipper: {
    en: "It is clear and shiny like glass.",
    zh: "\u5B83\u50CF\u73BB\u7483\u4E00\u6837\u900F\u660E\u53C8\u95EA\u4EAE\u3002",
    es: "Es transparente y brillante como el cristal."
  },
  fairy_magic_mirror: {
    en: "It is shiny silver, often with a gold frame.",
    zh: "\u5B83\u662F\u95EA\u4EAE\u7684\u94F6\u8272\uFF0C\u5E38\u5E38\u6709\u91D1\u8272\u8FB9\u6846\u3002",
    es: "Es plateado y brillante, a menudo con un marco dorado."
  },
  fairy_pirate_ship: {
    en: "It is mostly brown like wood, often with dark sails.",
    zh: "\u5B83\u4E3B\u8981\u662F\u6728\u5934\u4E00\u6837\u7684\u68D5\u8272\uFF0C\u5E38\u5E38\u914D\u6709\u6DF1\u8272\u8239\u5E06\u3002",
    es: "Es principalmente marr\xF3n como la madera, a menudo con velas oscuras."
  }
};
function toAnswer(seed) {
  const approvedColorFacts = colorFacts[seed.id];
  if (!approvedColorFacts) {
    throw new Error(`Missing approved color facts for ${seed.id}`);
  }
  const localized = Object.fromEntries(
    ["en", "zh", "es"].map((language) => {
      const [canonical, aliases, hints] = seed[language];
      return [
        language,
        {
          canonical,
          aliases,
          hints,
          facts: { color: approvedColorFacts[language] }
        }
      ];
    })
  );
  return answerObjectSchema.parse({
    id: seed.id,
    category: seed.category,
    minimumAge: 4,
    difficulty: seed.difficulty,
    attributes: seed.attributes,
    localized,
    storyConnections: seed.stories ?? []
  });
}
var THINK_GUESS_ANSWERS = seeds.map(toAnswer);
function validateAnswerLibrary(answers = THINK_GUESS_ANSWERS) {
  if (answers.length !== 30) {
    throw new Error(
      `The pilot library must contain 30 answers; found ${answers.length}`
    );
  }
  const ids = /* @__PURE__ */ new Set();
  for (const answer of answers) {
    answerObjectSchema.parse(answer);
    if (ids.has(answer.id))
      throw new Error(`Duplicate answer id: ${answer.id}`);
    ids.add(answer.id);
    if (answer.attributes.big && answer.attributes.small) {
      throw new Error(`${answer.id} cannot be both big and small`);
    }
    if (answer.category === "animal" && answer.attributes.flies && answer.attributes.has_wings === false) {
      throw new Error(
        `${answer.id} cannot fly while explicitly having no wings`
      );
    }
    if (answer.category === "animal" && answer.attributes.animal !== true) {
      throw new Error(`${answer.id} must be marked as an animal`);
    }
    if (answer.category === "food" && answer.attributes.edible !== true) {
      throw new Error(`${answer.id} must be marked as edible`);
    }
    for (const language of ["en", "zh", "es"]) {
      const localized = answer.localized[language];
      const normalized = localized.aliases.map(
        (alias) => alias.trim().toLocaleLowerCase()
      );
      if (!normalized.includes(localized.canonical.toLocaleLowerCase())) {
        throw new Error(
          `${answer.id}.${language} aliases must include its canonical answer`
        );
      }
      if (new Set(normalized).size !== normalized.length) {
        throw new Error(`${answer.id}.${language} contains duplicate aliases`);
      }
    }
  }
}
validateAnswerLibrary();

// server/thinkGuess/thinkGuessPrompt.ts
import OpenAI2 from "openai";
var THINK_GUESS_AI_PROMPT = `# ROLE
You are the conversational brain for StoryLingo's Think & Guess voice game for children ages 4\u20137. The child asks questions to discover a secret object. Make the exchange feel spontaneous, warm, funny when appropriate, and genuinely responsive.

The target language for this session is {{target_language}}.

# LEARNING GOAL
Help the child practise deductive thinking. Every yes confirms something. Every no rules something out. An incorrect guess is useful progress, never failure. Help the child connect clues and gradually ask more informative questions without sounding like a teacher or quiz host.

# PRIVATE GAME STATE
The application sends one JSON object for the current turn. It contains the child's latest words, the secret object, approved attributes and seed facts, earlier discoveries, turn state, and mechanical outcome.

The secretObject is private. Never mention its canonicalAnswer before answerMayBeNamed is true. Do not disclose its category unless categoryMayBeNamed is true or that category already appears in knownClues. The mechanical outcome, turn count, reveal permission, stop state, and solved state are fixed. Do not change them.

Use currentFact for its meaning, not its wording. You may phrase it naturally and connect it to earlier clues. You may use stable, ordinary knowledge about the secret object to answer a child's natural follow-up or create a fresh clue, but never contradict the supplied attributes or seed facts. If a fact is genuinely uncertain or varies in real life, say so simply instead of pretending certainty.

# CONVERSATION BEHAVIOUR
- Answer the child's actual question first. Never replace the requested answer with a recap of an older clue.
- Create your own child-friendly wording rather than relying on stock response templates.
- For a useful question, show briefly how the answer narrows the mystery when that connection is helpful.
- For an incorrect guess, respond lightly and show what was learned. Do not say or imply that the child is doing badly.
- For a hint, create one fresh clue from a new angle. Do not repeat a clue already in knownClues, and do not name the answer.
- For dont_know or repeated random guesses, offer one concrete, easy next question.
- For unclear speech, ask for one friendly retry and add no new clue.
- For off-topic speech, acknowledge it lightly and guide the child back in one sentence.
- For repeat, repeat previousReply faithfully; a short natural lead-in is allowed.
- For stopped, accept immediately and do not continue the game.
- For solved, answer_revealed, or turn_limit_reveal, name the supplied canonicalAnswer and celebrate the reasoning journey rather than a score.
- For reveal_locked, do not name the answer. Explain briefly that a few more clues come first.

# PROGRESSION
- discover, turns 1\u20133: keep support light and let the child lead.
- connect, turns 4\u20136: sometimes connect the new discovery to one earlier clue.
- coach, turns 7\u20138: suggest one useful question or reasoning step when needed.
- narrow, turn 9: help the child compare the strongest possibilities without revealing the answer.
- resolve, turn 10: warmly reveal the answer and mention how the clues helped.

# VOICE AND TONE
Speak in {{target_language}}, even when the child mixes languages. Use vocabulary suitable for the supplied languageLevel while keeping the reasoning respectful.

Sound upbeat, friendly, curious, patient, and gently playful. Use natural contractions and varied phrasing. Do not sound robotic, babyish, sing-song, theatrical, overly praising, or like a game-show host. Save the biggest excitement for solving or completing the mystery.

# RESPONSE SHAPE
Return only the words that should be shown and spoken to the child. Do not return JSON, labels, quotation marks, stage names, or explanations.

Use one to three short sentences. Usually stay under 45 spoken words; completion may use up to 65. Ask at most one question. Give one conversational action per response.

# SAFETY AND PRIVACY
Keep everything appropriate for ages 4\u20137. Never ask for or repeat a child's full name, address, school, location, contact details, or other personal information. Do not introduce frightening, violent, sexual, or otherwise inappropriate content.`;
var THINK_GUESS_VOICE_INSTRUCTIONS = `# ROLE
You are the warm, expressive voice of StoryLingo's Think & Guess game for children ages 4\u20137.

# DELIVERY
- Read the supplied generated Think & Guess reply exactly. Do not add, remove, paraphrase, or answer it.
- Use a relaxed conversational pace with gentle delight, not a rushed or sing-song cadence.
- Pause naturally between sentences.
- Sound encouraging but not babyish, theatrical, or like a game-show host.
- Keep routine clues calm. Use brighter celebration only when the supplied words solve or reveal the mystery.

# BOUNDARIES
Never independently answer child audio. Wait for an explicit response.create event before speaking.`;
var PassthroughResponseWriter = class {
  async write(update) {
    return update.fallbackReply;
  }
};
var targetLanguageNames = {
  en: "English",
  zh: "Mandarin Chinese",
  es: "Spanish"
};
function localPromptFor(language) {
  return THINK_GUESS_AI_PROMPT.replaceAll(
    "{{target_language}}",
    targetLanguageNames[language]
  );
}
function modelInputFor(update) {
  const { fallbackReply: _fallbackReply, ...modelInput } = update;
  return modelInput;
}
function buildThinkGuessResponseRequest(update, environment = process.env) {
  const configuredPromptId = environment.THINK_GUESS_PROMPT_ID?.trim();
  const promptId = configuredPromptId && configuredPromptId !== "local" ? configuredPromptId : void 0;
  const promptVersion = environment.THINK_GUESS_PROMPT_VERSION?.trim();
  const shared = {
    model: environment.THINK_GUESS_RESPONSE_MODEL || "gpt-4.1-mini",
    store: false,
    max_output_tokens: 512,
    input: JSON.stringify(modelInputFor(update))
  };
  if (promptId) {
    return {
      ...shared,
      prompt: {
        id: promptId,
        variables: {
          target_language: targetLanguageNames[update.targetLanguage]
        },
        ...promptVersion ? { version: promptVersion } : {}
      }
    };
  }
  return { ...shared, instructions: localPromptFor(update.targetLanguage) };
}
function cleanThinkGuessModelReply(value) {
  const trimmed = value.trim().replace(/^```(?:text|json)?\s*/i, "").replace(/```$/, "").trim();
  if (!trimmed.startsWith("{"))
    return trimmed.replace(/^(["'])|(["'])$/g, "").trim();
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed.reply === "string" ? parsed.reply.trim() : trimmed;
  } catch {
    return trimmed;
  }
}
var OpenAIThinkGuessResponseWriter = class {
  client;
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    this.client = apiKey ? new OpenAI2({ apiKey, timeout: 5e3, maxRetries: 0 }) : null;
  }
  async write(update) {
    if (!this.client) return update.fallbackReply;
    try {
      const response = await this.client.responses.create(
        buildThinkGuessResponseRequest(update)
      );
      const reply = cleanThinkGuessModelReply(response.output_text);
      return reply || update.fallbackReply;
    } catch (error) {
      console.warn("Think & Guess AI response fallback:", error);
      return update.fallbackReply;
    }
  }
};

// server/thinkGuess/engine.ts
function defaultResponseWriter() {
  return process.env.THINK_GUESS_ENABLE_AI_RESPONSES === "false" ? new PassthroughResponseWriter() : new OpenAIThinkGuessResponseWriter();
}
var ROUND_TTL_MS = 30 * 60 * 1e3;
var REASONING_TURN_LIMIT = 10;
var REASONING_INTENTS = /* @__PURE__ */ new Set([
  "question",
  "direct_guess",
  "request_hint"
]);
function replyIsSpeakable(reply, language, isCompletion) {
  const questionCount = reply.match(/[?？]/g)?.length ?? 0;
  if (questionCount > 1) return false;
  if (/our clue collection says|what would you like to find out next|which kind of clue should we investigate/i.test(
    reply
  )) {
    return false;
  }
  const spokenUnits = language === "zh" ? [...reply.replace(/\s/g, "")].length : reply.trim().split(/\s+/).filter(Boolean).length;
  const limit = isCompletion ? language === "zh" ? 130 : 80 : language === "zh" ? 90 : 55;
  return spokenUnits <= limit;
}
function replyFingerprint(reply) {
  return createHash("sha256").update(reply).digest("hex").slice(0, 12);
}
function speechConfidenceBucket(speechConfidence) {
  if (speechConfidence === void 0) return void 0;
  if (speechConfidence < 0.5) return "low";
  if (speechConfidence < 0.8) return "medium";
  return "high";
}
function responseLatencyBucket(responseLatency) {
  if (responseLatency < 800) return "fast";
  if (responseLatency < 2e3) return "normal";
  return "slow";
}
var categoryNames = {
  en: {
    animal: "an animal",
    food: "some food",
    toy: "a toy",
    home: "a home object",
    transport: "a vehicle",
    fairy_tale: "a fairy-tale object"
  },
  zh: {
    animal: "\u4E00\u79CD\u52A8\u7269",
    food: "\u4E00\u79CD\u98DF\u7269",
    toy: "\u4E00\u4E2A\u73A9\u5177",
    home: "\u4E00\u4E2A\u5BB6\u91CC\u7684\u4E1C\u897F",
    transport: "\u4E00\u79CD\u4EA4\u901A\u5DE5\u5177",
    fairy_tale: "\u4E00\u4E2A\u7AE5\u8BDD\u91CC\u7684\u4E1C\u897F"
  },
  es: {
    animal: "un animal",
    food: "una comida",
    toy: "un juguete",
    home: "un objeto de casa",
    transport: "un veh\xEDculo",
    fairy_tale: "un objeto de cuento"
  }
};
var broadQuestionSuggestions = {
  en: {
    color: "Try asking, \u2018What colour is it?\u2019",
    appearance: "Try asking, \u2018What does it look like?\u2019",
    action: "Try asking, \u2018What does it do?\u2019",
    location: "Try asking, \u2018Where might I find it?\u2019",
    category: "Try asking, \u2018What kind of thing is it?\u2019"
  },
  zh: {
    color: "\u8BD5\u7740\u95EE\uFF1A\u201C\u5B83\u662F\u4EC0\u4E48\u989C\u8272\uFF1F\u201D",
    appearance: "\u8BD5\u7740\u95EE\uFF1A\u201C\u5B83\u957F\u4EC0\u4E48\u6837\uFF1F\u201D",
    action: "\u8BD5\u7740\u95EE\uFF1A\u201C\u5B83\u4F1A\u505A\u4EC0\u4E48\uFF1F\u201D",
    location: "\u8BD5\u7740\u95EE\uFF1A\u201C\u5728\u54EA\u91CC\u80FD\u627E\u5230\u5B83\uFF1F\u201D",
    category: "\u8BD5\u7740\u95EE\uFF1A\u201C\u5B83\u662F\u4EC0\u4E48\u79CD\u7C7B\uFF1F\u201D"
  },
  es: {
    color: "Prueba a preguntar: \xAB\xBFDe qu\xE9 color es?\xBB",
    appearance: "Prueba a preguntar: \xAB\xBFC\xF3mo es?\xBB",
    action: "Prueba a preguntar: \xAB\xBFQu\xE9 hace?\xBB",
    location: "Prueba a preguntar: \xAB\xBFD\xF3nde puedo encontrarlo?\xBB",
    category: "Prueba a preguntar: \xAB\xBFQu\xE9 tipo de cosa es?\xBB"
  }
};
var copy = {
  en: {
    opening: (category) => category ? `I am thinking of ${category}. Ask me a question.` : "I am thinking of something. Ask me a question.",
    yes: "Yes!",
    no: "Not this time!",
    wrong: (guess) => `Not this time\u2014it is not ${guess}. Now we can cross that idea off!`,
    unknown: (suggestion) => `I do not have that clue. ${suggestion}`,
    questionAnswer: (fact, turn) => `${fact} ${["That helps!", "Nice clue!", "We can use that!"][turn % 3]}`,
    broadAnswer: (fact, turn) => `${fact} ${["Handy clue!", "That helps!", "Now we know more!"][turn % 3]}`,
    repeat: (reply) => `Sure. ${reply}`,
    unclear: "My owl ears missed that. Could you say it once more?",
    dontKnow: "That is okay. Try one easy question: \u201CWhat kind of thing is it?\u201D",
    offTopic: "Hehe, silly one! Let us hop back to the mystery.",
    coach: "Let us use one clue to narrow it down.",
    strategy: "Let us start easy: find out what kind of thing it is.",
    discover: (base) => base,
    connect: (base, clue) => clue ? `${base} That fits with this clue: ${clue}` : base,
    coachProgress: (base, hint) => `${base} Here is one more clue: ${hint}`,
    narrow: (base, choices) => `${base} One last choice: ${choices}`,
    turnLimitReveal: (answer, clues) => `The answer is ${answer}! ${clues ? `This clue helped us: ${clues}` : "Every question narrowed the mystery."} Nice thinking!`,
    choices: (items) => `Is it ${items[0]}, ${items[1]}, or ${items[2]}?`,
    revealLocked: (remaining) => `Let us try ${remaining} more ${remaining === 1 ? "clue" : "clues"} together first.`,
    revealed: (answer) => `The answer is ${answer}. Nice thinking\u2014you used the clues to learn something new!`,
    solved: (answer) => `Yes! It is ${answer}. You used questions and clues to work it out!`,
    stopped: "Of course! We can stop now. Thanks for playing with me!",
    alreadyDone: "This round is finished. Start a new mystery to play again."
  },
  zh: {
    opening: (category) => category ? `\u6211\u60F3\u7684\u662F${category}\u3002\u95EE\u6211\u4E00\u4E2A\u95EE\u9898\u5427\u3002` : "\u6211\u5728\u60F3\u4E00\u6837\u4E1C\u897F\u3002\u95EE\u6211\u4E00\u4E2A\u95EE\u9898\u5427\u3002",
    yes: "\u662F\u7684\uFF01",
    no: "\u8FD9\u6B21\u4E0D\u662F\u54E6\uFF01",
    wrong: (guess) => `\u8FD9\u6B21\u4E0D\u662F${guess}\u3002\u6211\u4EEC\u53C8\u6392\u9664\u4E86\u4E00\u4E2A\u53EF\u80FD\uFF01`,
    unknown: (suggestion) => `\u6211\u8FD8\u6CA1\u6709\u8FD9\u6761\u7EBF\u7D22\u3002${suggestion}`,
    questionAnswer: (fact, turn) => `${fact}${["\u8FD9\u5F88\u6709\u5E2E\u52A9\uFF01", "\u597D\u7EBF\u7D22\uFF01", "\u8FD9\u6761\u80FD\u7528\u4E0A\uFF01"][turn % 3]}`,
    broadAnswer: (fact, turn) => `${fact}${["\u597D\u7EBF\u7D22\uFF01", "\u8FD9\u5F88\u6709\u5E2E\u52A9\uFF01", "\u6211\u4EEC\u53C8\u77E5\u9053\u4E86\u4E00\u70B9\uFF01"][turn % 3]}`,
    repeat: (reply) => `\u597D\u7684\u3002${reply}`,
    unclear: "\u6211\u7684\u732B\u5934\u9E70\u8033\u6735\u6CA1\u542C\u6E05\u695A\u3002\u53EF\u4EE5\u518D\u8BF4\u4E00\u6B21\u5417\uFF1F",
    dontKnow: "\u6CA1\u5173\u7CFB\u3002\u8BD5\u4E00\u4E2A\u7B80\u5355\u95EE\u9898\uFF1A\u201C\u5B83\u662F\u4EC0\u4E48\u79CD\u7C7B\uFF1F\u201D",
    offTopic: "\u563F\u563F\uFF0C\u771F\u6709\u8DA3\uFF01\u6211\u4EEC\u56DE\u5230\u8C1C\u9898\u5427\u3002",
    coach: "\u6211\u4EEC\u7528\u4E00\u6761\u7EBF\u7D22\u6765\u7F29\u5C0F\u8303\u56F4\u5427\u3002",
    strategy: "\u6211\u4EEC\u5148\u4ECE\u5B83\u662F\u4EC0\u4E48\u79CD\u7C7B\u5F00\u59CB\u3002",
    discover: (base) => base,
    connect: (base, clue) => clue ? `${base}\u8FD9\u548C\u4E4B\u524D\u7684\u7EBF\u7D22\u5F88\u642D\uFF1A${clue}` : base,
    coachProgress: (base, hint) => `${base}\u518D\u7ED9\u4F60\u4E00\u6761\u7EBF\u7D22\uFF1A${hint}`,
    narrow: (base, choices) => `${base}\u6700\u540E\u9009\u4E00\u6B21\uFF1A${choices}`,
    turnLimitReveal: (answer, clues) => `\u7B54\u6848\u662F${answer}\uFF01${clues ? `\u8FD9\u6761\u7EBF\u7D22\u5F88\u6709\u5E2E\u52A9\uFF1A${clues}` : "\u6BCF\u4E00\u4E2A\u95EE\u9898\u90FD\u7F29\u5C0F\u4E86\u8303\u56F4\u3002"}\u4F60\u60F3\u5F97\u771F\u8BA4\u771F\uFF01`,
    choices: (items) => `\u5B83\u662F${items[0]}\u3001${items[1]}\uFF0C\u8FD8\u662F${items[2]}\uFF1F`,
    revealLocked: (remaining) => `\u4F60\u505A\u5F97\u5F88\u68D2\uFF01\u6211\u4EEC\u5148\u4E00\u8D77\u518D\u8BD5${remaining}\u4E2A\u7EBF\u7D22\u5427\u3002`,
    revealed: (answer) => `\u7B54\u6848\u662F${answer}\u3002\u4F60\u8BA4\u771F\u601D\u8003\uFF0C\u4E5F\u7528\u7EBF\u7D22\u5B66\u5230\u4E86\u65B0\u4E1C\u897F\uFF01`,
    solved: (answer) => `\u7B54\u5BF9\u4E86\uFF01\u662F${answer}\u3002\u4F60\u7528\u95EE\u9898\u548C\u7EBF\u7D22\u627E\u5230\u4E86\u7B54\u6848\uFF01`,
    stopped: "\u5F53\u7136\u53EF\u4EE5\uFF01\u6211\u4EEC\u73B0\u5728\u505C\u4E0B\u6765\u3002\u8C22\u8C22\u4F60\u966A\u6211\u73A9\uFF01",
    alreadyDone: "\u8FD9\u4E00\u8F6E\u5DF2\u7ECF\u7ED3\u675F\u4E86\u3002\u5F00\u59CB\u4E00\u4E2A\u65B0\u8C1C\u9898\u518D\u73A9\u5427\u3002"
  },
  es: {
    opening: (category) => category ? `Estoy pensando en ${category}. Hazme una pregunta.` : "Estoy pensando en algo. Hazme una pregunta.",
    yes: "\xA1S\xED!",
    no: "\xA1Esta vez no!",
    wrong: (guess) => `Esta vez no es ${guess}. \xA1Ya descartamos una posibilidad!`,
    unknown: (suggestion) => `No tengo esa pista. ${suggestion}`,
    questionAnswer: (fact, turn) => `${fact} ${["\xA1Eso ayuda!", "\xA1Buena pista!", "\xA1Podemos usarla!"][turn % 3]}`,
    broadAnswer: (fact, turn) => `${fact} ${["\xA1Pista \xFAtil!", "\xA1Eso ayuda!", "\xA1Ahora sabemos m\xE1s!"][turn % 3]}`,
    repeat: (reply) => `Claro. ${reply}`,
    unclear: "Mis orejas de b\xFAho no lo oyeron bien. \xBFPuedes repetirlo?",
    dontKnow: "No pasa nada. Prueba una pregunta f\xE1cil: \xAB\xBFQu\xE9 tipo de cosa es?\xBB",
    offTopic: "Je, je, \xA1qu\xE9 idea tan divertida! Volvamos al misterio.",
    coach: "Usemos una pista para reducir las opciones.",
    strategy: "Empecemos por descubrir qu\xE9 tipo de cosa es.",
    discover: (base) => base,
    connect: (base, clue) => clue ? `${base} Encaja con esta pista: ${clue}` : base,
    coachProgress: (base, hint) => `${base} Aqu\xED tienes otra pista: ${hint}`,
    narrow: (base, choices) => `${base} Una \xFAltima elecci\xF3n: ${choices}`,
    turnLimitReveal: (answer, clues) => `\xA1La respuesta es ${answer}! ${clues ? `Esta pista nos ayud\xF3: ${clues}` : "Cada pregunta redujo el misterio."} \xA1Pensaste muy bien!`,
    choices: (items) => `\xBFEs ${items[0]}, ${items[1]} o ${items[2]}?`,
    revealLocked: (remaining) => `\xA1Lo est\xE1s haciendo genial! Probemos juntos ${remaining} ${remaining === 1 ? "pista m\xE1s" : "pistas m\xE1s"} primero.`,
    revealed: (answer) => `La respuesta es ${answer}. \xA1Pensaste bien y usaste las pistas para aprender algo nuevo!`,
    solved: (answer) => `\xA1S\xED! Es ${answer}. \xA1Usaste preguntas y pistas para descubrirlo!`,
    stopped: "\xA1Claro! Podemos parar ahora. \xA1Gracias por jugar conmigo!",
    alreadyDone: "Esta ronda termin\xF3. Empieza otro misterio para jugar de nuevo."
  }
};
var attributeReplies = {
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
      "No, you do not usually find it at home."
    ],
    from_a_story: [
      "Yes, it appears in a story.",
      "No, it is not from a story."
    ],
    magical: ["Yes, it is magical.", "No, it is not magical."]
  },
  zh: {
    alive: ["\u662F\u7684\uFF0C\u5B83\u662F\u6D3B\u7684\u3002", "\u4E0D\u662F\uFF0C\u5B83\u4E0D\u662F\u6D3B\u7684\u3002"],
    animal: ["\u662F\u7684\uFF0C\u5B83\u662F\u52A8\u7269\u3002", "\u4E0D\u662F\uFF0C\u5B83\u4E0D\u662F\u52A8\u7269\u3002"],
    edible: ["\u662F\u7684\uFF0C\u5B83\u53EF\u4EE5\u5403\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u80FD\u5403\u3002"],
    big: ["\u662F\u7684\uFF0C\u5B83\u5F88\u5927\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u5927\u3002"],
    small: ["\u662F\u7684\uFF0C\u5B83\u5F88\u5C0F\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u5C0F\u3002"],
    flies: ["\u662F\u7684\uFF0C\u5B83\u4F1A\u98DE\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u4F1A\u98DE\u3002"],
    swims: ["\u662F\u7684\uFF0C\u5B83\u4F1A\u6E38\u6CF3\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u4F1A\u6E38\u6CF3\u3002"],
    four_legs: ["\u662F\u7684\uFF0C\u5B83\u6709\u56DB\u6761\u817F\u3002", "\u4E0D\uFF0C\u5B83\u6CA1\u6709\u56DB\u6761\u817F\u3002"],
    has_wings: ["\u662F\u7684\uFF0C\u5B83\u6709\u7FC5\u8180\u3002", "\u4E0D\uFF0C\u5B83\u6CA1\u6709\u7FC5\u8180\u3002"],
    has_trunk: ["\u662F\u7684\uFF0C\u5B83\u6709\u957F\u9F3B\u5B50\u3002", "\u4E0D\uFF0C\u5B83\u6CA1\u6709\u957F\u9F3B\u5B50\u3002"],
    has_wheels: ["\u662F\u7684\uFF0C\u5B83\u6709\u8F6E\u5B50\u3002", "\u4E0D\uFF0C\u5B83\u6CA1\u6709\u8F6E\u5B50\u3002"],
    red: ["\u662F\u7684\uFF0C\u5B83\u53EF\u4EE5\u662F\u7EA2\u8272\u7684\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u662F\u7EA2\u8272\u7684\u3002"],
    yellow: ["\u662F\u7684\uFF0C\u5B83\u53EF\u4EE5\u662F\u9EC4\u8272\u7684\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u662F\u9EC4\u8272\u7684\u3002"],
    green: ["\u662F\u7684\uFF0C\u5B83\u53EF\u4EE5\u662F\u7EFF\u8272\u7684\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u662F\u7EFF\u8272\u7684\u3002"],
    orange: ["\u662F\u7684\uFF0C\u5B83\u662F\u6A59\u8272\u7684\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u662F\u6A59\u8272\u7684\u3002"],
    round: ["\u662F\u7684\uFF0C\u5B83\u662F\u5706\u7684\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u662F\u5706\u7684\u3002"],
    soft: ["\u662F\u7684\uFF0C\u5B83\u5F88\u67D4\u8F6F\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u67D4\u8F6F\u3002"],
    crunchy: ["\u662F\u7684\uFF0C\u5B83\u5F88\u8106\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u8106\u3002"],
    used_at_home: ["\u662F\u7684\uFF0C\u5BB6\u91CC\u53EF\u4EE5\u627E\u5230\u5B83\u3002", "\u4E0D\uFF0C\u5BB6\u91CC\u901A\u5E38\u627E\u4E0D\u5230\u5B83\u3002"],
    from_a_story: ["\u662F\u7684\uFF0C\u5B83\u4F1A\u51FA\u73B0\u5728\u6545\u4E8B\u91CC\u3002", "\u4E0D\uFF0C\u5B83\u4E0D\u662F\u6545\u4E8B\u91CC\u7684\u4E1C\u897F\u3002"],
    magical: ["\u662F\u7684\uFF0C\u5B83\u6709\u9B54\u6CD5\u3002", "\u4E0D\uFF0C\u5B83\u6CA1\u6709\u9B54\u6CD5\u3002"]
  },
  es: {
    alive: ["S\xED, est\xE1 vivo.", "No, no est\xE1 vivo."],
    animal: ["S\xED, es un animal.", "No, no es un animal."],
    edible: ["S\xED, se puede comer.", "No, no se puede comer."],
    big: ["S\xED, es grande.", "No, no es grande."],
    small: ["S\xED, es peque\xF1o.", "No, no es peque\xF1o."],
    flies: ["S\xED, puede volar.", "No, no puede volar."],
    swims: ["S\xED, puede nadar.", "No, no puede nadar."],
    four_legs: ["S\xED, tiene cuatro patas.", "No, no tiene cuatro patas."],
    has_wings: ["S\xED, tiene alas.", "No, no tiene alas."],
    has_trunk: ["S\xED, tiene trompa.", "No, no tiene trompa."],
    has_wheels: ["S\xED, tiene ruedas.", "No, no tiene ruedas."],
    red: ["S\xED, puede ser rojo.", "No, no es rojo."],
    yellow: ["S\xED, puede ser amarillo.", "No, no es amarillo."],
    green: ["S\xED, puede ser verde.", "No, no es verde."],
    orange: ["S\xED, es naranja.", "No, no es naranja."],
    round: ["S\xED, es redondo.", "No, no es redondo."],
    soft: ["S\xED, es suave.", "No, no es suave."],
    crunchy: ["S\xED, es crujiente.", "No, no es crujiente."],
    used_at_home: [
      "S\xED, puede estar en casa.",
      "No, normalmente no est\xE1 en casa."
    ],
    from_a_story: ["S\xED, aparece en un cuento.", "No, no viene de un cuento."],
    magical: ["S\xED, es m\xE1gico.", "No, no es m\xE1gico."]
  }
};
function answerAttribute(language, attribute, value) {
  return attributeReplies[language][attribute]?.[value ? 0 : 1] ?? (value ? copy[language].yes : copy[language].no);
}
var appearanceAttributes = [
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
  "has_wheels"
];
var broadCategoryFacts = {
  en: {
    animal: {
      action: "It can move around like an animal.",
      location: "You can find it where animals live."
    },
    food: {
      action: "You can eat it.",
      location: "You might find it in a kitchen or a shop."
    },
    toy: {
      action: "You can play with it.",
      location: "You might find it where children play."
    },
    home: {
      action: "People use it at home.",
      location: "You can find it at home."
    },
    transport: {
      action: "It helps people move from place to place.",
      location: "You might find it where people travel."
    },
    fairy_tale: {
      action: "It has a special part in a fairy tale.",
      location: "You can find it in a fairy tale."
    }
  },
  zh: {
    animal: {
      action: "\u5B83\u4F1A\u50CF\u52A8\u7269\u4E00\u6837\u6D3B\u52A8\u3002",
      location: "\u5728\u52A8\u7269\u751F\u6D3B\u7684\u5730\u65B9\u53EF\u4EE5\u627E\u5230\u5B83\u3002"
    },
    food: { action: "\u5B83\u53EF\u4EE5\u5403\u3002", location: "\u53A8\u623F\u6216\u5546\u5E97\u91CC\u53EF\u80FD\u4F1A\u6709\u5B83\u3002" },
    toy: { action: "\u53EF\u4EE5\u7528\u5B83\u6765\u73A9\u3002", location: "\u5C0F\u670B\u53CB\u73A9\u800D\u7684\u5730\u65B9\u53EF\u80FD\u4F1A\u6709\u5B83\u3002" },
    home: { action: "\u4EBA\u4EEC\u4F1A\u5728\u5BB6\u91CC\u4F7F\u7528\u5B83\u3002", location: "\u5BB6\u91CC\u53EF\u4EE5\u627E\u5230\u5B83\u3002" },
    transport: {
      action: "\u5B83\u80FD\u5E2E\u52A9\u4EBA\u4EEC\u4ECE\u4E00\u4E2A\u5730\u65B9\u53BB\u53E6\u4E00\u4E2A\u5730\u65B9\u3002",
      location: "\u4EBA\u4EEC\u51FA\u884C\u7684\u5730\u65B9\u53EF\u80FD\u4F1A\u6709\u5B83\u3002"
    },
    fairy_tale: {
      action: "\u5B83\u5728\u7AE5\u8BDD\u91CC\u6709\u7279\u522B\u7684\u4F5C\u7528\u3002",
      location: "\u7AE5\u8BDD\u6545\u4E8B\u91CC\u53EF\u4EE5\u627E\u5230\u5B83\u3002"
    }
  },
  es: {
    animal: {
      action: "Puede moverse como un animal.",
      location: "Puedes encontrarlo donde viven los animales."
    },
    food: {
      action: "Se puede comer.",
      location: "Podr\xEDas encontrarlo en una cocina o una tienda."
    },
    toy: {
      action: "Puedes jugar con \xE9l.",
      location: "Podr\xEDas encontrarlo donde juegan los ni\xF1os."
    },
    home: {
      action: "La gente lo usa en casa.",
      location: "Puedes encontrarlo en casa."
    },
    transport: {
      action: "Ayuda a las personas a ir de un lugar a otro.",
      location: "Podr\xEDas encontrarlo donde viaja la gente."
    },
    fairy_tale: {
      action: "Tiene una funci\xF3n especial en un cuento de hadas.",
      location: "Puedes encontrarlo en un cuento de hadas."
    }
  }
};
var approvedActionHintIndex = {
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
  fairy_pirate_ship: 2
};
function withoutAgreement(language, value) {
  const fact = language === "zh" ? value.replace(/^是的，/, "") : value.replace(/^(?:Yes|Sí),?\s*/i, "");
  return language === "zh" ? fact : `${fact.charAt(0).toLocaleUpperCase()}${fact.slice(1)}`;
}
function broadQuestionFact(answer, language, topic) {
  if (topic === "color") {
    return answer.localized[language].facts.color;
  }
  if (topic === "category") {
    const category = categoryNames[language][answer.category];
    if (language === "zh") return `\u5B83\u662F${category}\u3002`;
    if (language === "es") return `Es ${category}.`;
    return `It is ${category}.`;
  }
  if (topic === "location") {
    return broadCategoryFacts[language][answer.category].location;
  }
  if (topic === "action") {
    const hintIndex = approvedActionHintIndex[answer.id];
    if (hintIndex !== void 0) {
      return answer.localized[language].hints[hintIndex];
    }
    return broadCategoryFacts[language][answer.category].action;
  }
  const attribute = appearanceAttributes.find(
    (candidate) => answer.attributes[candidate] === true
  );
  if (attribute) {
    return withoutAgreement(
      language,
      answerAttribute(language, attribute, true)
    );
  }
  return answer.localized[language].hints[0];
}
function supportStageFor(reasoningTurnNumber) {
  if (reasoningTurnNumber >= 10) return "resolve";
  if (reasoningTurnNumber === 9) return "narrow";
  if (reasoningTurnNumber >= 7) return "coach";
  if (reasoningTurnNumber >= 4) return "connect";
  return "discover";
}
function addKnownClue(state, clue) {
  if (!state.knownClues.includes(clue) && state.knownClues.length < 10) {
    state.knownClues.push(clue);
  }
}
function clueSummary(state) {
  return state.knownClues.slice(-3).join(state.language === "zh" ? "" : " ");
}
var RoundAccessError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
function normalize(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[?.!,。！？¡¿'’]/g, "").replace(
    /^(?:(?:a|an|the|un|una|el|la)\s+|(?:一个|一只|一辆|一架|一艘|一把|一根|一面|一顶)\s*)/i,
    ""
  ).replace(/\s+/g, " ").trim();
}
function aliasesFor(answer, language) {
  return new Set(answer.localized[language].aliases.map(normalize));
}
function answerMatches(answer, language, guess) {
  if (!guess) return false;
  return aliasesFor(answer, language).has(normalize(guess));
}
function replyNamesAnswer(reply, answer) {
  const normalizedReply = ` ${normalize(reply)} `;
  return ["en", "zh", "es"].some(
    (language) => [...aliasesFor(answer, language)].some((alias) => {
      if (!alias) return false;
      return language === "zh" ? normalizedReply.includes(alias) : normalizedReply.includes(` ${alias} `);
    })
  );
}
function nextQuestionSuggestion(state) {
  const topics = [
    "color",
    "action",
    "location",
    "appearance",
    "category"
  ];
  const topic = topics.find((candidate) => !state.askedTopics.includes(candidate)) ?? "color";
  if (!state.askedTopics.includes(topic)) {
    state.askedTopics.push(topic);
  }
  return broadQuestionSuggestions[state.language][topic];
}
function openingFor(answer, state) {
  const category = state.reasoningLevel <= 2 ? categoryNames[state.language][answer.category] : void 0;
  return copy[state.language].opening(category);
}
function distractorsFor(answer, language, answers) {
  return answers.filter(
    (candidate) => candidate.id !== answer.id && candidate.category === answer.category
  ).slice(0, 2).map((candidate) => candidate.localized[language].canonical);
}
function hintReply(answer, state, answers) {
  const level = state.hintLevel;
  if (level === 1) return copy[state.language].strategy;
  if (level >= 2 && level <= 4)
    return answer.localized[state.language].hints[level - 2];
  const choices = [
    answer.localized[state.language].canonical,
    ...distractorsFor(answer, state.language, answers)
  ];
  return copy[state.language].choices(choices.sort(() => 0.5 - Math.random()));
}
function choiceReply(answer, language, answers) {
  const choices = [
    answer.localized[language].canonical,
    ...distractorsFor(answer, language, answers)
  ];
  return copy[language].choices(choices.sort(() => 0.5 - Math.random()));
}
function applyProgressSupport(baseReply, state, answer, answers) {
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
function applyTurn(current, answer, classification, answers = THINK_GUESS_ANSWERS, now = Date.now()) {
  const text = copy[current.language];
  if (["solved", "complete", "stopped", "abandoned", "expired"].includes(
    current.status
  )) {
    return {
      state: current,
      decision: turnDecisionSchema.parse({
        status: current.status,
        reply: text.alreadyDone,
        intent: classification.intent,
        turnNumber: current.turnNumber,
        hintLevel: current.hintLevel,
        voiceState: current.status === "solved" || current.status === "complete" ? "round_complete" : "idle"
      })
    };
  }
  const state = {
    ...current,
    status: "responding",
    turnNumber: current.turnNumber + 1,
    reasoningTurnNumber: current.reasoningTurnNumber + (REASONING_INTENTS.has(classification.intent) ? 1 : 0),
    knownClues: [...current.knownClues],
    askedAttributes: [...current.askedAttributes],
    askedTopics: [...current.askedTopics],
    updatedAt: now,
    expiresAt: now + ROUND_TTL_MS
  };
  let reply;
  let completion;
  let currentFact;
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
        reasoningLevel: state.reasoningLevel
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
      const attributeValue = classification.attribute ? answer.attributes[classification.attribute] : void 0;
      if (classification.attribute && attributeValue !== void 0) {
        state.usefulQuestions += 1;
        if (!state.askedAttributes.includes(classification.attribute)) {
          state.askedAttributes.push(classification.attribute);
        }
        const fact = answerAttribute(
          state.language,
          classification.attribute,
          attributeValue
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
          classification.questionTopic
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
      if (answerMatches(answer, state.language, classification.normalizedGuess)) {
        state.status = "solved";
        const canonicalAnswer = answer.localized[state.language].canonical;
        reply = text.solved(canonicalAnswer);
        completion = {
          solved: true,
          canonicalAnswer,
          usefulQuestions: state.usefulQuestions,
          hintsUsed: state.hintsUsed,
          reasoningLevel: state.reasoningLevel
        };
      } else {
        state.consecutiveDirectGuesses += 1;
        const guess = classification.normalizedGuess || (state.language === "zh" ? "\u8FD9\u4E2A\u7B54\u6848" : state.language === "es" ? "esa respuesta" : "that");
        reply = text.wrong(guess);
        if (state.consecutiveDirectGuesses >= 3) {
          reply = `${reply} ${text.coach}`;
          state.consecutiveDirectGuesses = 0;
        }
      }
      break;
    default: {
      const exhaustive = classification.intent;
      throw new Error(`Unhandled intent: ${exhaustive}`);
    }
  }
  if (REASONING_INTENTS.has(classification.intent) && state.status !== "solved" && state.status !== "complete" && state.reasoningTurnNumber >= REASONING_TURN_LIMIT) {
    const canonicalAnswer = answer.localized[state.language].canonical;
    state.status = "complete";
    reply = text.turnLimitReveal(canonicalAnswer, clueSummary(state));
    completion = {
      solved: false,
      canonicalAnswer,
      usefulQuestions: state.usefulQuestions,
      hintsUsed: state.hintsUsed,
      reasoningLevel: state.reasoningLevel
    };
  } else if (REASONING_INTENTS.has(classification.intent) && state.status !== "solved" && state.status !== "complete") {
    reply = classification.intent === "request_hint" || classification.intent === "question" && !currentFact ? reply : applyProgressSupport(reply, state, answer, answers);
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
      voiceState: state.status === "solved" || state.status === "complete" ? "round_complete" : "ai_speaking",
      completion
    })
  };
}
function lookupError(lookup) {
  return lookup.kind === "expired" ? new RoundAccessError(
    "ROUND_EXPIRED",
    "This mystery expired. Start a new round."
  ) : new RoundAccessError(
    "ROUND_NOT_FOUND",
    "This mystery could not be found."
  );
}
var ThinkGuessService = class {
  constructor(repository, classifier, analytics, answers = THINK_GUESS_ANSWERS, now = Date.now, chooseAnswer = (eligible) => eligible[Math.floor(Math.random() * eligible.length)], responseWriter = defaultResponseWriter()) {
    this.repository = repository;
    this.classifier = classifier;
    this.analytics = analytics;
    this.answers = answers;
    this.now = now;
    this.chooseAnswer = chooseAnswer;
    this.responseWriter = responseWriter;
  }
  locks = /* @__PURE__ */ new Map();
  async createRound(request) {
    if (request.mode !== "child_guesses") {
      throw new RoundAccessError(
        "ROUND_NOT_ACTIVE",
        "AI Guesses is not available in this pilot."
      );
    }
    const eligible = this.answers.filter(
      (answer2) => answer2.difficulty <= Math.max(1, request.reasoningLevel)
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
      expiresAt: timestamp + ROUND_TTL_MS
    });
    state.lastReply = openingFor(answer, state);
    await this.repository.create(state);
    this.emit(state, "think_guess_round_started");
    return {
      roundId: state.id,
      mode: state.mode,
      status: state.status,
      opening: state.lastReply,
      category: state.reasoningLevel <= 2 ? answer.category : void 0,
      turnNumber: 0,
      voiceState: "ai_speaking",
      voiceSession: {
        transport: "webrtc",
        interaction: "push_to_talk",
        replyAuthority: "ai_with_server_guardrails"
      },
      expiresAt: state.expiresAt
    };
  }
  async submitTurn(roundId, transcript, speechConfidence) {
    return this.withLock(roundId, async () => {
      const startedAt = this.now();
      const lookup = await this.repository.get(roundId);
      if (lookup.kind !== "found") throw lookupError(lookup);
      const round = lookup.round;
      if (round.status !== "waiting_for_child" && round.status !== "error_recovery") {
        throw new RoundAccessError(
          "ROUND_NOT_ACTIVE",
          "This round is not accepting a turn."
        );
      }
      const classification = classifiedTurnSchema.parse(
        await this.classifier.classify(
          transcript,
          round.language,
          speechConfidence
        )
      );
      const answer = this.answers.find(
        (candidate) => candidate.id === round.answerId
      );
      if (!answer) throw new Error(`Missing answer content: ${round.answerId}`);
      const priorReplyFingerprint = replyFingerprint(round.lastReply);
      const result = applyTurn(
        round,
        answer,
        classification,
        this.answers,
        this.now()
      );
      const fallbackReplyFingerprint = replyFingerprint(result.decision.reply);
      const writerOutcome = await this.applyThinkGuessConversation(
        result,
        answer,
        classification,
        transcript,
        round.lastReply
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
          fallbackDuplicatedPrior: fallbackReplyFingerprint === priorReplyFingerprint,
          finalDuplicatedPrior: finalReplyFingerprint === priorReplyFingerprint,
          writerChangedReply: finalReplyFingerprint !== fallbackReplyFingerprint,
          knownClueCount: result.state.knownClues.length,
          responseLatencyBucket: responseLatencyBucket(responseLatency)
        })
      );
      this.emitForDecision(
        result.state,
        classification.intent,
        speechConfidence,
        responseLatency
      );
      return result.decision;
    });
  }
  async stopRound(roundId) {
    return this.withLock(roundId, async () => {
      const lookup = await this.repository.get(roundId);
      if (lookup.kind !== "found") throw lookupError(lookup);
      const answer = this.answers.find(
        (candidate) => candidate.id === lookup.round.answerId
      );
      if (!answer)
        throw new Error(`Missing answer content: ${lookup.round.answerId}`);
      const result = applyTurn(
        lookup.round,
        answer,
        { intent: "stop", confidence: 1 },
        this.answers,
        this.now()
      );
      await this.applyThinkGuessConversation(
        result,
        answer,
        { intent: "stop", confidence: 1 },
        void 0,
        lookup.round.lastReply
      );
      await this.repository.save(result.state);
      this.emit(result.state, "think_guess_round_abandoned", false);
      return result.decision;
    });
  }
  async assertRoundAvailable(roundId) {
    const lookup = await this.repository.get(roundId);
    if (lookup.kind !== "found") throw lookupError(lookup);
    return lookup.round;
  }
  async applyThinkGuessConversation(result, answer, classification, childTranscript, previousReply) {
    const stage = supportStageFor(result.state.reasoningTurnNumber);
    const fallbackNamesAnswer = replyNamesAnswer(result.decision.reply, answer);
    const isTurnLimitReveal = result.state.status === "complete" && result.state.reasoningTurnNumber >= REASONING_TURN_LIMIT && classification.intent !== "reveal_answer";
    const outcome = result.state.status === "solved" ? "solved" : isTurnLimitReveal ? "turn_limit_reveal" : result.state.status === "complete" ? "answer_revealed" : result.state.status === "stopped" ? "stopped" : classification.intent === "direct_guess" ? "incorrect_guess" : classification.intent === "reveal_answer" ? "reveal_locked" : classification.intent === "request_repeat" ? "repeat" : classification.intent === "unclear" ? "unclear" : classification.intent === "dont_know" ? "dont_know" : classification.intent === "off_topic" ? "off_topic" : "continue";
    const localizedObject = answer.localized[result.state.language];
    const update = {
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
        REASONING_TURN_LIMIT - result.state.reasoningTurnNumber
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
        ...result.state.askedTopics
      ],
      previousReply,
      categoryMayBeNamed: result.state.reasoningLevel <= 2,
      answerMayBeNamed: fallbackNamesAnswer,
      secretObject: {
        canonicalAnswer: localizedObject.canonical,
        category: answer.category,
        approvedAttributes: answer.attributes,
        seedFacts: [localizedObject.facts.color, ...localizedObject.hints]
      },
      fallbackReply: result.decision.reply
    };
    let candidate;
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
    if (!replyIsSpeakable(
      candidate,
      result.state.language,
      result.state.status === "solved" || result.state.status === "complete"
    ))
      return "rejected_not_speakable";
    result.state.lastReply = candidate;
    result.decision = turnDecisionSchema.parse({
      ...result.decision,
      reply: candidate
    });
    return candidate === update.fallbackReply ? "deterministic" : "accepted";
  }
  emitForDecision(state, intent, speechConfidence, responseLatency) {
    const event = intent === "question" ? "reasoning_question_asked" : intent === "direct_guess" ? "direct_guess_made" : intent === "request_hint" ? "hint_requested" : intent === "reveal_answer" ? "answer_reveal_requested" : intent === "unclear" ? "speech_recovery_requested" : void 0;
    if (event)
      this.emit(state, event, void 0, speechConfidence, responseLatency);
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
  emit(state, event, completion, speechConfidence, responseLatency) {
    const answer = this.answers.find(
      (candidate) => candidate.id === state.answerId
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
      responseLatencyBucket: responseLatency === void 0 ? void 0 : responseLatencyBucket(responseLatency),
      timestamp: this.now()
    });
  }
  async withLock(roundId, work) {
    const previous = this.locks.get(roundId) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve3) => {
      release = resolve3;
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
};

// server/thinkGuess/repository.ts
var InMemoryRoundRepository = class {
  constructor(now = Date.now, maxRounds = 2e3) {
    this.now = now;
    this.maxRounds = maxRounds;
    if (!Number.isInteger(maxRounds) || maxRounds < 1) {
      throw new Error("maxRounds must be a positive integer");
    }
  }
  rounds = /* @__PURE__ */ new Map();
  pruneExpired() {
    const timestamp = this.now();
    for (const [roundId, round] of this.rounds) {
      if (round.expiresAt <= timestamp) this.rounds.delete(roundId);
    }
  }
  makeRoomFor(roundId) {
    this.pruneExpired();
    if (this.rounds.has(roundId)) return;
    while (this.rounds.size >= this.maxRounds) {
      const oldestRoundId = this.rounds.keys().next().value;
      if (!oldestRoundId) break;
      this.rounds.delete(oldestRoundId);
    }
  }
  async create(round) {
    this.makeRoomFor(round.id);
    this.rounds.set(round.id, structuredClone(round));
  }
  async get(roundId) {
    const round = this.rounds.get(roundId);
    if (!round) return { kind: "missing" };
    if (round.expiresAt <= this.now()) {
      this.rounds.delete(roundId);
      return { kind: "expired" };
    }
    return { kind: "found", round: structuredClone(round) };
  }
  async save(round) {
    this.makeRoomFor(round.id);
    this.rounds.set(round.id, structuredClone(round));
  }
  async delete(roundId) {
    this.rounds.delete(roundId);
  }
  async clear() {
    this.rounds.clear();
  }
};

// server/thinkGuess/routes.ts
function sendError(res, status, code, error) {
  return res.status(status).json({ code, error });
}
function routeParam(value) {
  return Array.isArray(value) ? value[0] : value;
}
function handleRouteError(res, error) {
  if (error instanceof ZodError) {
    return sendError(
      res,
      400,
      "INVALID_REQUEST",
      error.issues.map((issue) => issue.message).join("; ")
    );
  }
  if (error instanceof RoundAccessError) {
    if (error.code === "ROUND_EXPIRED")
      return sendError(res, 410, error.code, error.message);
    if (error.code === "ROUND_NOT_FOUND")
      return sendError(res, 404, error.code, error.message);
    return sendError(res, 409, "ROUND_NOT_ACTIVE", error.message);
  }
  console.error("Think & Guess route error:", error);
  return sendError(
    res,
    500,
    "INTERNAL_ERROR",
    "Think & Guess could not complete that request."
  );
}
function registerThinkGuessRoutes(app2, dependencies = {}) {
  const repository = dependencies.repository ?? new InMemoryRoundRepository();
  const analytics = dependencies.analytics ?? new StructuredLogAnalytics();
  const service = dependencies.service ?? new ThinkGuessService(repository, new BoundedTurnClassifier(), analytics);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  app2.post("/api/think-guess/rounds", async (req, res) => {
    try {
      const request = createRoundRequestSchema.parse(req.body);
      if (request.mode !== "child_guesses") {
        return sendError(
          res,
          409,
          "MODE_NOT_AVAILABLE",
          "AI Guesses is coming soon."
        );
      }
      return res.status(201).json(await service.createRound(request));
    } catch (error) {
      return handleRouteError(res, error);
    }
  });
  app2.post(
    "/api/think-guess/rounds/:roundId/turns",
    async (req, res) => {
      try {
        const request = submitTurnRequestSchema.parse(req.body);
        return res.json(
          await service.submitTurn(
            routeParam(req.params.roundId),
            request.transcript,
            request.speechConfidence
          )
        );
      } catch (error) {
        return handleRouteError(res, error);
      }
    }
  );
  app2.post(
    "/api/think-guess/rounds/:roundId/stop",
    async (req, res) => {
      try {
        return res.json(
          await service.stopRound(routeParam(req.params.roundId))
        );
      } catch (error) {
        return handleRouteError(res, error);
      }
    }
  );
  app2.post(
    "/api/think-guess/rounds/:roundId/realtime-token",
    async (req, res) => {
      try {
        const round = await service.assertRoundAvailable(
          routeParam(req.params.roundId)
        );
        if (!process.env.OPENAI_API_KEY) {
          return sendError(
            res,
            503,
            "VOICE_UNAVAILABLE",
            "Voice is not configured on this server."
          );
        }
        let response;
        try {
          response = await fetchImpl(
            "https://api.openai.com/v1/realtime/client_secrets",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                session: {
                  type: "realtime",
                  model: process.env.THINK_GUESS_REALTIME_MODEL || "gpt-realtime-2",
                  max_output_tokens: 512,
                  instructions: `${THINK_GUESS_VOICE_INSTRUCTIONS} The target language code is ${round.language}.`,
                  audio: {
                    input: {
                      transcription: { model: "gpt-4o-mini-transcribe" },
                      turn_detection: null
                    },
                    output: {
                      voice: process.env.THINK_GUESS_VOICE || "marin",
                      speed: 0.95
                    }
                  }
                }
              })
            }
          );
        } catch (error) {
          console.error("Think & Guess realtime token request failed:", error);
          return sendError(
            res,
            502,
            "VOICE_UNAVAILABLE",
            "Voice could not start. Try again."
          );
        }
        if (!response.ok) {
          console.error(
            "Think & Guess realtime token failed:",
            response.status,
            await response.text()
          );
          return sendError(
            res,
            502,
            "VOICE_UNAVAILABLE",
            "Voice could not start. Try again."
          );
        }
        let data;
        try {
          data = await response.json();
        } catch (error) {
          console.error(
            "Think & Guess realtime token response was invalid:",
            error
          );
          return sendError(
            res,
            502,
            "VOICE_UNAVAILABLE",
            "Voice could not start. Try again."
          );
        }
        if (typeof data !== "object" || data === null || !("value" in data) || typeof data.value !== "string" || data.value.length === 0 || !("expires_at" in data) || typeof data.expires_at !== "number" || !Number.isFinite(data.expires_at)) {
          console.error("Think & Guess realtime token response was malformed.");
          return sendError(
            res,
            502,
            "VOICE_UNAVAILABLE",
            "Voice could not start. Try again."
          );
        }
        return res.json({
          client_secret: data.value,
          expires_at: data.expires_at
        });
      } catch (error) {
        return handleRouteError(res, error);
      }
    }
  );
  app2.post("/api/think-guess/events", (req, res) => {
    try {
      analytics.emit(thinkGuessAnalyticsEventSchema.parse(req.body));
      return res.status(202).json({ accepted: true });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });
  return { service, repository, analytics };
}

// server/routes.ts
var INTERACTIVE_STORY_CONTEXT = `This is an interactive choose-your-own-adventure story. Unlike pre-written tales, YOU will create a unique story based entirely on the child's choices.

INTERACTIVE STORYTELLING RULES:
1. At every turn, give the child meaningful choices that genuinely affect the story direction
2. Never follow a predetermined plot - let the child's imagination guide where the story goes
3. Build the story world based on what the child wants: their character, setting, companions, and challenges
4. Make choices feel impactful - if they choose to befriend a dragon, the story should center on that friendship
5. Create surprise and delight based on their choices - reward creative ideas with magical outcomes
6. Keep the tone playful and empowering - the child is the hero and their choices matter
7. Use open-ended questions like "What do you want to do?" alongside specific choices
8. Remember and reference earlier choices to create a cohesive narrative

The macro beats are flexible guidelines, not strict plot points. Adapt them to whatever adventure the child chooses to create.`;
async function registerRoutes(app2) {
  app2.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/cover", (req, res) => {
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "cover-image.html"
    );
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
  registerThinkGuessRoutes(app2);
  app2.post("/api/token", async (req, res) => {
    try {
      const {
        storyId,
        storyTitle,
        storyContext,
        macroBeats,
        language,
        isInteractive
      } = req.body;
      if (!storyId || !storyTitle || !macroBeats) {
        return res.status(400).json({ error: "Missing story information" });
      }
      const langConfig = getLanguageConfig(language || "en");
      const storyBeatsFormatted = macroBeats.map((beat, i) => `${i + 1}. ${beat}`).join("\n");
      let enhancedContext = langConfig.languageInstruction;
      if (isInteractive) {
        enhancedContext += `

${INTERACTIVE_STORY_CONTEXT}

${storyContext || "An open-ended adventure where the child creates their own story."}`;
      } else {
        enhancedContext += `

${storyContext || `A classic tale of ${storyTitle}`}`;
      }
      console.log("=== Token Request ===");
      console.log("Story Title:", storyTitle);
      console.log("Story Context:", enhancedContext);
      console.log("Story Beats:", storyBeatsFormatted);
      console.log("Language:", language || "en");
      console.log("Language Config:", langConfig.languageName);
      console.log("Prompt ID:", langConfig.promptId);
      const response = await fetch(
        "https://api.openai.com/v1/realtime/client_secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            session: {
              type: "realtime",
              model: "gpt-realtime-2",
              prompt: {
                id: langConfig.promptId,
                variables: {
                  story_title: { type: "input_text", text: storyTitle },
                  story_context: { type: "input_text", text: enhancedContext },
                  story_beats: {
                    type: "input_text",
                    text: storyBeatsFormatted
                  }
                }
              }
            }
          })
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI Realtime client_secrets error:", errorText);
        return res.status(response.status).json({
          error: "Failed to create realtime session",
          details: errorText
        });
      }
      const data = await response.json();
      res.json({
        client_secret: data.value,
        expires_at: data.expires_at
      });
    } catch (error) {
      console.error("Token generation error:", error);
      res.status(500).json({ error: "Failed to generate token" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    if (process.env.ALLOWED_ORIGINS) {
      process.env.ALLOWED_ORIGINS.split(",").forEach((d) => {
        origins.add(d.trim());
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && path3.includes("token")) {
        logLine += " :: [credential redacted]";
      } else if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, req, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifestContent = fs2.readFileSync(manifestPath, "utf-8");
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const currentBaseUrl = `${protocol}://${host}`;
  const urlPattern = /https?:\/\/[^/\s"]+/g;
  const rewrittenManifest = manifestContent.replace(urlPattern, (match) => {
    try {
      const url = new URL(match);
      return `${currentBaseUrl}${url.pathname}`;
    } catch {
      return match;
    }
  });
  res.send(rewrittenManifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  const webDistPath = path2.resolve(process.cwd(), "dist");
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, req, res);
    }
    if (req.path === "/") {
      if (process.env.NODE_ENV === "development") {
        return next();
      }
      const webIndexPath = path2.join(webDistPath, "index.html");
      if (fs2.existsSync(webIndexPath)) {
        return res.sendFile(webIndexPath);
      }
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  if (process.env.NODE_ENV !== "development") {
    app2.use(express.static(webDistPath));
    app2.use(express.static(path2.resolve(process.cwd(), "static-build")));
  }
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  if (process.env.NODE_ENV === "development") {
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      createProxyMiddleware({
        target: "http://localhost:8081",
        changeOrigin: true
      })(req, res, next);
    });
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
  server.listen(port, host, () => {
    log(`express server serving on port ${port}`);
  });
})();
