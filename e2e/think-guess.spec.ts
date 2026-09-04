import { expect, test, type Page, type Route } from "@playwright/test";

const roundId = "11111111-1111-4111-8111-111111111111";

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockRoundApi(
  page: Page,
  turn: (route: Route) => Promise<void> = (route) =>
    json(route, 200, {
      status: "waiting_for_child",
      reply: "It is very big.",
      intent: "request_hint",
      turnNumber: 1,
      hintLevel: 1,
      voiceState: "ai_speaking",
    }),
  voiceTokenAvailable = false,
) {
  await page.route("**/api/think-guess/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/rounds")) {
      return json(route, 201, {
        roundId,
        mode: "child_guesses",
        status: "waiting_for_child",
        opening: "I am thinking of an animal. Ask me a question.",
        category: "animal",
        turnNumber: 0,
        voiceState: "ai_speaking",
        voiceSession: {
          transport: "webrtc",
          interaction: "push_to_talk",
          replyAuthority: "ai_with_server_guardrails",
        },
        expiresAt: Date.now() + 1_000_000,
      });
    }
    if (url.pathname.endsWith("/turns")) return turn(route);
    if (url.pathname.endsWith("/stop")) {
      return json(route, 200, {
        status: "stopped",
        reply: "Okay, we can stop now.",
        intent: "stop",
        turnNumber: 1,
        hintLevel: 0,
        voiceState: "idle",
      });
    }
    if (url.pathname.endsWith("/realtime-token")) {
      if (voiceTokenAvailable) {
        return json(route, 200, {
          client_secret: "ephemeral-test-secret",
          expires_at: Date.now() + 60_000,
        });
      }
      return json(route, 503, {
        code: "VOICE_UNAVAILABLE",
        error: "Voice unavailable",
      });
    }
    return json(route, 202, { accepted: true });
  });
  await page.route("**/api/think-guess/events", (route) =>
    json(route, 202, { accepted: true }),
  );
}

async function mockRealtimeBrowser(page: Page) {
  await page.addInitScript(() => {
    const audioTrack = { enabled: false, stop() {} };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getAudioTracks: () => [audioTrack],
          getTracks: () => [audioTrack],
        }),
      },
    });

    class FakeDataChannel {
      readyState = "open";
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;

      close() {}

      send(message: string) {
        const event = JSON.parse(message) as { type?: string };
        if (event.type === "response.create") {
          window.setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({ type: "response.done" }),
            });
          }, 0);
        }
      }
    }

    class FakePeerConnection {
      connectionState = "new";
      localDescription = { type: "offer", sdp: "v=0" };
      onconnectionstatechange: (() => void) | null = null;
      ontrack: (() => void) | null = null;
      private channel: FakeDataChannel | null = null;

      addTrack() {}
      close() {}

      createDataChannel() {
        this.channel = new FakeDataChannel();
        return this.channel;
      }

      async createOffer() {
        return this.localDescription;
      }

      async setLocalDescription() {}

      async setRemoteDescription() {
        this.connectionState = "connected";
        this.onconnectionstatechange?.();
        this.channel?.onopen?.();
      }
    }

    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      value: FakePeerConnection,
    });
  });

  await page.route("https://api.openai.com/v1/realtime/calls", (route) =>
    route.fulfill({ status: 200, contentType: "application/sdp", body: "v=0" }),
  );
}

async function openModeSelector(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("card-think-guess")).toBeVisible();
  await page.getByTestId("card-think-guess").click();
  await expect(page.getByTestId("mode-i-guess")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.setViewportSize({ width: 390, height: 844 });
});

test("Home exposes stories and Think & Guess without regressing story navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("button-start")).toContainText(
    "Story Adventures",
  );
  await expect(page.getByTestId("card-think-guess")).toContainText(
    "Think & Guess",
  );
  await page.getByTestId("button-start").click();
  await expect(page.getByTestId(/^card-story-/).first()).toBeVisible();
});

test("mode selector supports language choice and clearly disables AI Guesses", async ({
  page,
}) => {
  await openModeSelector(page);
  await expect(page.getByTestId("mode-ai-guesses-disabled")).toContainText(
    "Coming soon",
  );
  await page.getByTestId("language-es").click();
  await expect(page.getByTestId("mode-i-guess")).toContainText("Yo adivino");
  await expect(page.getByTestId("mode-ai-guesses-disabled")).toContainText(
    "Próximamente",
  );
});

test("I Guess starts, shows one prompt, requests a clue, and exits", async ({
  page,
}) => {
  await mockRoundApi(page);
  await openModeSelector(page);
  await page.getByTestId("mode-i-guess").click();
  await expect(page.getByTestId("think-guess-prompt")).toContainText(
    "I am thinking of an animal",
  );
  const talkButton = page.getByTestId("think-guess-talk");
  await expect(talkButton).toHaveAttribute("aria-label", "Start voice");
  const talkButtonBox = await talkButton.boundingBox();
  expect(talkButtonBox).not.toBeNull();
  expect(talkButtonBox!.width).toBe(180);
  expect(talkButtonBox!.height).toBe(180);
  expect(
    Math.abs(talkButtonBox!.x + talkButtonBox!.width / 2 - 390 / 2),
  ).toBeLessThan(1);
  await page.getByTestId("think-guess-hint").click();
  await expect(page.getByTestId("think-guess-prompt")).toContainText(
    "It is very big",
  );
  await expect(talkButton).toBeEnabled();
  await page.getByTestId("think-guess-exit").click();
  await expect(page.getByTestId("mode-i-guess")).toBeVisible();
});

test("shared hold control gives clear feedback through a complete press", async ({
  page,
}) => {
  await mockRealtimeBrowser(page);
  await mockRoundApi(page, undefined, true);
  await openModeSelector(page);
  await page.getByTestId("mode-i-guess").click();

  const talkButton = page.getByTestId("think-guess-talk");
  await expect(talkButton).toHaveAttribute("aria-label", "Start voice");
  await expect(page.getByText("Start voice", { exact: true })).toBeVisible();
  await talkButton.click();

  await expect(talkButton).toHaveAttribute("aria-label", "Hold to speak");
  await expect(page.getByTestId("think-guess-talk-hint")).toContainText(
    "Hold to speak",
  );

  const box = await talkButton.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(talkButton).toHaveAttribute("aria-label", "Listening...");
  await expect(page.getByTestId("think-guess-talk-hint")).toContainText(
    "Listening...",
  );

  await page.mouse.up();
  await expect(talkButton).toHaveAttribute("aria-label", "Thinking...");
});

test("Tell me the answer appears after three hints and ends without a solved score", async ({
  page,
}) => {
  let hintLevel = 0;
  await mockRoundApi(page, async (route) => {
    const body = route.request().postDataJSON() as { transcript: string };
    if (body.transcript === "Tell me the answer") {
      return json(route, 200, {
        status: "complete",
        reply:
          "The answer is elephant. Nice thinking—you used the clues to learn something new!",
        intent: "reveal_answer",
        turnNumber: 4,
        hintLevel: 3,
        voiceState: "round_complete",
        completion: {
          solved: false,
          canonicalAnswer: "elephant",
          usefulQuestions: 0,
          hintsUsed: 3,
          reasoningLevel: 2,
        },
      });
    }
    hintLevel += 1;
    return json(route, 200, {
      status: "waiting_for_child",
      reply: `Clue number ${hintLevel}.`,
      intent: "request_hint",
      turnNumber: hintLevel,
      hintLevel,
      voiceState: "ai_speaking",
    });
  });

  await openModeSelector(page);
  await page.getByTestId("mode-i-guess").click();
  await expect(page.getByTestId("think-guess-reveal-answer")).toHaveCount(0);
  for (let level = 1; level <= 3; level += 1) {
    await page.getByTestId("think-guess-hint").click();
    await expect(page.getByTestId("think-guess-prompt")).toContainText(
      `Clue number ${level}`,
    );
    await expect(page.getByTestId("think-guess-reveal-answer")).toHaveCount(
      level === 3 ? 1 : 0,
    );
  }

  await page.getByTestId("think-guess-reveal-answer").click();
  await expect(page.getByTestId("think-guess-result")).toContainText(
    "The answer was...",
  );
  await expect(page.getByTestId("think-guess-result")).toContainText(
    "elephant",
  );
  await expect(page.getByTestId("think-guess-result")).not.toContainText(
    "Mystery solved!",
  );
});

test("round completion offers replay, game switching, and Done", async ({
  page,
}) => {
  await mockRoundApi(page, (route) =>
    json(route, 200, {
      status: "solved",
      reply:
        "Yes! It is elephant. You used questions and clues to work it out!",
      intent: "direct_guess",
      turnNumber: 3,
      hintLevel: 0,
      voiceState: "round_complete",
      completion: {
        solved: true,
        canonicalAnswer: "elephant",
        usefulQuestions: 2,
        hintsUsed: 0,
        reasoningLevel: 2,
      },
    }),
  );
  await openModeSelector(page);
  await page.getByTestId("mode-i-guess").click();
  await page.getByTestId("think-guess-hint").click();
  await expect(page.getByTestId("think-guess-result")).toContainText(
    "Mystery solved!",
  );
  await expect(page.getByTestId("think-guess-play-again")).toBeVisible();
  await expect(page.getByText("Choose Game", { exact: true })).toBeVisible();
  await expect(page.getByText("Done", { exact: true })).toBeVisible();
  await page.getByTestId("think-guess-play-again").click();
  await expect(page.getByTestId("think-guess-result")).toHaveCount(0);
  await expect(page.getByTestId("think-guess-prompt")).toContainText(
    "Ask me a question",
  );
});

test("voice startup failure and expired rounds show child-safe recovery", async ({
  page,
}) => {
  await mockRoundApi(page, (route) =>
    json(route, 410, { code: "ROUND_EXPIRED", error: "This mystery expired." }),
  );
  await openModeSelector(page);
  await page.getByTestId("mode-i-guess").click();
  await page.getByTestId("think-guess-talk").click();
  await expect(page.getByTestId("think-guess-error")).toContainText(
    /Voice could not start|Voice unavailable/i,
  );
  await page.getByTestId("think-guess-hint").click();
  await expect(page.getByTestId("think-guess-error")).toContainText("expired");
  await expect(page.getByTestId("think-guess-retry")).toBeVisible();
  await page.getByTestId("think-guess-retry").click();
  await expect(page.getByTestId("think-guess-prompt")).toContainText(
    "Ask me a question",
  );
});

test("microphone denial explains how to recover", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  await mockRoundApi(page, undefined, true);
  await openModeSelector(page);
  await page.getByTestId("mode-i-guess").click();
  await page.getByTestId("think-guess-talk").click();
  await expect(page.getByTestId("think-guess-error")).toContainText(
    "Microphone access was denied",
  );
});

test("game remains contained in the desktop StoryLingo shell", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockRoundApi(page);
  await openModeSelector(page);
  await page.getByTestId("mode-i-guess").click();
  const shell = await page.getByTestId("app-shell").boundingBox();
  const prompt = await page.getByTestId("think-guess-prompt").boundingBox();
  expect(shell).not.toBeNull();
  expect(prompt).not.toBeNull();
  expect(prompt!.x).toBeGreaterThanOrEqual(shell!.x);
  expect(prompt!.x + prompt!.width).toBeLessThanOrEqual(
    shell!.x + shell!.width,
  );
});
