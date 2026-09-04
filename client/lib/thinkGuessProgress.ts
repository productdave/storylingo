import type {
  ThinkGuessProgress,
  ThinkGuessRoundSummary,
} from "@/context/ProgressContext";

export function nextThinkGuessProgress(
  existing: ThinkGuessProgress,
  summary: ThinkGuessRoundSummary,
  playedAt = new Date().toISOString(),
): ThinkGuessProgress {
  const successful =
    summary.solved && summary.hintsUsed === 0 && summary.usefulQuestions > 0;
  const struggling =
    summary.abandoned || summary.hintsUsed >= 3 || summary.dontKnowCount >= 2;
  const successfulRoundStreak = successful
    ? existing.successfulRoundStreak + 1
    : 0;
  const strugglingRoundStreak = struggling
    ? existing.strugglingRoundStreak + 1
    : 0;
  let reasoningLevel = existing.reasoningLevel;

  if (successfulRoundStreak >= 3)
    reasoningLevel = Math.min(5, reasoningLevel + 1);
  if (strugglingRoundStreak >= 2)
    reasoningLevel = Math.max(1, reasoningLevel - 1);

  return {
    ...existing,
    reasoningLevel,
    roundsPlayed: existing.roundsPlayed + 1,
    roundsSolved: existing.roundsSolved + (summary.solved ? 1 : 0),
    usefulQuestions: existing.usefulQuestions + summary.usefulQuestions,
    hintsUsed: existing.hintsUsed + summary.hintsUsed,
    successfulRoundStreak:
      reasoningLevel > existing.reasoningLevel ? 0 : successfulRoundStreak,
    strugglingRoundStreak:
      reasoningLevel < existing.reasoningLevel ? 0 : strugglingRoundStreak,
    lastPlayedAt: playedAt,
  };
}
