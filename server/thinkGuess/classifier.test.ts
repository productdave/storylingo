import assert from "node:assert/strict";
import test from "node:test";
import { classifyTurnHeuristically } from "./classifier";

test("messy child utterances map to bounded game intents", () => {
  const cases = [
    ["Is it um... is it big?", "question", "big"],
    ["Does it... have... wings?", "question", "has_wings"],
    ["Tiger!", "direct_guess", undefined],
    ["No no no, I mean lion.", "direct_guess", undefined],
    ["大的吗?", "question", "big"],
    ["我不知道。", "dont_know", undefined],
    ["¿Puede volar?", "question", "flies"],
    ["Dame una pista.", "request_hint", undefined],
    ["Tell me the answer.", "reveal_answer", undefined],
    ["告诉我答案。", "reveal_answer", undefined],
    ["Dime la respuesta.", "reveal_answer", undefined],
    ["Poo poo!", "off_topic", undefined],
    ["I don't want to play anymore.", "stop", undefined],
  ] as const;

  for (const [utterance, intent, attribute] of cases) {
    const classified = classifyTurnHeuristically(utterance);
    assert.equal(classified.intent, intent, utterance);
    assert.equal(classified.attribute, attribute, utterance);
  }
  assert.equal(
    classifyTurnHeuristically("No no no, I mean lion.").normalizedGuess,
    "lion",
  );
});

test("low-confidence speech requests a repeat instead of pretending", () => {
  assert.equal(classifyTurnHeuristically("ele...", 0.2).intent, "unclear");
});

test("broad questions suggested by the game map to answerable topics", () => {
  const cases = [
    ["What does it look like? What it does?", "appearance"],
    ["What does it do?", "action"],
    ["Where do you find it?", "location"],
    ["What kind of thing is it?", "category"],
    ["它长什么样？", "appearance"],
    ["它会做什么？", "action"],
    ["在哪里能找到它？", "location"],
    ["¿Cómo es?", "appearance"],
    ["¿Qué hace?", "action"],
    ["¿Dónde se encuentra?", "location"],
  ] as const;

  for (const [utterance, questionTopic] of cases) {
    const classified = classifyTurnHeuristically(utterance);
    assert.equal(classified.intent, "question", utterance);
    assert.equal(classified.questionTopic, questionTopic, utterance);
    assert.ok(classified.confidence >= 0.8, utterance);
  }
});
