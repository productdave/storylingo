import assert from "node:assert/strict";
import test from "node:test";
import type { ThinkGuessProgress } from "@/context/ProgressContext";
import { nextThinkGuessProgress } from "./thinkGuessProgress";

const initial: ThinkGuessProgress = {
  languageLevel: 1,
  reasoningLevel: 2,
  roundsPlayed: 0,
  roundsSolved: 0,
  usefulQuestions: 0,
  hintsUsed: 0,
  successfulRoundStreak: 0,
  strugglingRoundStreak: 0,
  lastPlayedAt: null,
};

test("reasoning difficulty rises after three strong rounds", () => {
  let progress = initial;
  for (let index = 0; index < 3; index += 1) {
    progress = nextThinkGuessProgress(progress, {
      solved: true,
      abandoned: false,
      usefulQuestions: 3,
      hintsUsed: 0,
      dontKnowCount: 0,
    });
  }
  assert.equal(progress.reasoningLevel, 3);
  assert.equal(progress.successfulRoundStreak, 0);
});

test("reasoning difficulty falls after two struggling rounds but never below one", () => {
  let progress = { ...initial, reasoningLevel: 2 };
  for (let index = 0; index < 2; index += 1) {
    progress = nextThinkGuessProgress(progress, {
      solved: false,
      abandoned: true,
      usefulQuestions: 0,
      hintsUsed: 3,
      dontKnowCount: 2,
    });
  }
  assert.equal(progress.reasoningLevel, 1);
  progress = nextThinkGuessProgress(progress, {
    solved: false,
    abandoned: true,
    usefulQuestions: 0,
    hintsUsed: 4,
    dontKnowCount: 2,
  });
  progress = nextThinkGuessProgress(progress, {
    solved: false,
    abandoned: true,
    usefulQuestions: 0,
    hintsUsed: 4,
    dontKnowCount: 2,
  });
  assert.equal(progress.reasoningLevel, 1);
});
