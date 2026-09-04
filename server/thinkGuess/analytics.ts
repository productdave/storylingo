import {
  thinkGuessAnalyticsEventSchema,
  type ThinkGuessAnalyticsEvent,
} from "@shared/thinkGuess";

export interface ThinkGuessAnalytics {
  emit(event: ThinkGuessAnalyticsEvent): void;
}

export class StructuredLogAnalytics implements ThinkGuessAnalytics {
  emit(event: ThinkGuessAnalyticsEvent): void {
    const safeEvent = thinkGuessAnalyticsEventSchema.parse(event);
    console.log("think_guess_event", JSON.stringify(safeEvent));
  }
}
