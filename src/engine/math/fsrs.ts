// Generic long-term FSRS-6 DSR math. The caller supplies all tunable parameters.
// Same-day retests use a separate state machine. Timestamps are epoch milliseconds;
// intervals, stability, and elapsed time are days.

import { DAY_MS } from "@/lib/clock";

export type FsrsGrade = 1 | 2 | 3 | 4;

export interface FsrsState {
  stability: number;
  difficulty: number;
  due: number;
  reps: number;
  lapses: number;
  lastReview: number;
}

export interface FsrsParams {
  weights: readonly number[];
  desiredRetention: number;
  maximumIntervalDays: number;
}

// These define the FSRS model rather than methodology policy.
const STABILITY_ANCHOR_RETENTION = 0.9;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MIN_STABILITY = 0.01;

const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

/** Derive the forgetting-curve terms from the configured weight vector. */
function decayFactor(weights: readonly number[]): {
  decay: number;
  factor: number;
} {
  const decay = -weights[20]!;
  const factor = Math.pow(STABILITY_ANCHOR_RETENTION, 1 / decay) - 1;
  return { decay, factor };
}

/** Retrievability after `elapsedDays` at the given stability (the FSRS forgetting curve). */
function retrievability(
  elapsedDays: number,
  stability: number,
  weights: readonly number[],
): number {
  const { decay, factor } = decayFactor(weights);
  return Math.pow(1 + (factor * elapsedDays) / stability, decay);
}

/** Calculate the capped next interval in whole days. */
function intervalDays(stability: number, params: FsrsParams): number {
  const { decay, factor } = decayFactor(params.weights);
  const raw =
    (stability / factor) * (Math.pow(params.desiredRetention, 1 / decay) - 1);
  return clamp(Math.round(raw), 1, params.maximumIntervalDays);
}

/** D0(g) = w4 - exp(w5 * (g - 1)) + 1. */
function initialDifficulty(grade: FsrsGrade, w: readonly number[]): number {
  return clamp(
    w[4]! - Math.exp(w[5]! * (grade - 1)) + 1,
    MIN_DIFFICULTY,
    MAX_DIFFICULTY,
  );
}

/** Apply linear damping, then mean reversion toward the initial Easy difficulty. */
function nextDifficulty(
  difficulty: number,
  grade: FsrsGrade,
  w: readonly number[],
): number {
  const deltaD = -w[6]! * (grade - 3);
  const damped = difficulty + deltaD * ((10 - difficulty) / 9);
  const reverted = w[7]! * initialDifficulty(4, w) + (1 - w[7]!) * damped;
  return clamp(reverted, MIN_DIFFICULTY, MAX_DIFFICULTY);
}

function stabilityAfterRecall(
  stability: number,
  difficulty: number,
  r: number,
  grade: FsrsGrade,
  w: readonly number[],
): number {
  const hardPenalty = grade === 2 ? w[15]! : 1;
  const easyBonus = grade === 4 ? w[16]! : 1;
  const growth =
    Math.exp(w[8]!) *
    (11 - difficulty) *
    Math.pow(stability, -w[9]!) *
    (Math.exp((1 - r) * w[10]!) - 1) *
    hardPenalty *
    easyBonus;
  return Math.max(MIN_STABILITY, stability * (1 + growth));
}

/** Lapse stability cannot exceed its pre-lapse value. */
function stabilityAfterLapse(
  stability: number,
  difficulty: number,
  r: number,
  w: readonly number[],
): number {
  const lapsed =
    w[11]! *
    Math.pow(difficulty, -w[12]!) *
    (Math.pow(stability + 1, w[13]!) - 1) *
    Math.exp((1 - r) * w[14]!);
  return Math.max(MIN_STABILITY, Math.min(lapsed, stability));
}

/** Advance an item's FSRS state by one deterministic review step. */
export function fsrsStep(
  prev: FsrsState | null,
  grade: FsrsGrade,
  reviewedAt: number,
  params: FsrsParams,
): FsrsState {
  const w = params.weights;
  let stability: number;
  let difficulty: number;

  if (prev === null) {
    // Initial stability is the per-grade weight w[grade - 1].
    stability = Math.max(MIN_STABILITY, w[grade - 1]!);
    difficulty = initialDifficulty(grade, w);
  } else {
    const elapsedDays = Math.max(0, (reviewedAt - prev.lastReview) / DAY_MS);
    const r = retrievability(elapsedDays, prev.stability, w);
    difficulty = nextDifficulty(prev.difficulty, grade, w);
    stability =
      grade === 1
        ? stabilityAfterLapse(prev.stability, prev.difficulty, r, w)
        : stabilityAfterRecall(prev.stability, prev.difficulty, r, grade, w);
  }

  const due = reviewedAt + intervalDays(stability, params) * DAY_MS;
  return {
    stability,
    difficulty,
    due,
    reps: (prev?.reps ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (grade === 1 ? 1 : 0),
    lastReview: reviewedAt,
  };
}
