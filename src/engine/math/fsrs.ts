// Generic FSRS scheduler math (BUILD.md §2.8: scheduleReview "may call fsrsStep (generic
// FSRS math)"; §3 "FSRS reference algorithm (generic), wrapped as an Engine util ... all
// parameters from config"). Pure + deterministic (L2), science-free (L1): the Engine owns
// the FSRS *algorithm*; every parameter (the weight vector, the desired retention, the
// interval cap) is supplied by the caller from the Seam-6 `scheduling` config. There is no
// chess/learning constant here — only the structural constants of the FSRS memory model.
//
// This implements the FSRS-6 *long-term* (≥1-day) update: the difficulty/stability/
// retrievability (DSR) model. The same-day (sub-day) short-term path is intentionally not
// implemented — the daily scheduler never does sub-day reviews; the intra-session retest of
// the redo flow (§7.5) is a separate state machine, not an FSRS step. A research config can
// later ship optimised weights in the same 21-slot FSRS-6 vector with no engine change.
//
// Sign/units: time is epoch ms; intervals/stability/elapsed are in days. Grades are the
// FSRS 1..4 scale (1 Again · 2 Hard · 3 Good · 4 Easy).

import { DAY_MS } from "@/lib/clock";

/** The FSRS review grade (METHODOLOGY Seam 6 outcome→grade mapping). */
export type FsrsGrade = 1 | 2 | 3 | 4;

/** One item's FSRS memory state. `due`/`lastReview` are epoch ms; `stability` is in days. */
export interface FsrsState {
  stability: number;
  difficulty: number;
  due: number;
  reps: number;
  lapses: number;
  lastReview: number;
}

/** Caller-supplied FSRS parameters — ALL from the Seam-6 config (L1). */
export interface FsrsParams {
  /** The FSRS-6 weight vector (21 entries: w0..w20). */
  weights: readonly number[];
  /** Target recall probability that sets review intervals (config `desiredRetention`). */
  desiredRetention: number;
  /** Hard cap on any scheduled interval, in days (config `maximumIntervalDays`). */
  maximumIntervalDays: number;
}

// Structural constants of the FSRS model (NOT tunable methodology values):
//   • stability is DEFINED as the interval at which retrievability = this anchor;
//   • difficulty lives on a 1..10 scale; the damping divisor is (10 − 1) = 9.
const STABILITY_ANCHOR_RETENTION = 0.9;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MIN_STABILITY = 0.01;

const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

/** decay = −w20; factor makes retrievability(stability, stability) === the anchor (0.9). */
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

/** The next interval (days) for a stability + desired retention, capped and ≥ 1 day. */
function intervalDays(stability: number, params: FsrsParams): number {
  const { decay, factor } = decayFactor(params.weights);
  const raw =
    (stability / factor) * (Math.pow(params.desiredRetention, 1 / decay) - 1);
  return clamp(Math.round(raw), 1, params.maximumIntervalDays);
}

/** Initial difficulty for a first-review grade: D0(g) = w4 − exp(w5·(g−1)) + 1, clamped. */
function initialDifficulty(grade: FsrsGrade, w: readonly number[]): number {
  return clamp(
    w[4]! - Math.exp(w[5]! * (grade - 1)) + 1,
    MIN_DIFFICULTY,
    MAX_DIFFICULTY,
  );
}

/** Next difficulty: linear-damped update toward the grade, then mean-reverted to D0(Easy). */
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

/** Next stability after a successful recall (grade ≥ 2). */
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

/** Next stability after a lapse (grade 1) — bounded above by the pre-lapse stability. */
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

/**
 * Advance an item's FSRS state by one review. `prev === null` is a first review (uses the
 * initial-stability/difficulty equations). Returns the new state with `due = reviewedAt +
 * interval(newStability)`. Pure: same (prev, grade, reviewedAt, params) → same output (L2).
 */
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
    // First review: initial stability is the per-grade weight w[grade−1].
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
