import assert from "node:assert/strict";
import test from "node:test";
import { THINK_GUESS_ANSWERS, validateAnswerLibrary } from "./content";

test("pilot library contains 30 fully localized, valid answers", () => {
  assert.equal(THINK_GUESS_ANSWERS.length, 30);
  assert.doesNotThrow(() => validateAnswerLibrary());
  for (const answer of THINK_GUESS_ANSWERS) {
    for (const language of ["en", "zh", "es"] as const) {
      assert.ok(answer.localized[language].canonical.length > 0);
      assert.equal(answer.localized[language].hints.length, 4);
      assert.ok(
        answer.localized[language].aliases.includes(
          answer.localized[language].canonical,
        ),
      );
    }
  }
});

test("content validation rejects duplicate IDs", () => {
  const duplicate = [
    ...THINK_GUESS_ANSWERS.slice(0, 29),
    THINK_GUESS_ANSWERS[0],
  ];
  assert.throws(() => validateAnswerLibrary(duplicate), /Duplicate answer id/);
});

test("content validation rejects contradictory approved facts", () => {
  const conflicting = structuredClone(THINK_GUESS_ANSWERS);
  conflicting[0].attributes.small = true;
  assert.throws(() => validateAnswerLibrary(conflicting), /both big and small/);
});
