import { apiRequest } from "@/lib/query-client";
import {
  createRoundResponseSchema,
  turnDecisionSchema,
  type CreateRoundRequest,
  type CreateRoundResponse,
  type ThinkGuessAnalyticsEvent,
  type TurnDecision,
} from "@shared/thinkGuess";

async function parseJson<T>(
  response: Response,
  parser: { parse(value: unknown): T },
): Promise<T> {
  return parser.parse(await response.json());
}

export async function createThinkGuessRound(
  request: CreateRoundRequest,
): Promise<CreateRoundResponse> {
  return parseJson(
    await apiRequest("POST", "/api/think-guess/rounds", request),
    createRoundResponseSchema,
  );
}

export async function submitThinkGuessTurn(
  roundId: string,
  transcript: string,
  speechConfidence?: number,
): Promise<TurnDecision> {
  return parseJson(
    await apiRequest("POST", `/api/think-guess/rounds/${roundId}/turns`, {
      transcript,
      speechConfidence,
    }),
    turnDecisionSchema,
  );
}

export async function stopThinkGuessRound(
  roundId: string,
): Promise<TurnDecision> {
  return parseJson(
    await apiRequest("POST", `/api/think-guess/rounds/${roundId}/stop`),
    turnDecisionSchema,
  );
}

export async function emitThinkGuessEvent(
  event: ThinkGuessAnalyticsEvent,
): Promise<void> {
  try {
    await apiRequest("POST", "/api/think-guess/events", event);
  } catch (error) {
    console.warn("Think & Guess analytics event was not sent:", error);
  }
}
