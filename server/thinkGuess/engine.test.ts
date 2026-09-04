import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type {
  AnswerObject,
  ClassifiedTurn,
  RoundState,
  ThinkGuessLanguage,
} from "@shared/thinkGuess";
import { THINK_GUESS_ANSWERS } from "./content";
import { applyTurn, supportStageFor, ThinkGuessService } from "./engine";
import { InMemoryRoundRepository } from "./repository";
import type { TurnClassifier } from "./classifier";
import { classifyTurnHeuristically } from "./classifier";
import type { ThinkGuessAnalytics } from "./analytics";

const elephant = THINK_GUESS_ANSWERS.find(
  (answer) => answer.id === "animal_elephant",
)!;

function state(overrides: Partial<RoundState> = {}): RoundState {
  return {
    id: randomUUID(),
    mode: "child_guesses",
    language: "en",
    languageLevel: 1,
    reasoningLevel: 2,
    answerId: elephant.id,
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
    lastReply: "I am thinking of an animal. Ask me a question.",
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 1_000_000,
    ...overrides,
  };
}

function turn(
  classification: ClassifiedTurn,
  current = state(),
  answer: AnswerObject = elephant,
) {
  return applyTurn(current, answer, classification, THINK_GUESS_ANSWERS, 10);
}

test("localized openings use the correct category article", async () => {
  const expected: Record<ThinkGuessLanguage, string> = {
    en: "I am thinking of an animal. Ask me a question.",
    zh: "我想的是一种动物。问我一个问题吧。",
    es: "Estoy pensando en un animal. Hazme una pregunta.",
  };

  for (const language of Object.keys(expected) as ThinkGuessLanguage[]) {
    const service = new ThinkGuessService(
      new InMemoryRoundRepository(() => 100),
      {
        async classify() {
          return { intent: "unclear", confidence: 1 };
        },
      },
      { emit() {} },
      THINK_GUESS_ANSWERS,
      () => 100,
      () => elephant,
    );
    const created = await service.createRound({
      mode: "child_guesses",
      language,
      languageLevel: 1,
      reasoningLevel: 2,
    });
    assert.equal(created.opening, expected[language]);
  }
});

test("approved questions answer only the structured fact", () => {
  const yes = turn({ intent: "question", attribute: "big", confidence: 1 });
  const no = turn({ intent: "question", attribute: "flies", confidence: 1 });
  const unknown = turn({ intent: "question", confidence: 1 });
  assert.match(yes.decision.reply, /^Yes, it is big\. Nice clue!$/);
  assert.equal(yes.state.usefulQuestions, 1);
  assert.match(no.decision.reply, /^No, it cannot fly\. Nice clue!$/);
  assert.doesNotMatch(unknown.decision.reply, /not sure/i);
  assert.match(unknown.decision.reply, /do not have that clue/i);
  assert.equal(unknown.state.usefulQuestions, 0);
});

test("broad appearance, action, location, and category questions get bounded answers", () => {
  const expected: [ClassifiedTurn["questionTopic"], RegExp][] = [
    ["appearance", /it is big/i],
    ["action", /move around like an animal/i],
    ["location", /where animals live/i],
    ["category", /it is an animal/i],
  ];

  for (const [questionTopic, fact] of expected) {
    const result = turn({ intent: "question", questionTopic, confidence: 1 });
    assert.match(result.decision.reply, fact);
    assert.doesNotMatch(result.decision.reply, /not sure/i);
    assert.doesNotMatch(result.decision.reply, /elephant/i);
    assert.equal(result.state.usefulQuestions, 1);
    assert.equal(result.state.hintLevel, 0);
  }
});

test("open colour questions return the object's approved colour fact", () => {
  const bus = THINK_GUESS_ANSWERS.find(
    (answer) => answer.id === "transport_bus",
  )!;
  const utterances = [
    "What colour is it?",
    "What color is it?",
    "¿De qué color es?",
    "它是什么颜色？",
  ];

  for (const utterance of utterances) {
    const classified = classifyTurnHeuristically(utterance, 0.96);
    assert.equal(classified.intent, "question", utterance);
    assert.equal(classified.questionTopic, "color", utterance);
  }

  const result = turn(
    {
      intent: "question",
      questionTopic: "color",
      confidence: 1,
    } as ClassifiedTurn,
    state({
      answerId: bus.id,
      knownClues: ["It is a vehicle."],
      lastReply: "It is a vehicle.",
    }),
    bus,
  );

  assert.match(result.decision.reply, /it can be many colours/i);
  assert.doesNotMatch(result.decision.reply, /it is big/i);
  assert.ok(result.state.knownClues.some((clue) => /colours/i.test(clue)));
});

test("localized aliases solve without leaking the answer before completion", () => {
  const english = turn({
    intent: "direct_guess",
    normalizedGuess: "an elephant",
    confidence: 1,
  });
  const chinese = turn(
    { intent: "direct_guess", normalizedGuess: "一只大象", confidence: 1 },
    state({ language: "zh" }),
  );
  const spanish = turn(
    { intent: "direct_guess", normalizedGuess: "un elefante", confidence: 1 },
    state({ language: "es" }),
  );
  for (const result of [english, chinese, spanish]) {
    assert.equal(result.state.status, "solved");
    assert.equal(result.decision.completion?.solved, true);
  }
  const wrong = turn({
    intent: "direct_guess",
    normalizedGuess: "tiger",
    confidence: 1,
  });
  assert.doesNotMatch(wrong.decision.reply, /elephant/i);
  assert.match(wrong.decision.reply, /not tiger/i);
  assert.match(wrong.decision.reply, /cross that idea off/i);
  assert.doesNotMatch(wrong.decision.reply, /^no\b/i);
});

test("hint ladder advances through strategy, facts, and choices", () => {
  let current = state();
  const replies: string[] = [];
  for (let level = 1; level <= 5; level += 1) {
    const result = turn({ intent: "request_hint", confidence: 1 }, current);
    current = result.state;
    replies.push(result.decision.reply);
    assert.equal(result.state.hintLevel, level);
  }
  assert.match(replies[0], /kind of thing/i);
  assert.match(replies[1], new RegExp(elephant.localized.en.hints[0], "i"));
  assert.match(replies[4], /elephant/i);
});

test("the answer can be revealed only after three hints", () => {
  const locked = turn(
    { intent: "reveal_answer", confidence: 1 },
    state({ hintLevel: 2, hintsUsed: 2 }),
  );
  assert.equal(locked.state.status, "waiting_for_child");
  assert.equal(locked.decision.completion, undefined);
  assert.doesNotMatch(locked.decision.reply, /elephant/i);

  const revealed = turn(
    { intent: "reveal_answer", confidence: 1 },
    state({ hintLevel: 3, hintsUsed: 3, usefulQuestions: 1 }),
  );
  assert.equal(revealed.state.status, "complete");
  assert.equal(revealed.decision.voiceState, "round_complete");
  assert.equal(revealed.decision.completion?.solved, false);
  assert.equal(revealed.decision.completion?.canonicalAnswer, "elephant");
  assert.equal(revealed.decision.completion?.hintsUsed, 3);
  assert.match(revealed.decision.reply, /answer is elephant/i);
});

test("answer reveals use the selected language", () => {
  const cases: [ThinkGuessLanguage, RegExp][] = [
    ["en", /answer is elephant/i],
    ["zh", /答案是大象/],
    ["es", /respuesta es elefante/i],
  ];
  for (const [language, expected] of cases) {
    const revealed = turn(
      { intent: "reveal_answer", confidence: 1 },
      state({ language, hintLevel: 3, hintsUsed: 3 }),
    );
    assert.match(revealed.decision.reply, expected);
    assert.equal(revealed.decision.completion?.solved, false);
  }
});

test("three consecutive unsupported guesses trigger strategy coaching", () => {
  let current = state();
  for (const guess of ["lion", "tiger"])
    current = turn(
      { intent: "direct_guess", normalizedGuess: guess, confidence: 1 },
      current,
    ).state;
  const coached = turn(
    { intent: "direct_guess", normalizedGuess: "giraffe", confidence: 1 },
    current,
  );
  assert.match(coached.decision.reply, /not giraffe/i);
  assert.match(coached.decision.reply, /clue to narrow it down/i);
  assert.equal(coached.state.consecutiveDirectGuesses, 0);
});

test("repeat, don't know, off-topic, unclear, and stop are recoverable deterministic transitions", () => {
  assert.match(
    turn({ intent: "request_repeat", confidence: 1 }).decision.reply,
    /thinking of an animal/i,
  );
  assert.equal(
    turn({ intent: "dont_know", confidence: 1 }).state.dontKnowCount,
    1,
  );
  assert.match(
    turn({ intent: "off_topic", confidence: 1 }).decision.reply,
    /mystery/i,
  );
  assert.equal(
    turn({ intent: "unclear", confidence: 1 }).state.speechFailures,
    1,
  );
  assert.equal(turn({ intent: "stop", confidence: 1 }).state.status, "stopped");
});

test("only questions, guesses, and clue requests consume the ten reasoning turns", () => {
  let current = state();
  for (const intent of [
    "request_repeat",
    "dont_know",
    "off_topic",
    "unclear",
  ] as const) {
    current = turn({ intent, confidence: 1 }, current).state;
  }
  assert.equal(current.turnNumber, 4);
  assert.equal(current.reasoningTurnNumber, 0);

  current = turn(
    { intent: "question", attribute: "big", confidence: 1 },
    current,
  ).state;
  current = turn(
    { intent: "direct_guess", normalizedGuess: "tiger", confidence: 1 },
    current,
  ).state;
  current = turn({ intent: "request_hint", confidence: 1 }, current).state;
  assert.equal(current.reasoningTurnNumber, 3);
});

test("support progresses through discover, connect, coach, narrow, and resolves on turn ten", () => {
  assert.equal(supportStageFor(1), "discover");
  assert.equal(supportStageFor(4), "connect");
  assert.equal(supportStageFor(7), "coach");
  assert.equal(supportStageFor(9), "narrow");
  assert.equal(supportStageFor(10), "resolve");

  let current = state();
  const replies: string[] = [];
  for (let reasoningTurn = 1; reasoningTurn <= 10; reasoningTurn += 1) {
    const result = turn(
      { intent: "question", attribute: "big", confidence: 1 },
      current,
    );
    current = result.state;
    replies.push(result.decision.reply);
  }

  assert.match(replies[0], /^Yes, it is big\. Nice clue!$/);
  assert.doesNotMatch(replies[3], /clue collection/i);
  assert.match(replies[6], /one more clue/i);
  assert.match(replies[8], /one last choice/i);
  assert.match(replies[8], /elephant/i);
  assert.equal(current.reasoningTurnNumber, 10);
  assert.equal(current.status, "complete");
  assert.match(replies[9], /answer is elephant/i);
  assert.match(replies[9], /nice thinking/i);
});

test("the AI response writer may create freely but cannot leak or remove the secret answer", async () => {
  const makeService = (reply: string) => {
    const repository = new InMemoryRoundRepository(() => 100);
    const service = new ThinkGuessService(
      repository,
      {
        async classify() {
          return {
            intent: "question",
            attribute: "big",
            confidence: 1,
          } as const;
        },
      },
      { emit() {} },
      THINK_GUESS_ANSWERS,
      () => 100,
      () => elephant,
      {
        async write() {
          return reply;
        },
      },
    );
    return { repository, service };
  };

  const warm = makeService("Yes, it is big. That helps us narrow it down!");
  const warmRound = await warm.service.createRound({
    mode: "child_guesses",
    language: "en",
    languageLevel: 1,
    reasoningLevel: 2,
  });
  const warmDecision = await warm.service.submitTurn(
    warmRound.roundId,
    "Is it big?",
  );
  assert.match(warmDecision.reply, /helps us narrow/i);

  const leaking = makeService("The answer is elephant!");
  const leakingRound = await leaking.service.createRound({
    mode: "child_guesses",
    language: "en",
    languageLevel: 1,
    reasoningLevel: 2,
  });
  const protectedDecision = await leaking.service.submitTurn(
    leakingRound.roundId,
    "Is it big?",
  );
  assert.doesNotMatch(protectedDecision.reply, /elephant/i);
  assert.match(protectedDecision.reply, /yes, it is big/i);
});

test("AI response failures and hard-rule violations fall back safely", async () => {
  const candidates: (string | (() => Promise<string>))[] = [
    "",
    "word ".repeat(130),
    "Yes, it is big. Our clue collection says we should investigate.",
    "Yes! What colour is it? Where would you find it?",
    async () => {
      throw new Error("writer unavailable");
    },
  ];

  for (const candidate of candidates) {
    const repository = new InMemoryRoundRepository(() => 100);
    const service = new ThinkGuessService(
      repository,
      {
        async classify() {
          return {
            intent: "question",
            attribute: "big",
            confidence: 1,
          } as const;
        },
      },
      { emit() {} },
      THINK_GUESS_ANSWERS,
      () => 100,
      () => elephant,
      {
        async write() {
          return typeof candidate === "string" ? candidate : candidate();
        },
      },
    );
    const round = await service.createRound({
      mode: "child_guesses",
      language: "en",
      languageLevel: 1,
      reasoningLevel: 2,
    });
    const decision = await service.submitTurn(round.roundId, "Is it big?");
    assert.equal(decision.reply, "Yes, it is big. Nice clue!");
  }

  const repository = new InMemoryRoundRepository(() => 100);
  const solvedService = new ThinkGuessService(
    repository,
    {
      async classify() {
        return {
          intent: "direct_guess",
          normalizedGuess: "elephant",
          confidence: 1,
        } as const;
      },
    },
    { emit() {} },
    THINK_GUESS_ANSWERS,
    () => 100,
    () => elephant,
    {
      async write() {
        return "Wonderful thinking!";
      },
    },
  );
  const solvedRound = await solvedService.createRound({
    mode: "child_guesses",
    language: "en",
    languageLevel: 1,
    reasoningLevel: 2,
  });
  const solved = await solvedService.submitTurn(
    solvedRound.roundId,
    "Elephant!",
  );
  assert.equal(solved.status, "solved");
  assert.match(solved.reply, /elephant/i);
});

test("terminal rounds are immutable and return an already-finished response", () => {
  for (const status of [
    "solved",
    "complete",
    "stopped",
    "abandoned",
    "expired",
  ] as const) {
    const current = state({ status, turnNumber: 4, hintLevel: 2 });
    const result = turn(
      { intent: "question", attribute: "big", confidence: 1 },
      current,
    );
    assert.equal(result.state, current);
    assert.equal(result.decision.status, status);
    assert.equal(result.decision.turnNumber, 4);
    assert.equal(result.decision.hintLevel, 2);
  }
});

test("round creation falls back to the content library when no answer matches difficulty", async () => {
  const hardAnswer = { ...elephant, difficulty: 5 as const };
  const service = new ThinkGuessService(
    new InMemoryRoundRepository(() => 100),
    {
      async classify() {
        return { intent: "unclear", confidence: 1 } as const;
      },
    },
    { emit() {} },
    [hardAnswer],
    () => 100,
    (eligible) => {
      assert.deepEqual(eligible, [hardAnswer]);
      return eligible[0];
    },
  );
  const created = await service.createRound({
    mode: "child_guesses",
    language: "en",
    languageLevel: 1,
    reasoningLevel: 1,
  });
  assert.match(created.opening, /animal/i);
});

test("repository reports expiry and service serializes concurrent turns", async () => {
  let now = 100;
  const repository = new InMemoryRoundRepository(() => now);
  const classifier: TurnClassifier = {
    async classify() {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { intent: "question", attribute: "big", confidence: 1 };
    },
  };
  const analytics: ThinkGuessAnalytics = { emit() {} };
  const service = new ThinkGuessService(
    repository,
    classifier,
    analytics,
    THINK_GUESS_ANSWERS,
    () => now,
    () => elephant,
  );
  const created = await service.createRound({
    mode: "child_guesses",
    language: "en",
    languageLevel: 1,
    reasoningLevel: 2,
  });
  const [first, second] = await Promise.all([
    service.submitTurn(created.roundId, "Is it big?"),
    service.submitTurn(created.roundId, "Is it big?"),
  ]);
  assert.deepEqual([first.turnNumber, second.turnNumber].sort(), [1, 2]);
  now = created.expiresAt + 1;
  await assert.rejects(
    () => service.submitTurn(created.roundId, "Is it big?"),
    /expired/i,
  );
});

test("malformed classifier output cannot mutate authoritative state", async () => {
  const repository = new InMemoryRoundRepository(() => 100);
  const classifier = {
    async classify() {
      return {
        intent: "invent_answer",
        confidence: 1,
      } as unknown as ClassifiedTurn;
    },
  };
  const service = new ThinkGuessService(
    repository,
    classifier,
    { emit() {} },
    THINK_GUESS_ANSWERS,
    () => 100,
    () => elephant,
  );
  const created = await service.createRound({
    mode: "child_guesses",
    language: "en",
    languageLevel: 1,
    reasoningLevel: 2,
  });
  await assert.rejects(() => service.submitTurn(created.roundId, "Elephant"));
  const round = await service.assertRoundAvailable(created.roundId);
  assert.equal(round.turnNumber, 0);
  assert.equal(round.status, "waiting_for_child");
});
