import assert from "node:assert/strict";
import test from "node:test";
import {
  THINK_GUESS_AI_PROMPT,
  buildThinkGuessResponseRequest,
  cleanThinkGuessModelReply,
  modelInputFor,
  type ThinkGuessConversationTurn,
} from "./thinkGuessPrompt";

function conversationTurn(
  overrides: Partial<ThinkGuessConversationTurn> = {},
): ThinkGuessConversationTurn {
  return {
    targetLanguage: "en",
    languageLevel: 1,
    reasoningLevel: 2,
    childTranscript: "What colour is it?",
    childIntent: "question",
    outcome: "continue",
    reasoningTurnNumber: 2,
    remainingReasoningTurns: 8,
    turnLimit: 10,
    supportStage: "discover",
    hintLevel: 0,
    hintsUsed: 0,
    remainingHintsBeforeReveal: 3,
    currentFact: "It can be many colours.",
    knownClues: ["It is a vehicle."],
    questionTypesAsked: ["category", "color"],
    previousReply: "Yes, it is a vehicle. That narrows it down!",
    categoryMayBeNamed: true,
    answerMayBeNamed: false,
    secretObject: {
      canonicalAnswer: "bus",
      category: "transport",
      approvedAttributes: { big: true, has_wheels: true },
      seedFacts: ["It can be yellow, red, blue, or white."],
    },
    fallbackReply: "It can be many colours. That helps!",
    ...overrides,
  };
}

test("the platform prompt gives the model conversational freedom inside game rules", () => {
  assert.match(THINK_GUESS_AI_PROMPT, /conversational brain/i);
  assert.match(
    THINK_GUESS_AI_PROMPT,
    /Create your own child-friendly wording/i,
  );
  assert.match(THINK_GUESS_AI_PROMPT, /stable, ordinary knowledge/i);
  assert.match(THINK_GUESS_AI_PROMPT, /Never mention its canonicalAnswer/i);
  assert.doesNotMatch(THINK_GUESS_AI_PROMPT, /Story Buddy/i);
});

test("saved prompt requests include dynamic language and private game state", () => {
  const update = conversationTurn();
  const request = buildThinkGuessResponseRequest(update, {
    THINK_GUESS_PROMPT_ID: "pmpt_think_guess",
    THINK_GUESS_PROMPT_VERSION: "7",
    THINK_GUESS_RESPONSE_MODEL: "gpt-4.1-mini",
  });

  assert.equal(request.model, "gpt-4.1-mini");
  assert.deepEqual(request.prompt, {
    id: "pmpt_think_guess",
    version: "7",
    variables: { target_language: "English" },
  });
  assert.equal(request.instructions, undefined);
  const input = JSON.parse(request.input as string) as Record<string, unknown>;
  assert.equal(input.childTranscript, "What colour is it?");
  assert.equal(
    (input.secretObject as { canonicalAnswer: string }).canonicalAnswer,
    "bus",
  );
  assert.equal("fallbackReply" in input, false);
});

test("the local prompt substitutes the target language when no saved prompt is configured", () => {
  const request = buildThinkGuessResponseRequest(
    conversationTurn({ targetLanguage: "zh" }),
    {},
  );
  assert.match(request.instructions ?? "", /Mandarin Chinese/);
  assert.doesNotMatch(request.instructions ?? "", /\{\{target_language\}\}/);
  assert.equal(request.prompt, undefined);
});

test("model input excludes the robotic fallback sentence", () => {
  const input = modelInputFor(conversationTurn());
  assert.equal("fallbackReply" in input, false);
});

test("plain and legacy JSON model replies are cleaned for speech", () => {
  assert.equal(
    cleanThinkGuessModelReply("  That rules animals out—great clue!  "),
    "That rules animals out—great clue!",
  );
  assert.equal(
    cleanThinkGuessModelReply('{"reply":"That gives us a bright new clue!"}'),
    "That gives us a bright new clue!",
  );
});
