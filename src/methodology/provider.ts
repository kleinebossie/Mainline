// The MethodologyProvider — the pure-function boundary the Engine calls (BUILD.md §2.8).
// Every function is PURE (L2): same (inputs, config) → same output, no clock, no I/O,
// no randomness. Each reads numbers ONLY from config (L1) — there is not a single
// chess/learning constant in this file. M4 ships the Seam 2 functions (assessment) and
// the Seam 9 if-then assembler; later seams' functions land with their milestones.

import type { Grade, GradedFlag, Tier } from "@/methodology/schema/graded";
import type { MethodologyConfig } from "@/methodology/schema/config";

// ---------------------------------------------------------------------------
// Seam 2 — Assessment calibration (WEAKNESS_DIAGNOSIS §2; METHODOLOGY Seam 2)
// ---------------------------------------------------------------------------

/** One graded calibration response: the puzzle rating shown and whether it was solved. */
export interface CalibrationResponse {
  ratingShown: number;
  correct: boolean;
}

export interface NextCalibrationItem {
  /** The puzzle rating to serve next (or the converged estimate when `done`). */
  ratingTarget: number;
  /** 1-based index of the item being served (count of responses so far, when done). */
  itemNumber: number;
  /** True once the stop rule fires (enough items, or SE below threshold). */
  done: boolean;
}

/** A graded tactical estimate the Engine can snapshot onto SkillState (L3). */
export interface CalibrationEstimate {
  tacticalRatingEstimate: number;
  uncertainty: number;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  flag?: GradedFlag;
  rationaleKey: string;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// Internal estimator shared by scoreCalibration and the stop rule. Deterministic:
// estimate = meanShownRating + (successRate − targetSuccess) · abilitySpread, clamped
// to the calibration span; uncertainty = uncertaintyBase / √n. All numbers from config.
function estimate(
  responses: readonly CalibrationResponse[],
  cfg: MethodologyConfig,
): { tacticalRatingEstimate: number; uncertainty: number } {
  const c = cfg.assessment.calibration;
  const n = responses.length;
  if (n === 0) {
    return {
      tacticalRatingEstimate: clamp(
        c.startRating.value,
        c.ratingFloor.value,
        c.ratingCeil.value,
      ),
      uncertainty: Math.round(c.uncertaintyBase.value),
    };
  }
  const meanShown = responses.reduce((s, r) => s + r.ratingShown, 0) / n;
  const successRate = responses.filter((r) => r.correct).length / n;
  const raw =
    meanShown +
    (successRate - c.targetSuccessRate.value) * c.abilitySpread.value;
  return {
    tacticalRatingEstimate: Math.round(
      clamp(raw, c.ratingFloor.value, c.ratingCeil.value),
    ),
    uncertainty: Math.round(c.uncertaintyBase.value / Math.sqrt(n)),
  };
}

/**
 * Seam 2 — the adaptive ladder. Given the responses so far and a resolved start rating
 * (the caller passes the platform puzzle/rapid rating, else the config default), return
 * the next puzzle rating to serve and whether the stop rule has fired. Transformed
 * staircase: harder by `stepUp` after a solve, easier by `stepDown` after a miss.
 */
export function nextCalibrationItem(
  input: { responses: readonly CalibrationResponse[]; startRating: number },
  cfg: MethodologyConfig,
): NextCalibrationItem {
  const c = cfg.assessment.calibration;
  const { responses, startRating } = input;
  const n = responses.length;

  const enoughItems = n >= c.maxItems.value;
  const confident =
    n >= c.minItems.value &&
    estimate(responses, cfg).uncertainty <= c.stopUncertainty.value;
  if (enoughItems || confident) {
    return {
      ratingTarget: estimate(responses, cfg).tacticalRatingEstimate,
      itemNumber: n,
      done: true,
    };
  }

  const base =
    n === 0
      ? startRating
      : responses[n - 1]!.correct
        ? responses[n - 1]!.ratingShown + c.stepUp.value
        : responses[n - 1]!.ratingShown - c.stepDown.value;

  return {
    ratingTarget: Math.round(
      clamp(base, c.ratingFloor.value, c.ratingCeil.value),
    ),
    itemNumber: n + 1,
    done: false,
  };
}

/**
 * Seam 2 — score a completed calibration into a graded tactical estimate + uncertainty
 * that seeds SkillState. The METHOD is a best-guess stub (the IRT/estimator is not
 * chess-validated), so the returned grade/flag travels with the estimate and the
 * transparency UI must never render it as fact (L3).
 */
export function scoreCalibration(
  input: { responses: readonly CalibrationResponse[] },
  cfg: MethodologyConfig,
): CalibrationEstimate {
  const { tacticalRatingEstimate, uncertainty } = estimate(
    input.responses,
    cfg,
  );
  // The estimate carries the weakest grade among the leaves the method leans on; the
  // staircase parameters are all `stub_open_question` / best-guess, so the result is C.
  return {
    tacticalRatingEstimate,
    uncertainty,
    evidenceGrade: "C",
    evidenceTier: 1,
    citationKey: "stub_open_question",
    flag: "best-guess",
    rationaleKey: "calibration_estimate",
  };
}

// ---------------------------------------------------------------------------
// Seam 9 — Implementation intention (Gollwitzer & Sheeran 2006; METHODOLOGY Seam 9)
// ---------------------------------------------------------------------------

export interface IfThenPlan {
  cue: string;
  plan: string;
}

/**
 * Seam 9 — assemble an "if-then" implementation intention from a user-supplied daily
 * cue and the chosen training action. Pure data assembly (no config numbers); the
 * evidence that if-then plans raise follow-through (gollwitzer2006, A/2) is surfaced as
 * copy elsewhere. Returns the persisted `{ cue, plan }` shape (ConstraintSet, §5.4).
 */
export function buildImplementationIntention(
  cue: string,
  module: string,
): IfThenPlan {
  return { cue: cue.trim(), plan: module.trim() };
}
