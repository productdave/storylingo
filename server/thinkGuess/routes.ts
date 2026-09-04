import type { Express, Request, Response } from "express";
import {
  createRoundRequestSchema,
  submitTurnRequestSchema,
  thinkGuessAnalyticsEventSchema,
  type ThinkGuessApiError,
} from "@shared/thinkGuess";
import { ZodError } from "zod";
import { BoundedTurnClassifier } from "./classifier";
import { StructuredLogAnalytics, type ThinkGuessAnalytics } from "./analytics";
import { ThinkGuessService, RoundAccessError } from "./engine";
import { InMemoryRoundRepository, type RoundRepository } from "./repository";
import { THINK_GUESS_VOICE_INSTRUCTIONS } from "./thinkGuessPrompt";

export type ThinkGuessRouteDependencies = {
  repository?: RoundRepository;
  analytics?: ThinkGuessAnalytics;
  service?: ThinkGuessService;
  fetchImpl?: typeof fetch;
};

function sendError(
  res: Response,
  status: number,
  code: ThinkGuessApiError["code"],
  error: string,
) {
  return res.status(status).json({ code, error } satisfies ThinkGuessApiError);
}

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function handleRouteError(res: Response, error: unknown) {
  if (error instanceof ZodError) {
    return sendError(
      res,
      400,
      "INVALID_REQUEST",
      error.issues.map((issue) => issue.message).join("; "),
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
    "Think & Guess could not complete that request.",
  );
}

export function registerThinkGuessRoutes(
  app: Express,
  dependencies: ThinkGuessRouteDependencies = {},
) {
  const repository = dependencies.repository ?? new InMemoryRoundRepository();
  const analytics = dependencies.analytics ?? new StructuredLogAnalytics();
  const service =
    dependencies.service ??
    new ThinkGuessService(repository, new BoundedTurnClassifier(), analytics);
  const fetchImpl = dependencies.fetchImpl ?? fetch;

  app.post("/api/think-guess/rounds", async (req: Request, res: Response) => {
    try {
      const request = createRoundRequestSchema.parse(req.body);
      if (request.mode !== "child_guesses") {
        return sendError(
          res,
          409,
          "MODE_NOT_AVAILABLE",
          "AI Guesses is coming soon.",
        );
      }
      return res.status(201).json(await service.createRound(request));
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  app.post(
    "/api/think-guess/rounds/:roundId/turns",
    async (req: Request, res: Response) => {
      try {
        const request = submitTurnRequestSchema.parse(req.body);
        return res.json(
          await service.submitTurn(
            routeParam(req.params.roundId),
            request.transcript,
            request.speechConfidence,
          ),
        );
      } catch (error) {
        return handleRouteError(res, error);
      }
    },
  );

  app.post(
    "/api/think-guess/rounds/:roundId/stop",
    async (req: Request, res: Response) => {
      try {
        return res.json(
          await service.stopRound(routeParam(req.params.roundId)),
        );
      } catch (error) {
        return handleRouteError(res, error);
      }
    },
  );

  app.post(
    "/api/think-guess/rounds/:roundId/realtime-token",
    async (req: Request, res: Response) => {
      try {
        const round = await service.assertRoundAvailable(
          routeParam(req.params.roundId),
        );
        if (!process.env.OPENAI_API_KEY) {
          return sendError(
            res,
            503,
            "VOICE_UNAVAILABLE",
            "Voice is not configured on this server.",
          );
        }
        let response: Awaited<ReturnType<typeof fetchImpl>>;
        try {
          response = await fetchImpl(
            "https://api.openai.com/v1/realtime/client_secrets",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                session: {
                  type: "realtime",
                  model:
                    process.env.THINK_GUESS_REALTIME_MODEL || "gpt-realtime-2",
                  max_output_tokens: 512,
                  instructions: `${THINK_GUESS_VOICE_INSTRUCTIONS} The target language code is ${round.language}.`,
                  audio: {
                    input: {
                      transcription: { model: "gpt-4o-mini-transcribe" },
                      turn_detection: null,
                    },
                    output: {
                      voice: process.env.THINK_GUESS_VOICE || "marin",
                      speed: 0.95,
                    },
                  },
                },
              }),
            },
          );
        } catch (error) {
          console.error("Think & Guess realtime token request failed:", error);
          return sendError(
            res,
            502,
            "VOICE_UNAVAILABLE",
            "Voice could not start. Try again.",
          );
        }
        if (!response.ok) {
          console.error(
            "Think & Guess realtime token failed:",
            response.status,
            await response.text(),
          );
          return sendError(
            res,
            502,
            "VOICE_UNAVAILABLE",
            "Voice could not start. Try again.",
          );
        }
        let data: unknown;
        try {
          data = await response.json();
        } catch (error) {
          console.error(
            "Think & Guess realtime token response was invalid:",
            error,
          );
          return sendError(
            res,
            502,
            "VOICE_UNAVAILABLE",
            "Voice could not start. Try again.",
          );
        }
        if (
          typeof data !== "object" ||
          data === null ||
          !("value" in data) ||
          typeof data.value !== "string" ||
          data.value.length === 0 ||
          !("expires_at" in data) ||
          typeof data.expires_at !== "number" ||
          !Number.isFinite(data.expires_at)
        ) {
          console.error("Think & Guess realtime token response was malformed.");
          return sendError(
            res,
            502,
            "VOICE_UNAVAILABLE",
            "Voice could not start. Try again.",
          );
        }
        return res.json({
          client_secret: data.value,
          expires_at: data.expires_at,
        });
      } catch (error) {
        return handleRouteError(res, error);
      }
    },
  );

  app.post("/api/think-guess/events", (req: Request, res: Response) => {
    try {
      analytics.emit(thinkGuessAnalyticsEventSchema.parse(req.body));
      return res.status(202).json({ accepted: true });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  return { service, repository, analytics };
}
