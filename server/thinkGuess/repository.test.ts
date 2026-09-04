import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { roundStateSchema, type RoundState } from "@shared/thinkGuess";
import { InMemoryRoundRepository } from "./repository";

function round(createdAt: number, expiresAt: number): RoundState {
  return roundStateSchema.parse({
    id: randomUUID(),
    mode: "child_guesses",
    language: "en",
    languageLevel: 1,
    reasoningLevel: 2,
    answerId: "toy_ball",
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
    lastReply: "Ask me a question.",
    createdAt,
    updatedAt: createdAt,
    expiresAt,
  });
}

test("repository prunes expired rounds while accepting new rounds", async () => {
  let now = 100;
  const repository = new InMemoryRoundRepository(() => now, 2);
  const expired = round(100, 150);
  const active = round(100, 300);
  await repository.create(expired);
  await repository.create(active);

  now = 200;
  const newest = round(200, 400);
  await repository.create(newest);

  assert.deepEqual(await repository.get(expired.id), { kind: "missing" });
  assert.equal((await repository.get(active.id)).kind, "found");
  assert.equal((await repository.get(newest.id)).kind, "found");
});

test("repository evicts the oldest round when its active-round cap is full", async () => {
  const repository = new InMemoryRoundRepository(() => 100, 2);
  const oldest = round(10, 500);
  const middle = round(20, 500);
  const newest = round(30, 500);
  await repository.create(oldest);
  await repository.create(middle);
  await repository.create(newest);

  assert.deepEqual(await repository.get(oldest.id), { kind: "missing" });
  assert.equal((await repository.get(middle.id)).kind, "found");
  assert.equal((await repository.get(newest.id)).kind, "found");
});
