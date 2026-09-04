import assert from "node:assert/strict";
import test from "node:test";
import { THINK_GUESS_ANSWERS } from "./content";
import { ThinkGuessService } from "./engine";
import { InMemoryRoundRepository } from "./repository";
import type { TurnClassifier } from "./classifier";
import type {
  ThinkGuessConversationTurn,
  ThinkGuessResponseWriter,
} from "./thinkGuessPrompt";

function serviceFor(
  answerId: string,
  classifier: TurnClassifier,
  responseWriter: ThinkGuessResponseWriter,
): ThinkGuessService {
  const answer = THINK_GUESS_ANSWERS.find(
    (candidate) => candidate.id === answerId,
  );
  assert.ok(answer, answerId);
  return new ThinkGuessService(
    new InMemoryRoundRepository(() => 100),
    classifier,
    { emit() {} },
    THINK_GUESS_ANSWERS,
    () => 100,
    () => answer,
    responseWriter,
  );
}

async function createRound(service: ThinkGuessService) {
  return service.createRound({
    mode: "child_guesses",
    language: "en",
    languageLevel: 1,
    reasoningLevel: 2,
  });
}

test("AI-led colour answers can use fresh wording instead of a fixed fact sentence", async () => {
  const service = serviceFor(
    "transport_bus",
    {
      async classify() {
        return { intent: "question", questionTopic: "color", confidence: 1 };
      },
    },
    {
      async write(update: ThinkGuessConversationTurn) {
        assert.match(update.currentFact ?? "", /many colours/i);
        assert.equal(update.childTranscript, "What colour is it?");
        return "It can wear lots of colours—yellow, red, blue, or white. That opens up plenty of possibilities!";
      },
    },
  );
  const round = await createRound(service);
  const colour = await service.submitTurn(round.roundId, "What colour is it?");

  assert.match(colour.reply, /wear lots of colours/i);
  assert.match(colour.reply, /yellow, red, blue, or white/i);
});

test("AI-led coaching may introduce safe comparison examples", async () => {
  const service = serviceFor(
    "animal_elephant",
    {
      async classify() {
        return { intent: "question", attribute: "big", confidence: 1 };
      },
    },
    {
      async write() {
        return "Yes, it is big—more like a bus than a toy car. What big things could we rule out next?";
      },
    },
  );
  const round = await createRound(service);
  const decision = await service.submitTurn(round.roundId, "Is it big?");

  assert.match(decision.reply, /more like a bus than a toy car/i);
  assert.equal((decision.reply.match(/\?/g) ?? []).length, 1);
});

test("regression ISSUE-002: unknown recovery never recommends the failed question", async () => {
  // Regression: ISSUE-002 — “Is it big?” returned unknown, then suggested “is it big?”.
  // Found by /qa on 2026-08-29.
  // Report: .gstack/qa-reports/qa-report-storylingo-staging-2026-08-29.md
  const service = serviceFor(
    "food_strawberry",
    {
      async classify() {
        return { intent: "question", attribute: "big", confidence: 1 };
      },
    },
    {
      async write(update: ThinkGuessConversationTurn) {
        return update.fallbackReply;
      },
    },
  );
  const round = await createRound(service);
  const decision = await service.submitTurn(round.roundId, "Is it big?");

  assert.match(decision.reply, /do not have that clue/i);
  assert.match(decision.reply, /what colour is it/i);
  assert.doesNotMatch(decision.reply, /ask(?:ing)? if it is big/i);
});

test("regression ISSUE-004: open action questions return an action, not a location property", async () => {
  // Regression: ISSUE-004 — “What does it do?” answered “you find it at home.”
  // Found by /qa on 2026-08-29.
  // Report: .gstack/qa-reports/qa-report-storylingo-staging-2026-08-29.md
  const service = serviceFor(
    "toy_blocks",
    {
      async classify() {
        return { intent: "question", questionTopic: "action", confidence: 1 };
      },
    },
    {
      async write(update: ThinkGuessConversationTurn) {
        return update.fallbackReply;
      },
    },
  );
  const round = await createRound(service);
  const decision = await service.submitTurn(round.roundId, "What does it do?");

  assert.match(decision.reply, /build towers/i);
  assert.doesNotMatch(decision.reply, /find it at home/i);
});

test("regression ISSUE-005: consecutive unknown questions rotate recovery suggestions", async () => {
  // Regression: two unsupported questions both suggested “What colour is it?”.
  // Found by the child-conversation staging replay on 2026-08-29.
  const service = serviceFor(
    "home_pillow",
    {
      async classify() {
        return { intent: "question", confidence: 1 };
      },
    },
    {
      async write(update: ThinkGuessConversationTurn) {
        return update.fallbackReply;
      },
    },
  );
  const round = await createRound(service);
  const first = await service.submitTurn(round.roundId, "Can it fly?");
  const second = await service.submitTurn(round.roundId, "Is it an animal?");

  assert.match(first.reply, /what colour is it/i);
  assert.match(second.reply, /what does it do/i);
  assert.notEqual(first.reply, second.reply);
});
