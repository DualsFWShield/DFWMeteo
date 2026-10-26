import assert from "node:assert/strict";
import test from "node:test";
import {
  circularMean,
  hourConfidence,
  median,
  weightedMean,
  weightedModeCode,
  weightedStd,
} from "../server/consensus.ts";
import { normaliseWeights } from "../server/models.ts";

test("weightedMean respects weights", () => {
  const mean = weightedMean([
    { value: 10, weight: 3 },
    { value: 20, weight: 1 },
  ]);
  assert.equal(mean, 12.5);
});

test("weightedMean ignores missing values", () => {
  const mean = weightedMean([
    { value: null, weight: 4 },
    { value: 8, weight: 1 },
    { value: 12, weight: 1 },
  ]);
  assert.equal(mean, 10);
});

test("weightedStd measures weighted spread", () => {
  const spread = weightedStd([
    { value: 0, weight: 1 },
    { value: 10, weight: 1 },
  ]);
  assert.equal(spread, 5);
});

test("circularMean wraps across north", () => {
  const mean = circularMean([
    { value: 350, weight: 1 },
    { value: 10, weight: 1 },
  ]);
  assert.ok(mean !== null);
  assert.ok(mean < 1 || mean > 359, `unexpected mean ${mean}`);
});

test("weightedModeCode chooses the largest weather group", () => {
  const code = weightedModeCode([
    { value: 3, weight: 1 },
    { value: 3, weight: 1 },
    { value: 2, weight: 1 },
    { value: 61, weight: 1 },
  ]);
  assert.equal(code, 3);
});

test("weightedModeCode uses severity as a tie breaker", () => {
  const code = weightedModeCode([
    { value: 3, weight: 1 },
    { value: 3, weight: 1 },
    { value: 61, weight: 1 },
    { value: 63, weight: 1 },
  ]);
  assert.ok(code === 61 || code === 63);
});

test("normaliseWeights sums to one", () => {
  const weights = normaliseWeights([
    { id: "a", priorWeight: 2 },
    { id: "b", priorWeight: 3 },
  ]);
  assert.equal(weights.reduce((total, item) => total + item.influence, 0), 1);
});

test("median handles odd and even samples", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test("hourConfidence rewards model agreement", () => {
  const tight = hourConfidence(
    0.2,
    [
      { precipitation: 0, probability: 10 },
      { precipitation: 0, probability: 12 },
      { precipitation: 0, probability: 9 },
    ],
    3,
  );
  const loose = hourConfidence(
    4,
    [
      { precipitation: 1, probability: 80 },
      { precipitation: 0, probability: 10 },
      { precipitation: 0, probability: 20 },
    ],
    3,
  );
  assert.ok(tight > loose);
});
