import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { THINK_GUESS_ANSWERS } from "./content";
import { ThinkGuessService } from "./engine";
import { InMemoryRoundRepository } from "./repository";
import { classifyTurnHeuristically } from "./classifier";
import { registerThinkGuessRoutes } from "./routes";

async function withApi(
  run: (
    baseUrl: string,
    advance: (milliseconds: number) => void,
  ) => Promise<void>,
  options: {
    fetchImpl?: typeof fetch;
    analytics?: { emit(event: unknown): void };
  } = {},
) {
  let now = Date.now();
  const repository = new InMemoryRoundRepository(() => now);
  const service = new ThinkGuessService(
    repository,
    {
      async classify(transcript, _language, confidence) {
        return classifyTurnHeuristically(transcript, confidence);
      },
    },
    { emit() {} },
    THINK_GUESS_ANSWERS,
    () => now,
    (eligible) =>
      eligible.find((answer) => answer.id === "animal_elephant") ?? eligible[0],
  );
  const app = express();
  app.use(express.json());
  registerThinkGuessRoutes(app, {
    repository,
    service,
    analytics: options.analytics ?? { emit() {} },
    fetchImpl:
      options.fetchImpl ??
      (async () =>
        new Response(
          JSON.stringify({ value: "ephemeral-test-secret", expires_at: 12345 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )),
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`, (milliseconds) => {
      now += milliseconds;
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function createRound(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/think-guess/rounds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "child_guesses",
      language: "en",
      languageLevel: 1,
      reasoningLevel: 2,
    }),
  });
  assert.equal(response.status, 201);
  return response.json() as Promise<{
    roundId: string;
    opening: string;
    expiresAt: number;
    voiceSession: {
      transport: string;
      interaction: string;
      replyAuthority: string;
    };
  }>;
}

test("round API validates input and never exposes the secret", async () =>
  withApi(async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/think-guess/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "fr" }),
    });
    assert.equal(invalid.status, 400);
    const round = await createRound(baseUrl);
    assert.equal(JSON.stringify(round).includes("elephant"), false);
    assert.match(round.opening, /animal/i);
    assert.deepEqual(round.voiceSession, {
      transport: "webrtc",
      interaction: "push_to_talk",
      replyAuthority: "ai_with_server_guardrails",
    });
  }));

test("separate rounds do not share state and valid turns complete deterministically", async () =>
  withApi(async (baseUrl) => {
    const first = await createRound(baseUrl);
    const second = await createRound(baseUrl);
    assert.notEqual(first.roundId, second.roundId);
    const question = await fetch(
      `${baseUrl}/api/think-guess/rounds/${first.roundId}/turns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Is it big?" }),
      },
    );
    assert.equal(
      ((await question.json()) as { turnNumber: number }).turnNumber,
      1,
    );
    const guess = await fetch(
      `${baseUrl}/api/think-guess/rounds/${first.roundId}/turns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Elephant!" }),
      },
    );
    const solved = (await guess.json()) as {
      status: string;
      completion?: { solved: boolean };
    };
    assert.equal(solved.status, "solved");
    assert.equal(solved.completion?.solved, true);
    const secondQuestion = await fetch(
      `${baseUrl}/api/think-guess/rounds/${second.roundId}/turns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Can it fly?" }),
      },
    );
    assert.equal(
      ((await secondQuestion.json()) as { turnNumber: number }).turnNumber,
      1,
    );
  }));

test("answer reveal stays locked until the round has issued three hints", async () =>
  withApi(async (baseUrl) => {
    const round = await createRound(baseUrl);
    const submit = async (transcript: string) => {
      const response = await fetch(
        `${baseUrl}/api/think-guess/rounds/${round.roundId}/turns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript }),
        },
      );
      assert.equal(response.status, 200);
      return response.json() as Promise<{
        status: string;
        reply: string;
        hintLevel: number;
        completion?: { solved: boolean; canonicalAnswer: string };
      }>;
    };

    const locked = await submit("Tell me the answer.");
    assert.equal(locked.status, "waiting_for_child");
    assert.equal(locked.completion, undefined);
    assert.equal(JSON.stringify(locked).includes("elephant"), false);

    for (let level = 1; level <= 3; level += 1) {
      const hint = await submit("Give me a clue.");
      assert.equal(hint.hintLevel, level);
      assert.equal(JSON.stringify(hint).includes("elephant"), false);
    }

    const revealed = await submit("Tell me the answer.");
    assert.equal(revealed.status, "complete");
    assert.equal(revealed.completion?.solved, false);
    assert.equal(revealed.completion?.canonicalAnswer, "elephant");
  }));

test("the server reveals and recaps the mystery after ten reasoning turns", async () =>
  withApi(async (baseUrl) => {
    const round = await createRound(baseUrl);
    let latest: {
      status: string;
      reply: string;
      completion?: { solved: boolean; canonicalAnswer: string };
    } | null = null;

    for (let turn = 1; turn <= 10; turn += 1) {
      const response = await fetch(
        `${baseUrl}/api/think-guess/rounds/${round.roundId}/turns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: "Is it big?" }),
        },
      );
      assert.equal(response.status, 200);
      latest = (await response.json()) as typeof latest;
      if (turn < 10) assert.equal(latest?.status, "waiting_for_child");
    }

    assert.equal(latest?.status, "complete");
    assert.equal(latest?.completion?.solved, false);
    assert.equal(latest?.completion?.canonicalAnswer, "elephant");
    assert.match(latest?.reply ?? "", /nice thinking/i);
  }));

test("missing and expired rounds return typed recovery errors", async () =>
  withApi(async (baseUrl, advance) => {
    const missing = await fetch(
      `${baseUrl}/api/think-guess/rounds/${crypto.randomUUID()}/turns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Hello" }),
      },
    );
    assert.equal(missing.status, 404);
    assert.equal(
      ((await missing.json()) as { code: string }).code,
      "ROUND_NOT_FOUND",
    );
    const round = await createRound(baseUrl);
    advance(31 * 60 * 1000);
    const expired = await fetch(
      `${baseUrl}/api/think-guess/rounds/${round.roundId}/turns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Hello" }),
      },
    );
    assert.equal(expired.status, 410);
    assert.equal(
      ((await expired.json()) as { code: string }).code,
      "ROUND_EXPIRED",
    );
  }));

test("AI Guesses is explicitly unavailable", async () =>
  withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/think-guess/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "ai_guesses",
        language: "en",
        languageLevel: 1,
        reasoningLevel: 2,
      }),
    });
    assert.equal(response.status, 409);
    assert.equal(
      ((await response.json()) as { code: string }).code,
      "MODE_NOT_AVAILABLE",
    );
  }));

test("stop closes a round and later turns receive a typed inactive response", async () =>
  withApi(async (baseUrl) => {
    const round = await createRound(baseUrl);
    const stopped = await fetch(
      `${baseUrl}/api/think-guess/rounds/${round.roundId}/stop`,
      { method: "POST" },
    );
    assert.equal(stopped.status, 200);
    assert.equal(
      ((await stopped.json()) as { status: string }).status,
      "stopped",
    );

    const laterTurn = await fetch(
      `${baseUrl}/api/think-guess/rounds/${round.roundId}/turns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "Is it big?" }),
      },
    );
    assert.equal(laterTurn.status, 409);
    assert.equal(
      ((await laterTurn.json()) as { code: string }).code,
      "ROUND_NOT_ACTIVE",
    );
  }));

test("concurrent API turns are serialized without losing updates", async () =>
  withApi(async (baseUrl) => {
    const round = await createRound(baseUrl);
    const responses = await Promise.all(
      ["Is it big?", "Does it have four legs?"].map((transcript) =>
        fetch(`${baseUrl}/api/think-guess/rounds/${round.roundId}/turns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript }),
        }),
      ),
    );
    const turns = await Promise.all(
      responses.map((response) =>
        response
          .json()
          .then((body) => (body as { turnNumber: number }).turnNumber),
      ),
    );
    assert.deepEqual(turns.sort(), [1, 2]);
  }));

test("realtime credentials are game-specific and do not expose the answer", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-api-key";
  try {
    await withApi(async (baseUrl) => {
      const round = await createRound(baseUrl);
      const response = await fetch(
        `${baseUrl}/api/think-guess/rounds/${round.roundId}/realtime-token`,
        { method: "POST" },
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body, {
        client_secret: "ephemeral-test-secret",
        expires_at: 12345,
      });
      assert.equal(JSON.stringify(body).includes("elephant"), false);
    });
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("realtime credential failures return a typed, retryable response", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    await withApi(async (baseUrl) => {
      const round = await createRound(baseUrl);
      const response = await fetch(
        `${baseUrl}/api/think-guess/rounds/${round.roundId}/realtime-token`,
        { method: "POST" },
      );
      assert.equal(response.status, 503);
      assert.equal(
        ((await response.json()) as { code: string }).code,
        "VOICE_UNAVAILABLE",
      );
    });

    process.env.OPENAI_API_KEY = "test-api-key";
    const failures: { fetchImpl: typeof fetch; expectedStatus: number }[] = [
      {
        fetchImpl: async () => new Response("upstream failed", { status: 500 }),
        expectedStatus: 502,
      },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ value: "" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        expectedStatus: 502,
      },
      {
        fetchImpl: async () => {
          throw new Error("network unavailable");
        },
        expectedStatus: 502,
      },
    ];

    for (const failure of failures) {
      await withApi(
        async (baseUrl) => {
          const round = await createRound(baseUrl);
          const response = await fetch(
            `${baseUrl}/api/think-guess/rounds/${round.roundId}/realtime-token`,
            { method: "POST" },
          );
          assert.equal(response.status, failure.expectedStatus);
          assert.equal(
            ((await response.json()) as { code: string }).code,
            "VOICE_UNAVAILABLE",
          );
        },
        { fetchImpl: failure.fetchImpl },
      );
    }
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("analytics endpoint accepts only the privacy-safe event contract", async () => {
  const events: unknown[] = [];
  await withApi(
    async (baseUrl) => {
      const valid = await fetch(`${baseUrl}/api/think-guess/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "think_guess_entry_tapped",
          language: "en",
          languageLevel: 1,
          reasoningLevel: 2,
          timestamp: 12345,
        }),
      });
      assert.equal(valid.status, 202);
      assert.deepEqual(await valid.json(), { accepted: true });
      assert.equal(events.length, 1);

      const untrusted = await fetch(`${baseUrl}/api/think-guess/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "think_guess_entry_tapped",
          language: "en",
          languageLevel: 1,
          reasoningLevel: 2,
          timestamp: 12345,
          transcript: "my private words",
          secretAnswer: "elephant",
        }),
      });
      assert.equal(untrusted.status, 202);
      assert.equal(events.length, 2);
      assert.equal(
        JSON.stringify(events[1]).includes("my private words"),
        false,
      );
      assert.equal(JSON.stringify(events[1]).includes("elephant"), false);

      const invalid = await fetch(`${baseUrl}/api/think-guess/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "raw_transcript_saved",
          transcript: "no",
        }),
      });
      assert.equal(invalid.status, 400);
      assert.equal(
        ((await invalid.json()) as { code: string }).code,
        "INVALID_REQUEST",
      );
      assert.equal(events.length, 2);
    },
    { analytics: { emit: (event) => events.push(event) } },
  );
});
