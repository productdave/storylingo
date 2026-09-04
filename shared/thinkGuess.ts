import { z } from "zod";

export const supportedLanguageSchema = z.enum(["en", "zh", "es"]);
export type ThinkGuessLanguage = z.infer<typeof supportedLanguageSchema>;

export const gameModeSchema = z.enum(["child_guesses", "ai_guesses"]);
export type GameMode = z.infer<typeof gameModeSchema>;

export const roundStatusSchema = z.enum([
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
  "expired",
]);
export type RoundStatus = z.infer<typeof roundStatusSchema>;

export const voiceStateSchema = z.enum([
  "idle",
  "connecting",
  "ai_speaking",
  "child_turn",
  "child_speaking",
  "ai_thinking",
  "round_complete",
  "error",
]);
export type VoiceState = z.infer<typeof voiceStateSchema>;

export const childIntentSchema = z.enum([
  "question",
  "direct_guess",
  "request_hint",
  "reveal_answer",
  "request_repeat",
  "dont_know",
  "off_topic",
  "stop",
  "unclear",
]);
export type ChildIntent = z.infer<typeof childIntentSchema>;

export const answerCategorySchema = z.enum([
  "animal",
  "food",
  "toy",
  "home",
  "transport",
  "fairy_tale",
]);
export type AnswerCategory = z.infer<typeof answerCategorySchema>;

export const answerAttributeSchema = z.enum([
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
  "magical",
]);
export type AnswerAttribute = z.infer<typeof answerAttributeSchema>;

export const broadQuestionTopicSchema = z.enum([
  "color",
  "appearance",
  "action",
  "location",
  "category",
]);
export type BroadQuestionTopic = z.infer<typeof broadQuestionTopicSchema>;

const localizedAnswerSchema = z.object({
  canonical: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
  hints: z.array(z.string().min(1)).length(4),
  facts: z.object({
    color: z.string().min(1),
  }),
});

export const answerObjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  category: answerCategorySchema,
  minimumAge: z.number().int().min(4).max(7),
  difficulty: z.number().int().min(1).max(5),
  attributes: z
    .record(answerAttributeSchema, z.boolean())
    .refine(
      (attributes) => Object.keys(attributes).length >= 4,
      "Each answer needs at least four approved attributes",
    ),
  localized: z.object({
    en: localizedAnswerSchema,
    zh: localizedAnswerSchema,
    es: localizedAnswerSchema,
  }),
  storyConnections: z.array(z.string()).default([]),
});
export type AnswerObject = z.infer<typeof answerObjectSchema>;

export const classifiedTurnSchema = z.object({
  intent: childIntentSchema,
  confidence: z.number().min(0).max(1),
  normalizedGuess: z.string().min(1).optional(),
  attribute: answerAttributeSchema.optional(),
  questionTopic: broadQuestionTopicSchema.optional(),
  expectedValue: z.boolean().optional(),
});
export type ClassifiedTurn = z.infer<typeof classifiedTurnSchema>;

export const roundStateSchema = z.object({
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
  expiresAt: z.number().int(),
});
export type RoundState = z.infer<typeof roundStateSchema>;

export const turnDecisionSchema = z.object({
  status: roundStatusSchema,
  reply: z.string().min(1),
  intent: childIntentSchema,
  turnNumber: z.number().int().nonnegative(),
  hintLevel: z.number().int().min(0).max(5),
  voiceState: voiceStateSchema,
  completion: z
    .object({
      solved: z.boolean(),
      canonicalAnswer: z.string().min(1),
      usefulQuestions: z.number().int().nonnegative(),
      hintsUsed: z.number().int().nonnegative(),
      reasoningLevel: z.number().int().min(1).max(5),
    })
    .optional(),
});
export type TurnDecision = z.infer<typeof turnDecisionSchema>;

export const createRoundRequestSchema = z.object({
  mode: gameModeSchema.default("child_guesses"),
  language: supportedLanguageSchema,
  languageLevel: z.number().int().min(1).max(5),
  reasoningLevel: z.number().int().min(1).max(5),
});
export type CreateRoundRequest = z.infer<typeof createRoundRequestSchema>;

export const createRoundResponseSchema = z.object({
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
    replyAuthority: z.literal("ai_with_server_guardrails"),
  }),
  expiresAt: z.number().int(),
});
export type CreateRoundResponse = z.infer<typeof createRoundResponseSchema>;

export const submitTurnRequestSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
  speechConfidence: z.number().min(0).max(1).optional(),
});
export type SubmitTurnRequest = z.infer<typeof submitTurnRequestSchema>;

export const thinkGuessEventNameSchema = z.enum([
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
  "speech_recovery_requested",
]);
export type ThinkGuessEventName = z.infer<typeof thinkGuessEventNameSchema>;

export const thinkGuessAnalyticsEventSchema = z.object({
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
  timestamp: z.number().int(),
});
export type ThinkGuessAnalyticsEvent = z.infer<
  typeof thinkGuessAnalyticsEventSchema
>;

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.enum([
    "INVALID_REQUEST",
    "ROUND_NOT_FOUND",
    "ROUND_EXPIRED",
    "MODE_NOT_AVAILABLE",
    "ROUND_NOT_ACTIVE",
    "VOICE_UNAVAILABLE",
    "INTERNAL_ERROR",
  ]),
});
export type ThinkGuessApiError = z.infer<typeof apiErrorSchema>;
