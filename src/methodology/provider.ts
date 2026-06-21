// The MethodologyProvider — the pure-function boundary the Engine calls (BUILD.md §2.8).
// Every function is PURE (L2): same (inputs, config) → same output, no clock, no I/O,
// no randomness. Each reads numbers ONLY from config (L1) — there is not a single
// chess/learning constant in this file. M4 ships the Seam 2 functions (assessment) and
// the Seam 9 if-then assembler; later seams' functions land with their milestones.

import type { Grade, GradedFlag, Tier } from "@/methodology/schema/graded";
import type {
  MethodologyConfig,
  RationaleEntry,
} from "@/methodology/schema/config";
import type { RawGameFeatures } from "@/lib/raw-features";
import { servoOffset } from "@/engine/math/servo";
import { stableSortByScoreDesc } from "@/engine/math/weighted-sort";

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

// ===========================================================================
// Program-engine seams (M6). All pure (L2): same (inputs, config) → same output;
// no clock, no I/O, no randomness; every number read from config (L1). These are the
// functions generateProgram (engine/generator.ts) calls to turn raw analysis + state
// into a graded daily session.
// ===========================================================================

/** A band id (one of cfg.bands[].id). The user's own data overrides this prior (§0.4). */
export type Band = string;

/** Seam-5 difficulty track (PRACTICE_DESIGN dual-track). */
export type Track = "pattern" | "calculation";

/** Seam-3 confidence, including the first-class "insufficient" honesty state. */
export type Confidence = "insufficient" | "low" | "medium" | "high";

export type PracticeStructureKind = "blocked" | "clustered" | "interleaved";

/** A graded weakness signal (Seam 3). Carries its evidence + sample size so the Engine
 *  can snapshot the grade onto a ProgramItem (L3) and surface honesty (insufficient data). */
export interface WeaknessSignal {
  dimension: string;
  /** 0..1 — how far the user's measured rate exceeds the band threshold. */
  severity: number;
  confidence: Confidence;
  /** The number of games the signal was computed over. */
  sampleSize: number;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  rationaleKey: string;
}

/** A candidate activity (Seam 4) — an external-only resource + the params to run it. */
export interface CandidateActivity {
  activityId: string;
  activityType: string;
  label: string;
  resourceTheme: string | null;
  dimensionsTargeted: string[];
  track: Track | null;
  estMinutes: number;
  /** The band ROI prior (config). The weakness weight is added in prioritizeDailyMix. */
  priority: number;
  rationaleKey: string;
  /** Set when a weakness signal elevated this activity (else null). */
  drivingSignal: WeaknessSignal | null;
}

/** A candidate with its daily-mix score attached (Seam 7). */
export interface ScoredCandidate extends CandidateActivity {
  score: number;
}

/** A spaced-review item that is due (Seam 6, M7). M6 always passes none. */
export interface DueItem {
  itemRef: string;
}

/** The servo-controlled puzzle-rating target + its evidence (Seam 5). */
export interface PuzzleTarget {
  ratingTarget: number;
  successTarget: number;
  track: Track;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  flag?: GradedFlag;
}

// ---------------------------------------------------------------------------
// Seam 8 — Rationale & evidence copy (USER_FACING; METHODOLOGY Seam 8)
// ---------------------------------------------------------------------------

/** Look up a rationale entry by key; throws (fail-closed) if it is missing — a missing
 *  key is a config/programming error, never a silent empty "why". */
export function rationaleFor(
  triggerKey: string,
  cfg: MethodologyConfig,
): RationaleEntry {
  const entry = cfg.rationale.find((r) => r.key === triggerKey);
  if (!entry) {
    throw new Error(`No rationale entry for key "${triggerKey}"`);
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Seam 1 — Band resolution (bands as DATA; §0.4)
// ---------------------------------------------------------------------------

/** The band whose [minRating, maxRating) contains `rating` (min inclusive, max exclusive;
 *  null = open-ended). Bands are a prior; the user's own data dominates downstream. */
export function bandForRating(rating: number, cfg: MethodologyConfig): Band {
  for (const b of cfg.bands) {
    const min = b.minRating.value;
    const max = b.maxRating.value;
    const aboveMin = min === null || rating >= min;
    const belowMax = max === null || rating < max;
    if (aboveMin && belowMax) return b.id;
  }
  // Unreachable with full band coverage; fall back to the top band defensively.
  return cfg.bands[cfg.bands.length - 1]!.id;
}

// ---------------------------------------------------------------------------
// Seam 3 — Game-feature → weakness interpretation (WEAKNESS_DIAGNOSIS §1)
// ---------------------------------------------------------------------------

/** Map a trailing game count to a confidence label using the per-signal sample-size gates;
 *  below the lowest gate the signal is `insufficient` and must be suppressed (the honesty
 *  engine — emit nothing rather than a fabricated diagnosis). */
export function confidenceFromSampleSize(
  n: number,
  signalType: "blunderRate",
  cfg: MethodologyConfig,
): Confidence {
  const g = cfg.interpretation.confidenceGates[signalType];
  if (n >= g.high.value) return "high";
  if (n >= g.medium.value) return "medium";
  if (n >= g.low.value) return "low";
  return "insufficient";
}

/**
 * Seam 3 — interpret RAW game features into graded weakness signals. The stub implements
 * the single highest-ROI signal — blunder rate (S3) — re-thresholding the raw cp-loss data
 * with the methodology's own blunder cutoff (L1: analysis emits raw, the threshold is
 * methodology) and excluding already-decided positions. Below the sample-size gate it emits
 * nothing (insufficient data is honest, not an error). Other signals (phase/conversion/time/
 * VOC) are deliberately deferred (METHODOLOGY Seam 3 STUB).
 */
export function interpretGameFeatures(
  input: { features: readonly RawGameFeatures[]; band: Band },
  cfg: MethodologyConfig,
): WeaknessSignal[] {
  const sampleSize = input.features.length;
  const confidence = confidenceFromSampleSize(sampleSize, "blunderRate", cfg);
  if (confidence === "insufficient") return [];

  const { blunderCpLoss, excludeDecidedAboveCp } =
    cfg.interpretation.thresholds;
  let blunders = 0;
  let consideredMoves = 0;
  for (const game of input.features) {
    for (const m of game.moveEvals) {
      if (Math.abs(m.cpBefore) > excludeDecidedAboveCp.value) continue;
      consideredMoves += 1;
      if (m.cpLoss >= blunderCpLoss.value) blunders += 1;
    }
  }
  const userRate = consideredMoves > 0 ? blunders / consideredMoves : 0;

  const baseline = cfg.interpretation.blunderRate.baselineByBand[input.band];
  if (!baseline) return [];
  const threshold =
    baseline.value * cfg.interpretation.blunderRate.weaknessMultiplier.value;
  if (threshold <= 0 || userRate <= threshold) return [];

  const severity = clamp(userRate / threshold - 1, 0, 1);
  const rationaleKey = cfg.interpretation.blunderRate.rationaleKey;
  const r = rationaleFor(rationaleKey, cfg);
  return [
    {
      dimension: cfg.interpretation.blunderRate.dimension,
      severity,
      confidence,
      sampleSize,
      evidenceGrade: r.grade,
      evidenceTier: r.tier,
      citationKey: r.citationKey,
      rationaleKey,
    },
  ];
}

// ---------------------------------------------------------------------------
// Seam 4 — Weakness/level → resource + params mapping (WHAT_RAISES_RATING)
// ---------------------------------------------------------------------------

/**
 * Seam 4 — gather candidate activities for a band, then elevate any whose dimension a
 * weakness signal flags (overriding the resource theme + rationale per the rule). Baseline
 * candidates are every activity with a positive band ROI prior; the weakness rules can
 * override theme/rationale and attach the driving signal so prioritizeDailyMix can weight
 * it. (Constraint-fit / owned-resource filtering is applied later by packing — Seam 7 +
 * the Engine — so it is not threaded here in the stub.)
 */
export function mapWeaknessToActivities(
  input: { signals: readonly WeaknessSignal[]; band: Band },
  cfg: MethodologyConfig,
): CandidateActivity[] {
  const candidates = new Map<string, CandidateActivity>();

  const toCandidate = (
    def: MethodologyConfig["activities"][number],
  ): CandidateActivity => ({
    activityId: def.id,
    activityType: def.activityType,
    label: def.label,
    resourceTheme: def.resourceTheme,
    dimensionsTargeted: [...def.dimensions],
    track: def.track,
    estMinutes: def.estMinutes.value,
    priority: def.priorityByBand[input.band]?.value ?? 0,
    rationaleKey: def.rationaleKey,
    drivingSignal: null,
  });

  for (const def of cfg.activities) {
    const p = def.priorityByBand[input.band];
    if (!p || p.value <= 0) continue;
    candidates.set(def.id, toCandidate(def));
  }

  for (const signal of input.signals) {
    for (const rule of cfg.weaknessResourceRules) {
      if (rule.dimension !== signal.dimension) continue;
      const def = cfg.activities.find((a) => a.id === rule.activityId);
      if (!def) continue;
      const base = candidates.get(rule.activityId) ?? toCandidate(def);
      // Keep the strongest driving signal if several map to the same activity.
      const driving =
        base.drivingSignal && base.drivingSignal.severity >= signal.severity
          ? base.drivingSignal
          : signal;
      candidates.set(rule.activityId, {
        ...base,
        resourceTheme: rule.theme ?? base.resourceTheme,
        rationaleKey: rule.rationaleKey,
        drivingSignal: driving,
      });
    }
  }

  return [...candidates.values()];
}

// ---------------------------------------------------------------------------
// Seam 5 — Difficulty / calibration targets (PRACTICE_DESIGN)
// ---------------------------------------------------------------------------

/**
 * Seam 5 — the servo. Seed the per-band/track Elo offset, then nudge it toward the
 * measured rolling success rate (the generic servo controller, engine/math). With no
 * measurement yet (M6) the offset is exactly the seed. Beginner bands get the raised
 * motivational success target on the pattern track. Clamped to the difficulty span.
 */
export function targetPuzzleRating(
  input: {
    userRating: number;
    track: Track;
    band: Band;
    recentSuccess?: number;
  },
  cfg: MethodologyConfig,
): PuzzleTarget {
  const d = cfg.difficulty;
  const trackCfg =
    input.track === "pattern" ? d.patternTrack : d.calculationTrack;
  const seed = trackCfg.offsetSeedByBand[input.band]?.value ?? 0;
  const isBeginnerPattern =
    input.track === "pattern" && d.beginnerBands.includes(input.band);
  const targetGV = isBeginnerPattern
    ? d.beginnerSuccessTarget
    : trackCfg.successTarget;
  const target = targetGV.value;
  const measured = input.recentSuccess ?? target;
  const offset = servoOffset(
    seed,
    measured,
    target,
    d.controllerSuccessToRating.value,
  );
  const ratingTarget = Math.round(
    clamp(input.userRating + offset, d.ratingFloor.value, d.ratingCeil.value),
  );
  return {
    ratingTarget,
    successTarget: target,
    track: input.track,
    evidenceGrade: targetGV.grade,
    evidenceTier: targetGV.tier,
    citationKey: targetGV.citationKey,
    flag: targetGV.flag,
  };
}

/** Seam 5 — the practice structure for a band (blocked → interleaved as load tolerance
 *  rises); a not-yet-mastered motif forces blocked regardless (cognitive-load gate). */
export function practiceStructure(
  input: { band: Band; motifMastery?: number },
  cfg: MethodologyConfig,
): PracticeStructureKind {
  const gv = cfg.difficulty.structureByBand[input.band];
  const base: PracticeStructureKind = gv?.value ?? "blocked";
  if (
    input.motifMastery !== undefined &&
    input.motifMastery < cfg.difficulty.motifMasteryThreshold.value
  ) {
    return "blocked";
  }
  return base;
}

/** Seam 5 — whether to show a worked example before active testing: always for the
 *  configured beginner bands, otherwise when item complexity clears the threshold. */
export function useWorkedExample(
  input: { band: Band; complexity?: number },
  cfg: MethodologyConfig,
): boolean {
  if (cfg.difficulty.workedExampleBands.includes(input.band)) return true;
  return (
    (input.complexity ?? 0) >=
    cfg.difficulty.workedExampleComplexityThreshold.value
  );
}

// ---------------------------------------------------------------------------
// Seam 7 — Prioritisation / the daily mix (TRAINING_PROGRAMMING)
// ---------------------------------------------------------------------------

/**
 * Seam 7 — score and order the candidate activities. Score = ROI prior + weakness severity
 * (for elevated candidates) + due-review bonus; variety/recency needs cross-day history
 * (M7+) so it contributes 0 here. Spaced-review candidates are dropped when nothing is due
 * (no point reviewing an empty queue). Ordering is a stable score-desc sort with an
 * activity-id tiebreak (the generic engine sort) — fully deterministic (L2).
 */
export function prioritizeDailyMix(
  input: {
    candidates: readonly CandidateActivity[];
    dueItems: readonly DueItem[];
  },
  cfg: MethodologyConfig,
): ScoredCandidate[] {
  const w = cfg.prioritization.weights;
  const hasDue = input.dueItems.length > 0;
  const scored = input.candidates
    .filter((c) => !(c.activityType === "spaced_review" && !hasDue))
    .map((c) => {
      const roiTerm = w.activityRoiPrior.value * c.priority;
      const weaknessTerm = c.drivingSignal
        ? w.weaknessSeverity.value * c.drivingSignal.severity
        : 0;
      const dueTerm =
        c.activityType === "spaced_review" && hasDue ? w.dueReviews.value : 0;
      return { ...c, score: roiTerm + weaknessTerm + dueTerm };
    });
  return stableSortByScoreDesc(
    scored,
    (c) => c.score,
    (c) => c.activityId,
  );
}
