import assert from "node:assert/strict";
import test from "node:test";
import {
  THINK_GUESS_AI_PROMPT,
  THINK_GUESS_VOICE_INSTRUCTIONS,
} from "./thinkGuessPrompt";
import {
  classifyTurnHeuristically,
  keepClassificationGrounded,
} from "./classifier";

function countQuestions(reply: string): number {
  return reply.match(/[?？]/g)?.length ?? 0;
}

test("the Think & Guess AI prompt creates varied, bounded child-facing turns", () => {
  // Regression: ISSUE-005 — routine replies grew into 15-second clue recitals.
  // Found by /qa on 2026-08-29.
  // Report: .gstack/qa-reports/qa-report-storylingo-voice-2026-08-29.md
  assert.match(
    THINK_GUESS_AI_PROMPT,
    /Create your own child-friendly wording/i,
  );
  assert.match(THINK_GUESS_AI_PROMPT, /under 45 spoken words/i);
  assert.match(THINK_GUESS_AI_PROMPT, /Ask at most one question/i);
  assert.match(
    THINK_GUESS_AI_PROMPT,
    /Do not repeat a clue already in knownClues/i,
  );
  assert.match(
    THINK_GUESS_AI_PROMPT,
    /Never replace the requested answer with a recap/i,
  );
  assert.equal(countQuestions("Yes, it is big. What should we check next?"), 1);
});

test("regression ISSUE-006: voice direction prevents rushed game-show delivery", () => {
  assert.match(THINK_GUESS_VOICE_INSTRUCTIONS, /relaxed conversational pace/i);
  assert.match(THINK_GUESS_VOICE_INSTRUCTIONS, /Pause naturally/i);
  assert.match(THINK_GUESS_VOICE_INSTRUCTIONS, /not babyish/i);
  assert.match(THINK_GUESS_VOICE_INSTRUCTIONS, /game-show host/i);
  assert.doesNotMatch(THINK_GUESS_VOICE_INSTRUCTIONS, /Story Buddy/i);
});

test("regression ISSUE-007: short and unsupported colour questions stay useful", () => {
  assert.deepEqual(classifyTurnHeuristically("What color?"), {
    intent: "question",
    questionTopic: "color",
    confidence: 0.92,
  });
  assert.deepEqual(classifyTurnHeuristically("Is it blue?"), {
    intent: "question",
    questionTopic: "color",
    confidence: 0.9,
  });
});

test("regression ISSUE-008: a child's self-corrected guess avoids a slow model call", () => {
  const result = classifyTurnHeuristically(
    "Um, is it maybe a bus? No wait, a car?",
  );
  assert.equal(result.intent, "direct_guess");
  assert.equal(result.normalizedGuess, "a car");
  assert.ok(result.confidence >= 0.8);
});

test("regression ISSUE-009: unsupported sound questions do not become unrelated action answers", () => {
  assert.deepEqual(classifyTurnHeuristically("Does it make a sound?"), {
    intent: "question",
    confidence: 0.9,
  });
  assert.deepEqual(classifyTurnHeuristically("Can it make a funny sound?"), {
    intent: "question",
    confidence: 0.9,
  });
});

test("regression ISSUE-010: the model cannot invent a supported fact for an unknown question", () => {
  const heuristic = classifyTurnHeuristically("Does it have a name?");

  assert.deepEqual(
    keepClassificationGrounded(heuristic, {
      intent: "question",
      questionTopic: "category",
      confidence: 0.91,
    }),
    heuristic,
  );
  assert.deepEqual(
    keepClassificationGrounded(classifyTurnHeuristically("Can I wear it?"), {
      intent: "question",
      attribute: "used_at_home",
      expectedValue: true,
      confidence: 0.88,
    }),
    classifyTurnHeuristically("Can I wear it?"),
  );
});

test("regression ISSUE-011: the classifier accepts the location question the game suggests", () => {
  for (const transcript of [
    "Where might I find it?",
    "Where do I find it?",
    "Where can we find it?",
  ]) {
    assert.deepEqual(classifyTurnHeuristically(transcript), {
      intent: "question",
      questionTopic: "location",
      confidence: 0.92,
    });
  }
});
