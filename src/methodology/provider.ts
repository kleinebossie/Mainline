// The MethodologyProvider — the pure-function boundary the Engine calls (BUILD.md §2.8).
// Every function is PURE (L2): same (inputs, config) → same output, no clock, no I/O,
// no randomness. Each reads numbers ONLY from config (L1) — there is not a single
// chess/learning constant in this file. M4 ships the Seam 2 functions (assessment) and
// the Seam 9 if-then assembler; later seams' functions land with their milestones.

import { Chess } from "chess.js";

import type { Grade, GradedFlag, Tier } from "@/methodology/schema/graded";
import type {
  MethodologyConfig,
  RationaleEntry,
  RewardEventType,
  TargetFocus,
} from "@/methodology/schema/config";
import type { RawGameFeatures } from "@/lib/raw-features";
import { servoOffset } from "@/engine/math/servo";
import { fsrsStep, type FsrsGrade, type FsrsState } from "@/engine/math/fsrs";
import { glickoConfidenceInterval } from "@/engine/math/glicko";
import { DAY_MS, type Clock } from "@/lib/clock";

export type { FsrsGrade, FsrsState };

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

export type { RewardEventType };

/** A state change the engagement bus reacts to. The Engine computes these plumbing facts
 *  (distinct active days, completed count) and passes them in; this seam decides which
 *  events fire and with what copy. Pure data — no clock, no I/O (L2). */
export interface EngagementStateChange {
  /** True when the user completed ≥1 non-skip activity in this change. */
  activityCompleted: boolean;
  /** Consecutive active-day streak AFTER this change (the Engine counts distinct days). */
  activeDayStreak: number;
  /** Cumulative count of completed activities after this change (for milestones), or null. */
  completedCount: number | null;
  /** True only on a missed-day sweep — a forgiving recovery prompt, never a fail-state. */
  dayMissed: boolean;
}

/** One graded engagement event (the which/when/copy). The grade/tier/citation/soften travel
 *  from the `copyKey`'s Seam-8 rationale entry, so a weak-evidence nudge can never render as
 *  fact (L3). `payload` carries the capped streak position / milestone the UI shows. */
export interface EngagementEvent {
  type: RewardEventType;
  copyKey: string;
  payload: { streakDay?: number; streak?: number; milestone?: number };
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  soften: boolean;
}

/**
 * Seam 9 — turn a state change into the reward events to fire (the which/when/copy; the
 * Engine persists them). Iterates the config's event-policy table: a completion ticks a
 * CAPPED streak (the displayed number cycles 1..streakCapDays and never grows unbounded — an
 * infinite streak weaponising loss-aversion is a forbidden dark pattern, §9), crossing a
 * configured milestone fires a competence badge, and a missed day fires a forgiving recovery
 * prompt. Forbidden mechanics are structurally impossible: the event `type` is enum-bounded,
 * so no leaderboard / tangible reward can be emitted. Pure (L2): reads config + change only.
 */
export function engagementEventsFor(
  change: EngagementStateChange,
  cfg: MethodologyConfig,
): EngagementEvent[] {
  const e = cfg.engagement;
  const cap = e.streakCapDays.value;
  const milestones = new Set(e.competenceMilestones.value);
  const out: EngagementEvent[] = [];

  const emit = (
    rule: MethodologyConfig["engagement"]["events"][number],
    payload: EngagementEvent["payload"],
  ): void => {
    const r = rationaleFor(rule.copyKey, cfg);
    out.push({
      type: rule.type,
      copyKey: rule.copyKey,
      payload,
      evidenceGrade: r.grade,
      evidenceTier: r.tier,
      citationKey: r.citationKey,
      soften: r.soften,
    });
  };

  for (const rule of e.events) {
    switch (rule.trigger) {
      case "activity_completed":
        if (change.activityCompleted) emit(rule, {});
        break;
      case "streak_advanced":
        if (change.activityCompleted && change.activeDayStreak > 0) {
          // Capped/forgiving: the headline number stays in [1, cap], never unbounded.
          const streakDay = ((change.activeDayStreak - 1) % cap) + 1;
          emit(rule, { streakDay, streak: change.activeDayStreak });
        }
        break;
      case "milestone_reached":
        if (
          change.completedCount !== null &&
          milestones.has(change.completedCount)
        ) {
          emit(rule, { milestone: change.completedCount });
        }
        break;
      case "day_missed":
        if (change.dayMissed) emit(rule, {});
        break;
    }
  }
  return out;
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

export interface WeeklyFocusInput {
  latestSkillState: readonly {
    dimension: string;
    estimate: number;
    uncertainty: number;
    sampleSize: number;
  }[];
  weaknessSignals: readonly WeaknessSignal[];
  dueWork: readonly { itemType: string }[];
  goals: readonly {
    kind:
      | "rating"
      | "tactics"
      | "openings"
      | "endgames"
      | "consistency"
      | "fun"
      | "other";
    label: string;
  }[];
  constraints: { minutesPerDay: number; daysPerWeek: number };
  ownedResources: readonly { label: string; externalRef?: string }[];
  activityRecency: {
    lastEventAtByType: Record<string, number>;
    skipsByType: Record<string, number>;
  };
  trainingPreferences: {
    preferences: {
      enjoyment: Record<string, number>;
      frictionTags: readonly string[];
    };
  };
}

export interface FocusRationaleSnapshot {
  text: string;
  grade: Grade;
  tier: Tier;
  citationKey: string;
  flag?: GradedFlag;
  soften: boolean;
}

export interface FocusAlternative {
  focusArea: string;
  score: number;
  supportingSources: string[];
  tradeoff: FocusRationaleSnapshot;
}

export interface WeeklyFocusSelection {
  focusAreas: string[];
  supportingSignals: Array<{
    focusArea: string;
    sources: string[];
    score: number;
  }>;
  confidence: Confidence;
  rationale: FocusRationaleSnapshot;
  alternatives: FocusAlternative[];
}

export type TrainingFeedbackRelevance = "relevant" | "neutral" | "not_relevant";
export type TrainingFeedbackEnjoyment = "enjoyed" | "neutral" | "not_enjoyed";
export type TrainingFeedbackTimeFit = "too_short" | "fits" | "too_long";

export interface TrainingFitObservation {
  id: string;
  activityType: string | null;
  resourceKey: string | null;
  relevance: TrainingFeedbackRelevance;
  enjoyment: TrainingFeedbackEnjoyment;
  timeFit: TrainingFeedbackTimeFit;
  frictionTags: readonly string[];
  occurredAt: number;
}

export interface TrainingFitPreferenceRollup {
  enjoyment: Record<string, number>;
  enjoymentEvidenceCount: Record<string, number>;
  resourceAffinity: Record<string, number>;
  resourceEvidenceCount: Record<string, number>;
  timeFit: Record<string, TrainingFeedbackTimeFit>;
  sessionTimeFit: TrainingFeedbackTimeFit | null;
  frictionTags: string[];
  evidenceCount: number;
  methodologyVersion: string;
}

export interface TrainingFitPromptInput {
  now: number;
  trainingStartedAt: number | null;
  lastWeeklyFeedbackAt: number | null;
  lastWeeklyPromptAt: number | null;
  lastContextPromptAt: number | null;
  contextualCandidate: {
    activityType: string;
    novel: boolean;
    problemCount: number;
  } | null;
}

export interface TrainingFitPrompt {
  kind: "weekly" | "novel_activity" | "repeated_problem";
  activityType: string | null;
  text: string;
  grade: Grade;
  tier: Tier;
  citationKey: string;
  soften: boolean;
}

export interface WeeklyFocusRevisionInput {
  ageDays: number;
  previousConstraints: { minutesPerDay: number; daysPerWeek: number };
  nextConstraints: { minutesPerDay: number; daysPerWeek: number };
  previousSignals: readonly WeaknessSignal[];
  nextSignals: readonly WeaknessSignal[];
  previousSkillState: readonly { dimension: string; estimate: number }[];
  nextSkillState: readonly { dimension: string; estimate: number }[];
}

/** A concrete external book/course resource selected from the methodology catalog. */
export interface CandidateBookResource {
  id: string;
  title: string;
  category: string;
  studyUnit: "exercises" | "games";
}

/** A candidate activity (Seam 4) — a methodology-selected activity + params to run it. */
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
  /** Time controls this activity is specific to, or null when format-agnostic (Seam 7). */
  formats: string[] | null;
  rationaleKey: string;
  /** Set when a weakness signal elevated this activity (else null). */
  drivingSignal: WeaknessSignal | null;
  /** True when this candidate is tied to a resource the user already owns. */
  owned?: boolean;
  /** The concrete owned book/course to study, for deliberately external book sessions. */
  bookResource?: CandidateBookResource;
}

/** The user's stated PREFERENCES that reshape the daily mix (Seam 7). All optional — absent
 *  means "no preference expressed", and scoring falls back to the un-personalised order
 *  (so existing callers/goldens are unaffected). Never carries a skill claim (Seam 2). */
export interface MixPreferences {
  /** Formats the user actually plays (e.g. ["rapid","classical"]). */
  formats?: readonly string[];
  /** Identifiers of resources the user owns (externalRef / theme / activity id to match). */
  ownedRefs?: readonly string[];
  /** Depth-vs-breadth lever; "balanced" (or absent) is neutral. */
  depthVsBreadth?: "depth" | "balanced" | "breadth";
  /** Positive-only fit scores. They break methodology-score ties, never lower a score. */
  activityFit?: Readonly<Record<string, number>>;
  /** Positive-only affinity for a concrete resource/theme already eligible in the mix. */
  resourceFit?: Readonly<Record<string, number>>;
  /** Candidates that serve the persisted focus and may use subjective fit as a tie-break. */
  fitEligibleActivityIds?: readonly string[];
}

/** A candidate with its daily-mix score attached (Seam 7). */
export interface ScoredCandidate extends CandidateActivity {
  score: number;
  fitExplanation?: FocusRationaleSnapshot;
}

/** A spaced-review item that is due (Seam 6, M7). The generator surfaces these refs on the
 *  spaced-review activity so the user redoes exactly their due misses. */
export interface DueItem {
  itemRef: string;
  itemType: string;
}

export interface ActivityAllocationUnit {
  perUnitMinutes: number;
  allocationGranularityMinutes?: number;
}

/**
 * Seam 7 — resolve the time-allocation unit a scalable activity should use. The Engine
 * owns only the packing arithmetic; the methodology owns whether a due activity behaves
 * like a quick failed-tactic review, a slower endgame drill, or a track-specific puzzle.
 */
export function allocationUnitForActivity(
  input: { activityType: string; track: Track | null },
  cfg: MethodologyConfig,
): ActivityAllocationUnit | null {
  const vol = cfg.prioritization.volume;
  const reviewUnit =
    vol.secondsPerReviewUnitByActivityType?.[input.activityType];
  const trackUnit = input.track
    ? vol.secondsPerPuzzleByTrack?.[input.track]
    : undefined;
  const unit = reviewUnit ?? trackUnit;
  if (!unit) return null;
  return {
    perUnitMinutes: unit.value / 60,
    allocationGranularityMinutes: vol.allocationGranularityMinutes?.value,
  };
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

  const { blunderCpLoss, excludeDecidedAboveCp, blunderWinProbDrop } =
    cfg.interpretation.thresholds;
  let blunders = 0;
  let consideredMoves = 0;
  for (const game of input.features) {
    for (const m of game.moveEvals) {
      // Denominator unchanged: skip already-decided positions (blundering a lost/won game
      // is not a signal). The blunder TEST prefers the mate-safe win-probability drop when
      // the raw feature carries it — so a missed mate that stays winning is a ~0 drop and is
      // never counted — falling back to the cp threshold for analyses predating win-prob.
      if (Math.abs(m.cpBefore) > excludeDecidedAboveCp.value) continue;
      consideredMoves += 1;
      const isBlunder =
        blunderWinProbDrop && typeof m.winProbDrop === "number"
          ? m.winProbDrop >= blunderWinProbDrop.value
          : m.cpLoss >= blunderCpLoss.value;
      if (isBlunder) blunders += 1;
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
function normalizeOwnedRef(ref: string): string {
  return ref.trim().toLowerCase();
}

function bookCategoryDimensions(
  category: string,
  cfg: MethodologyConfig,
): string[] {
  return cfg.bookStudy.categoryDimensions[category] ?? [];
}

function ownedRecommendedBooks(
  input: {
    band: Band;
    libraryBand?: Band;
    ownedRefs?: readonly string[];
  },
  cfg: MethodologyConfig,
): BookRecommendation[] {
  return recommendBooks(
    { band: input.libraryBand ?? input.band, ownedRefs: input.ownedRefs },
    cfg,
  ).filter((book) => book.owned);
}

function bookSelection(
  book: BookRecommendation,
  cfg: MethodologyConfig,
): { book: CandidateBookResource; dimensions: string[] } {
  return {
    book: {
      id: book.id,
      title: book.title,
      category: book.category,
      studyUnit: book.studyUnit,
    },
    dimensions: bookCategoryDimensions(book.category, cfg),
  };
}

function chooseOwnedBookForDailyMix(
  input: {
    signals: readonly WeaknessSignal[];
    band: Band;
    libraryBand?: Band;
    ownedRefs?: readonly string[];
  },
  cfg: MethodologyConfig,
  excludedBookIds: ReadonlySet<string> = new Set(),
): { book: CandidateBookResource; dimensions: string[] } | null {
  const owned = ownedRecommendedBooks(input, cfg).filter(
    (book) => !excludedBookIds.has(normalizeOwnedRef(book.id)),
  );
  if (owned.length === 0) return null;

  const signalDimensions = new Set(input.signals.map((s) => s.dimension));
  const matching =
    signalDimensions.size > 0
      ? owned.find((book) =>
          bookCategoryDimensions(book.category, cfg).some((dimension) =>
            signalDimensions.has(dimension),
          ),
        )
      : undefined;
  const chosen = matching ?? owned[0];
  return chosen ? bookSelection(chosen, cfg) : null;
}

function chooseSubstitutionBook(
  substitution: MethodologyConfig["bookStudy"]["activitySubstitutions"][number],
  input: { band: Band; libraryBand?: Band },
  ownedBooks: readonly BookRecommendation[],
  usedBookIds: ReadonlySet<string>,
  cfg: MethodologyConfig,
): { book: CandidateBookResource; dimensions: string[] } | null {
  const available = ownedBooks.filter(
    (book) => !usedBookIds.has(normalizeOwnedRef(book.id)),
  );
  const preferredIds =
    substitution.preferredBookIdsByBand[input.libraryBand ?? input.band]
      ?.value ?? [];
  for (const preferredId of preferredIds) {
    const match = available.find(
      (book) => normalizeOwnedRef(book.id) === normalizeOwnedRef(preferredId),
    );
    if (match) return bookSelection(match, cfg);
  }
  const categoryMatch = available.find((book) =>
    substitution.categories.some((category) => category === book.category),
  );
  return categoryMatch ? bookSelection(categoryMatch, cfg) : null;
}

function chooseActivityBookSubstitutions(
  input: {
    band: Band;
    libraryBand?: Band;
    ownedRefs?: readonly string[];
  },
  cfg: MethodologyConfig,
): {
  byActivityId: Map<
    string,
    { book: CandidateBookResource; dimensions: string[] }
  >;
  usedBookIds: Set<string>;
} {
  const ownedBooks = ownedRecommendedBooks(input, cfg);
  const usedBookIds = new Set<string>();
  const byActivityId = new Map<
    string,
    { book: CandidateBookResource; dimensions: string[] }
  >();

  for (const substitution of cfg.bookStudy.activitySubstitutions) {
    const selection = chooseSubstitutionBook(
      substitution,
      input,
      ownedBooks,
      usedBookIds,
      cfg,
    );
    if (!selection) continue;
    byActivityId.set(substitution.activityId, selection);
    usedBookIds.add(normalizeOwnedRef(selection.book.id));
  }

  return { byActivityId, usedBookIds };
}

export function mapWeaknessToActivities(
  input: {
    signals: readonly WeaknessSignal[];
    band: Band;
    libraryBand?: Band;
    ownedRefs?: readonly string[];
  },
  cfg: MethodologyConfig,
): CandidateActivity[] {
  const candidates = new Map<string, CandidateActivity>();
  const substitutions = chooseActivityBookSubstitutions(input, cfg);
  const ownedBook = chooseOwnedBookForDailyMix(
    input,
    cfg,
    substitutions.usedBookIds,
  );

  const toCandidate = (
    def: MethodologyConfig["activities"][number],
  ): CandidateActivity => {
    let priority = def.priorityByBand[input.band]?.value ?? 0;
    let owned = false;
    let bookResource: CandidateBookResource | undefined;
    let dimensionsTargeted = [...def.dimensions];
    let label = def.label;
    let activityType = def.activityType;
    let resourceTheme = def.resourceTheme;
    let track = def.track;
    let rationaleKey = def.rationaleKey;

    const substitution = substitutions.byActivityId.get(def.id);
    if (substitution) {
      owned = true;
      bookResource = substitution.book;
      if (substitution.dimensions.length > 0) {
        dimensionsTargeted = substitution.dimensions;
      }
      label = `Study ${substitution.book.title}`;
      activityType = "book";
      resourceTheme = null;
      track = null;
      rationaleKey = cfg.bookStudy.activeRecallRationaleKey;
      priority = Math.max(priority, cfg.bookStudy.ownedBookDailyPriority.value);
    } else if (def.activityType === "book" && ownedBook) {
      owned = true;
      bookResource = ownedBook.book;
      if (ownedBook.dimensions.length > 0) {
        dimensionsTargeted = ownedBook.dimensions;
      }
      label = `Study ${ownedBook.book.title}`;
      // If they own a book at their level, prioritize it so it can replace generated drill
      // work in Today. The magnitude lives in config and is deliberately weak-evidence.
      priority = Math.max(priority, cfg.bookStudy.ownedBookDailyPriority.value);
    }

    return {
      activityId: def.id,
      activityType,
      label,
      resourceTheme,
      dimensionsTargeted,
      track,
      estMinutes: def.estMinutes.value,
      priority,
      formats: def.formats ?? null,
      rationaleKey,
      drivingSignal: null,
      owned,
      bookResource,
    };
  };

  for (const def of cfg.activities) {
    const cand = toCandidate(def);
    if (cand.priority <= 0) continue;
    candidates.set(def.id, cand);
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

export type { TargetFocus };

/** The in-app board's interface affordances for a band × play medium (Seam 4 §4.4(c)).
 *  Every value comes from config (L1); the board itself holds no affordance policy. */
export interface BoardAffordances {
  showEvalBar: boolean;
  showLegalMoveDots: boolean;
  allowArrows: boolean;
  allowHover: boolean;
  /** True when any crutch is hidden — the UI then shows the restriction rationale. */
  restricted: boolean;
  /** Seam-8 rationale key explaining the hidden crutches (graded copy in `rationale`). */
  restrictionRationaleKey: string;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
}

/**
 * Seam 4 §4.4(c) — resolve the board's interface-restriction affordances for a user from
 * config. Eval bar + legal-move dots are off across all bands (crutches absent from a real
 * board); arrows + hover are gated by the user's play medium (`targetFocus`). The `band`
 * rides along for the research config's planned band×focus refinement; the stub keys
 * arrows/hover by focus only. Pure (L2), config-only (L1).
 */
export function interfaceAffordancesFor(
  input: { band: Band; targetFocus: TargetFocus },
  cfg: MethodologyConfig,
): BoardAffordances {
  const b = cfg.board;
  const arrows = b.allowArrowsByFocus[input.targetFocus];
  const hover = b.allowHoverByFocus[input.targetFocus];
  const showEvalBar = b.showEvalBar.value;
  const showLegalMoveDots = b.showLegalMoveDots.value;
  return {
    showEvalBar,
    showLegalMoveDots,
    allowArrows: arrows.value,
    allowHover: hover.value,
    restricted:
      !showEvalBar || !showLegalMoveDots || !arrows.value || !hover.value,
    restrictionRationaleKey: b.restrictionRationaleKey,
    evidenceGrade: arrows.grade,
    evidenceTier: arrows.tier,
    citationKey: arrows.citationKey,
  };
}

// ---------------------------------------------------------------------------
// Seam 4 §4.2–4.4 — Book study + 2D/3D modality (BEST_BOOKS, 2D_VS_3D; M14). The
// deliberately-EXTERNAL layer: books/courses are recommended + logged, never hosted, and
// real games stay external (the play_games activity is a deep-link). All pure (L2) and
// config-only (L1) — every value, including the cognitive-load block list and the split
// ratios, comes from cfg.bookStudy / cfg.modality, so the research config retunes them with
// no Engine change.
// ---------------------------------------------------------------------------

/** One graded book recommendation (a deliberately-external resource — recommended, never
 *  hosted). Carries the evidence so the "why this" can never render as Grade-A fact (L3). */
export interface BookRecommendation {
  id: string;
  title: string;
  author: string;
  category: string;
  why: string;
  studyUnit: "exercises" | "games";
  /** True when the user already owns this book (prefer what they can use, Seam 7). */
  owned: boolean;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  flag?: GradedFlag;
}

/**
 * Seam 4 §4.3 — the band's recommended books, with the cognitive-load block rule applied:
 * categories that overload the band (strategy/opening for beginners) are suppressed, so a
 * sub-1200 reader never gets a strategy or opening book. Owned books (matched loosely against
 * `ownedRefs` by id or title) are flagged so the surface can prefer what the user already has.
 * Pure (L2), config-only (L1) — the catalog AND the block list both come from `bookStudy`.
 */
export function recommendBooks(
  input: { band: Band; ownedRefs?: readonly string[] },
  cfg: MethodologyConfig,
): BookRecommendation[] {
  const bs = cfg.bookStudy;
  const blocked = new Set<string>(
    bs.blockedCategoriesByBand[input.band]?.value ?? [],
  );
  const catalog = bs.catalogByBand[input.band] ?? [];
  const owned = new Set((input.ownedRefs ?? []).map(normalizeOwnedRef));
  const isOwned = (b: { id: string; title: string }): boolean =>
    owned.has(normalizeOwnedRef(b.id)) || owned.has(normalizeOwnedRef(b.title));
  return catalog
    .filter((b) => !blocked.has(b.category))
    .map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.category,
      why: b.recommendation.value,
      studyUnit: b.studyUnit,
      owned: isOwned(b),
      evidenceGrade: b.recommendation.grade,
      evidenceTier: b.recommendation.tier,
      citationKey: b.recommendation.citationKey,
      flag: b.recommendation.flag,
    }));
}

export interface WoodpeckerCycle {
  cycle: number;
  intervalDays: number;
}

export interface WoodpeckerSchedule {
  cycles: WoodpeckerCycle[];
  /** The minimum number of cycles worth completing (the rest is diminishing returns). */
  recommendedMinCycles: number;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  flag?: GradedFlag;
}

/**
 * Seam 4 §4.2 — derive the Woodpecker repetition schedule: `maxCycles` cycles, the first
 * `firstCycleDays` apart, each subsequent interval = previous × `cycleDecay` (0.5 ⇒ halving),
 * rounded and floored at 1 day. Spaced, not massed (the reconciliation in METHODOLOGY §1.3).
 * Pure (L2), config-only (L1) — the cycle count and decay come from `bookStudy.woodpecker`.
 */
export function woodpeckerSchedule(cfg: MethodologyConfig): WoodpeckerSchedule {
  const w = cfg.bookStudy.woodpecker;
  const cycles: WoodpeckerCycle[] = [];
  let interval = w.firstCycleDays.value;
  for (let c = 1; c <= w.maxCycles.value; c++) {
    cycles.push({ cycle: c, intervalDays: Math.max(1, Math.round(interval)) });
    interval = interval * w.cycleDecay.value;
  }
  return {
    cycles,
    recommendedMinCycles: w.minCycles.value,
    evidenceGrade: w.firstCycleDays.grade,
    evidenceTier: w.firstCycleDays.tier,
    citationKey: w.firstCycleDays.citationKey,
    flag: w.firstCycleDays.flag,
  };
}

export type BookDifficultyVerdict = "too_easy" | "calibrated" | "too_hard";

export interface BookDifficultyFeedback {
  verdict: BookDifficultyVerdict;
  successRate: number;
  targetSuccessRate: number;
  lowerBound: number;
  upperBound: number;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  flag?: GradedFlag;
}

/**
 * Seam 4 §4.2 — the 85% difficulty-calibration verdict for a self-reported book success rate:
 * above the upper bound ⇒ too easy, below the lower bound ⇒ too hard, else calibrated. The
 * success rate is a self-report of OUTCOME on exercises, used ONLY to tune book difficulty —
 * never to estimate skill, which stays behavioural (Seam 2 boundary). Pure (L2), config-only (L1).
 */
export function bookDifficultyFeedback(
  input: { successRate: number },
  cfg: MethodologyConfig,
): BookDifficultyFeedback {
  const d = cfg.bookStudy.difficultyCalibration;
  const r = input.successRate;
  const verdict: BookDifficultyVerdict =
    r > d.upperBound.value
      ? "too_easy"
      : r < d.lowerBound.value
        ? "too_hard"
        : "calibrated";
  return {
    verdict,
    successRate: r,
    targetSuccessRate: d.targetSuccessRate.value,
    lowerBound: d.lowerBound.value,
    upperBound: d.upperBound.value,
    evidenceGrade: d.targetSuccessRate.grade,
    evidenceTier: d.targetSuccessRate.tier,
    citationKey: d.targetSuccessRate.citationKey,
    flag: d.targetSuccessRate.flag,
  };
}

export interface ModalityRecommendation {
  band: Band;
  targetFocus: TargetFocus;
  digitalPct: number;
  physicalPct: number;
  /** True when the play medium is OTB/hybrid — surface physical-board + OTB-simulation advice. */
  surfacePhysical: boolean;
  otbCadence: string;
  physicalBoardAdvice: string;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  flag?: GradedFlag;
  /** Seam-8 rationale keys for the modality split + the OTB-simulation copy. */
  modalityRationaleKey: string;
  otbRationaleKey: string;
}

/**
 * Seam 4 §4.4 — the 2D/3D modality + OTB recommendation for a band × play medium. The split
 * (digital vs physical %) is per-band config; whether to PUSH physical-board + OTB-simulation
 * guidance is gated by `targetFocus` — an online-only player keeps the screen-heavy default,
 * an OTB/hybrid player gets the physical-board advice and the band's tournament-simulation
 * cadence (Zen mode, no arrows, notation, touch-move). Pure (L2), config-only (L1).
 */
export function modalityRecommendation(
  input: { band: Band; targetFocus: TargetFocus },
  cfg: MethodologyConfig,
): ModalityRecommendation {
  const m = cfg.modality;
  const split = m.splitByBand[input.band];
  const cadence = m.otbSimulationByBand[input.band];
  if (!split || !cadence) {
    throw new Error(`Missing modality config for band "${input.band}"`);
  }
  return {
    band: input.band,
    targetFocus: input.targetFocus,
    digitalPct: split.digitalPct.value,
    physicalPct: split.physicalPct.value,
    surfacePhysical: input.targetFocus !== "online",
    otbCadence: cadence.value,
    physicalBoardAdvice: m.physicalBoardAdvice.value,
    evidenceGrade: split.digitalPct.grade,
    evidenceTier: split.digitalPct.tier,
    citationKey: split.digitalPct.citationKey,
    flag: split.digitalPct.flag,
    modalityRationaleKey: m.modalityRationaleKey,
    otbRationaleKey: m.otbRationaleKey,
  };
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
 *
 * PERSONALISATION (Seam 7/P8 preferences): real constraints may reshape the base score.
 * Subjective fit is weaker: positive fit breaks only an equal methodology-score tie and
 * never subtracts, so it cannot displace due work or a stronger prescription.
 */
export function prioritizeDailyMix(
  input: {
    candidates: readonly CandidateActivity[];
    dueItems: readonly DueItem[];
    preferences?: MixPreferences;
  },
  cfg: MethodologyConfig,
): ScoredCandidate[] {
  const w = cfg.prioritization.weights;
  const p = cfg.prioritization.preferences;
  const prefs = input.preferences;
  // Due-gating is item-type aware: a spaced_review needs a due puzzle review, a blunder_drill
  // a due personal blunder position (itemType "blunder_drill"), an endgame_drill a due curated
  // endgame (itemType "endgame", M13). An activity that only makes sense with due work is
  // dropped when its queue is empty, and earns the due bonus when it is not. (The
  // activityType/itemType strings are Engine identifiers, not graded numbers — L1 is
  // unaffected, exactly as the existing spaced_review/play_game switches here.)
  const hasDrillDue = input.dueItems.some(
    (d) => d.itemType === "blunder_drill",
  );
  const hasEndgameDue = input.dueItems.some((d) => d.itemType === "endgame");
  const hasPuzzleDue = input.dueItems.some(
    (d) => d.itemType === "puzzle" || d.itemType === "puzzle_theme",
  );
  const dueSatisfied = (activityType: string): boolean | null =>
    activityType === "blunder_drill"
      ? hasDrillDue
      : activityType === "endgame_drill"
        ? hasEndgameDue
        : activityType === "spaced_review"
          ? hasPuzzleDue
          : null; // null = not a due-gated activity

  // Depth/breadth multipliers (1 = neutral) — only one side is ever > 1.
  const depthMul =
    prefs?.depthVsBreadth === "depth" ? 1 + p.depthWeaknessBonus.value : 1;
  const breadthMul =
    prefs?.depthVsBreadth === "breadth" ? 1 + p.breadthRoiBonus.value : 1;

  const userFormats = prefs?.formats ?? null;
  const ownedRefs = prefs?.ownedRefs ?? null;

  const scored = input.candidates
    .filter((c) => dueSatisfied(c.activityType) !== false)
    .map((c) => {
      const roiTerm = w.activityRoiPrior.value * c.priority * breadthMul;
      const weaknessTerm = c.drivingSignal
        ? w.weaknessSeverity.value * c.drivingSignal.severity * depthMul
        : 0;
      const dueTerm =
        dueSatisfied(c.activityType) === true ? w.dueReviews.value : 0;

      // Format fit: penalise an activity that declares formats none of which the user plays.
      const formatPenalty =
        userFormats &&
        userFormats.length > 0 &&
        c.formats &&
        c.formats.length > 0 &&
        !c.formats.some((f) => userFormats.includes(f))
          ? p.formatMismatchPenalty.value
          : 0;

      // Owned-resource bonus: reward an activity whose resource the user already owns.
      const ownedBonus =
        c.owned ||
        (ownedRefs && ownedRefs.length > 0 && candidateIsOwned(c, ownedRefs))
          ? p.ownedResourceBonus.value
          : 0;

      return {
        ...c,
        score: roiTerm + weaknessTerm + dueTerm + ownedBonus - formatPenalty,
      };
    });
  const fitEnabled = cfg.trainingFit?.positiveTieBreakEnabled.value === true;
  const fitEligibleIds = prefs?.fitEligibleActivityIds
    ? new Set(prefs.fitEligibleActivityIds)
    : null;
  const ranked = scored.map((candidate) => {
    const activityFit = prefs?.activityFit?.[candidate.activityType] ?? 0;
    const resourceKeys = [
      candidate.bookResource?.id,
      candidate.resourceTheme,
      candidate.activityId,
    ].filter((value): value is string => Boolean(value));
    const resourceFit = Math.max(
      0,
      ...resourceKeys.map((key) => prefs?.resourceFit?.[key] ?? 0),
    );
    return {
      candidate,
      fitScore: fitEnabled ? Math.max(activityFit, resourceFit) : 0,
      fitEligible:
        fitEnabled &&
        (fitEligibleIds === null || fitEligibleIds.has(candidate.activityId)),
      dueClass: dueSatisfied(candidate.activityType) === true,
    };
  });
  const baseOrder = [...ranked].sort(
    (a, b) =>
      b.candidate.score - a.candidate.score ||
      a.candidate.activityId.localeCompare(b.candidate.activityId),
  );
  const baseRank = new Map(
    baseOrder.map((entry, index) => [entry.candidate.activityId, index]),
  );

  // Keep every ineligible or differently-due candidate in its baseline slot. Within
  // equal-score, equal-due groups, reorder only the focus-serving candidates among the
  // slots they already occupied. This makes fit incapable of crossing either boundary.
  const ordered = [...baseOrder];
  let start = 0;
  while (start < baseOrder.length) {
    const first = baseOrder[start]!;
    if (!first.fitEligible) {
      start += 1;
      continue;
    }
    let end = start + 1;
    while (
      end < baseOrder.length &&
      baseOrder[end]!.fitEligible &&
      baseOrder[end]!.candidate.score === first.candidate.score &&
      baseOrder[end]!.dueClass === first.dueClass
    ) {
      end += 1;
    }
    const byFit = baseOrder
      .slice(start, end)
      .sort(
        (a, b) =>
          b.fitScore - a.fitScore ||
          a.candidate.activityId.localeCompare(b.candidate.activityId),
      );
    ordered.splice(start, end - start, ...byFit);
    start = end;
  }

  return ordered.map(({ candidate, fitScore, fitEligible }, index) => {
    const changedTie =
      fitEligible &&
      fitScore > 0 &&
      index < (baseRank.get(candidate.activityId) ?? Number.POSITIVE_INFINITY);
    return changedTie && cfg.trainingFit
      ? {
          ...candidate,
          fitExplanation: focusSnapshot(cfg.trainingFit.appliedExplanation),
        }
      : candidate;
  });
}

/** Match a candidate to the user's owned-resource identifiers (theme / activity id). Loose
 *  by design — the research catalog will add precise resource keys to match against. */
function candidateIsOwned(
  c: CandidateActivity,
  ownedRefs: readonly string[],
): boolean {
  const refs = new Set(ownedRefs.map(normalizeOwnedRef));
  if (refs.has(normalizeOwnedRef(c.activityId))) return true;
  if (c.resourceTheme && refs.has(normalizeOwnedRef(c.resourceTheme))) {
    return true;
  }
  if (c.bookResource) {
    return (
      refs.has(normalizeOwnedRef(c.bookResource.id)) ||
      refs.has(normalizeOwnedRef(c.bookResource.title))
    );
  }
  return false;
}

const CONFIDENCE_ORDER: Record<Confidence, number> = {
  insufficient: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function focusSnapshot(value: {
  value: string;
  grade: Grade;
  tier: Tier;
  citationKey: string;
  flag?: GradedFlag;
  soften?: boolean;
}): FocusRationaleSnapshot {
  return {
    text: value.value,
    grade: value.grade,
    tier: value.tier,
    citationKey: value.citationKey,
    ...(value.flag ? { flag: value.flag } : {}),
    soften: value.soften ?? (value.grade === "C" || value.grade === "D"),
  };
}

function trainingFitPolicy(cfg: MethodologyConfig) {
  if (!cfg.trainingFit) {
    throw new Error("Methodology config has no training-fit policy");
  }
  return cfg.trainingFit;
}

function positiveAverage(
  currentValue: number | undefined,
  currentCount: number | undefined,
  nextValue: number,
): { value: number; count: number } {
  const count = currentCount ?? (currentValue === undefined ? 0 : 1);
  return {
    value: ((currentValue ?? 0) * count + nextValue) / (count + 1),
    count: count + 1,
  };
}

/** P8: append one observation to the derived preference state in constant work. */
export function updateTrainingPreferences(
  current: TrainingFitPreferenceRollup,
  observation: TrainingFitObservation,
  cfg: MethodologyConfig,
): TrainingFitPreferenceRollup {
  const policy = trainingFitPolicy(cfg);
  const enjoyment = { ...current.enjoyment };
  const enjoymentEvidenceCount = { ...current.enjoymentEvidenceCount };
  const resourceAffinity = { ...current.resourceAffinity };
  const resourceEvidenceCount = { ...current.resourceEvidenceCount };
  const timeFit = { ...current.timeFit };
  let sessionTimeFit = current.sessionTimeFit;
  const enjoymentScore =
    observation.enjoyment === "enjoyed"
      ? policy.enjoymentScores.enjoyed.value
      : observation.enjoyment === "not_enjoyed"
        ? policy.enjoymentScores.notEnjoyed.value
        : policy.enjoymentScores.neutral.value;
  const relevanceScore =
    observation.relevance === "relevant"
      ? policy.relevanceScores.relevant.value
      : observation.relevance === "not_relevant"
        ? policy.relevanceScores.notRelevant.value
        : policy.relevanceScores.neutral.value;

  if (observation.activityType) {
    if (enjoymentScore > 0) {
      const next = positiveAverage(
        enjoyment[observation.activityType],
        enjoymentEvidenceCount[observation.activityType],
        enjoymentScore,
      );
      enjoyment[observation.activityType] = next.value;
      enjoymentEvidenceCount[observation.activityType] = next.count;
    }
    timeFit[observation.activityType] = observation.timeFit;
  } else {
    sessionTimeFit = observation.timeFit;
  }
  if (observation.resourceKey && relevanceScore > 0) {
    const next = positiveAverage(
      resourceAffinity[observation.resourceKey],
      resourceEvidenceCount[observation.resourceKey],
      relevanceScore,
    );
    resourceAffinity[observation.resourceKey] = next.value;
    resourceEvidenceCount[observation.resourceKey] = next.count;
  }

  return {
    enjoyment: Object.fromEntries(
      Object.entries(enjoyment).sort(([a], [b]) => a.localeCompare(b)),
    ),
    enjoymentEvidenceCount: Object.fromEntries(
      Object.entries(enjoymentEvidenceCount).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    resourceAffinity: Object.fromEntries(
      Object.entries(resourceAffinity).sort(([a], [b]) => a.localeCompare(b)),
    ),
    resourceEvidenceCount: Object.fromEntries(
      Object.entries(resourceEvidenceCount).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    timeFit,
    sessionTimeFit,
    frictionTags: [
      ...new Set([...current.frictionTags, ...observation.frictionTags]),
    ].sort(),
    evidenceCount: current.evidenceCount + 1,
    methodologyVersion: cfg.version,
  };
}

/** P8: reduce append-only fit observations into descriptive, positive-only preferences.
 * Negative and neutral responses remain in the source records but never become a penalty. */
export function rollUpTrainingPreferences(
  observations: readonly TrainingFitObservation[],
  cfg: MethodologyConfig,
): TrainingFitPreferenceRollup {
  const ordered = [...observations].sort(
    (a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id),
  );
  return ordered.reduce<TrainingFitPreferenceRollup>(
    (current, observation) =>
      updateTrainingPreferences(current, observation, cfg),
    {
      enjoyment: {},
      enjoymentEvidenceCount: {},
      resourceAffinity: {},
      resourceEvidenceCount: {},
      timeFit: {},
      sessionTimeFit: null,
      frictionTags: [],
      evidenceCount: 0,
      methodologyVersion: cfg.version,
    },
  );
}

function promptFrom(
  kind: TrainingFitPrompt["kind"],
  activityType: string | null,
  value: {
    value: string;
    grade: Grade;
    tier: Tier;
    citationKey: string;
  },
): TrainingFitPrompt {
  const snapshot = focusSnapshot(value);
  return { kind, activityType, ...snapshot };
}

/** P8: sparse prompt selection. A persisted exposure timestamp is an input, so silence
 * creates a cooldown rather than another reminder. */
export function selectTrainingFitPrompt(
  input: TrainingFitPromptInput,
  cfg: MethodologyConfig,
): TrainingFitPrompt | null {
  const policy = trainingFitPolicy(cfg);
  const lastAnyPromptAt = Math.max(
    input.lastWeeklyPromptAt ?? Number.NEGATIVE_INFINITY,
    input.lastContextPromptAt ?? Number.NEGATIVE_INFINITY,
  );
  const minimumPromptGapReady =
    lastAnyPromptAt === Number.NEGATIVE_INFINITY ||
    input.now - lastAnyPromptAt >= policy.weeklyCheckInDays.value * DAY_MS;
  const contextReady =
    minimumPromptGapReady &&
    (input.lastContextPromptAt === null ||
      input.now - input.lastContextPromptAt >=
        policy.contextualCooldownDays.value * DAY_MS);
  const candidate = input.contextualCandidate;
  if (
    contextReady &&
    candidate &&
    candidate.problemCount >= policy.repeatedProblemCount.value
  ) {
    return promptFrom(
      "repeated_problem",
      candidate.activityType,
      policy.repeatedProblemPrompt,
    );
  }
  if (contextReady && candidate?.novel) {
    return promptFrom(
      "novel_activity",
      candidate.activityType,
      policy.novelActivityPrompt,
    );
  }

  if (input.trainingStartedAt === null) return null;
  const weeklyAnchor = Math.max(
    input.trainingStartedAt,
    input.lastWeeklyFeedbackAt ?? input.trainingStartedAt,
    input.lastWeeklyPromptAt ?? input.trainingStartedAt,
    input.lastContextPromptAt ?? input.trainingStartedAt,
  );
  return input.now - weeklyAnchor >= policy.weeklyCheckInDays.value * DAY_MS
    ? promptFrom("weekly", null, policy.weeklyPrompt)
    : null;
}

/** P5: choose a stable, evidence-led weekly direction. Free-form goal labels are never
 * interpreted; only bounded structural goal kinds map to approved focus dimensions. */
export function selectWeeklyFocus(
  input: WeeklyFocusInput,
  cfg: MethodologyConfig,
): WeeklyFocusSelection {
  const policy = cfg.weeklyFocus;
  if (!policy) throw new Error("Methodology config has no weekly focus policy");
  const scores = new Map<string, { score: number; sources: Set<string> }>();
  const add = (dimension: string, amount: number, source: string) => {
    if (!cfg.dimensions.some((d) => d.id === dimension)) return;
    const current = scores.get(dimension) ?? {
      score: 0,
      sources: new Set<string>(),
    };
    current.score += amount;
    current.sources.add(source);
    scores.set(dimension, current);
  };
  const minimum = CONFIDENCE_ORDER[policy.minimumSignalConfidence.value];
  for (const signal of input.weaknessSignals) {
    if (CONFIDENCE_ORDER[signal.confidence] < minimum) continue;
    add(
      signal.dimension,
      signal.severity * policy.weights.measuredWeakness.value,
      "measured weakness",
    );
  }
  for (const skill of input.latestSkillState) {
    if (skill.sampleSize === 0) continue;
    add(
      skill.dimension,
      Math.max(0, 1 - skill.estimate) * policy.weights.skillState.value,
      "skill history",
    );
  }
  for (const goal of input.goals) {
    for (const dimension of policy.goalProcessFocus[goal.kind] ?? []) {
      add(
        dimension,
        policy.weights.goalAlignment.value,
        `process goal:${goal.kind}`,
      );
    }
  }
  for (const due of input.dueWork) {
    for (const activity of cfg.activities.filter(
      (candidate) => candidate.activityType === due.itemType,
    )) {
      for (const dimension of activity.dimensions)
        add(dimension, policy.weights.dueWork.value, "due learning");
    }
  }
  const fitWeight = policy.weights.fitPreference.value;
  const owned =
    fitWeight > 0
      ? new Set(
          input.ownedResources.flatMap((resource) =>
            [resource.label, resource.externalRef]
              .filter((value): value is string => Boolean(value))
              .map(normalizeOwnedRef),
          ),
        )
      : null;
  for (const activity of cfg.activities) {
    if (
      input.activityRecency.lastEventAtByType[activity.activityType] ===
      undefined
    ) {
      for (const dimension of activity.dimensions)
        add(dimension, policy.weights.recency.value, "variety fit");
    }
    if (!owned) continue;
    const enjoyment =
      input.trainingPreferences.preferences.enjoyment[activity.activityType];
    const ownedFit =
      owned.has(normalizeOwnedRef(activity.id)) ||
      (activity.resourceTheme
        ? owned.has(normalizeOwnedRef(activity.resourceTheme))
        : false);
    if (enjoyment !== undefined || ownedFit) {
      const fit = (enjoyment ?? 0) + (ownedFit ? 1 : 0);
      for (const dimension of activity.dimensions) {
        add(dimension, fit * fitWeight, "bounded fit preference");
      }
    }
  }
  const ranked = [...scores.entries()]
    .map(([focusArea, value]) => ({
      focusArea,
      score: value.score,
      sources: [...value.sources].sort(),
    }))
    .sort(
      (a, b) => b.score - a.score || a.focusArea.localeCompare(b.focusArea),
    );
  if (ranked.length === 0) {
    for (const dimension of cfg.dimensions)
      ranked.push({
        focusArea: dimension.id,
        score: 0,
        sources: ["methodology prior"],
      });
  }
  const chosen = ranked.slice(0, policy.maxFocusAreas.value);
  const goalAligned = new Set(
    input.goals.flatMap((goal) => policy.goalProcessFocus[goal.kind] ?? []),
  );
  const chosenAreas = new Set(chosen.map((candidate) => candidate.focusArea));
  const alternatives = ranked
    .filter(
      (candidate) =>
        goalAligned.has(candidate.focusArea) &&
        !chosenAreas.has(candidate.focusArea),
    )
    .slice(0, policy.maxAlternatives.value)
    .map((candidate) => ({
      focusArea: candidate.focusArea,
      score: candidate.score,
      supportingSources: candidate.sources,
      tradeoff: focusSnapshot(policy.alternativeRationale),
    }));
  const confidence = input.weaknessSignals.some(
    (s) => CONFIDENCE_ORDER[s.confidence] >= minimum,
  )
    ? input.weaknessSignals.reduce<Confidence>(
        (best, s) =>
          CONFIDENCE_ORDER[s.confidence] > CONFIDENCE_ORDER[best]
            ? s.confidence
            : best,
        "insufficient",
      )
    : input.latestSkillState.some((s) => s.sampleSize > 0)
      ? "low"
      : "insufficient";
  return {
    focusAreas: chosen.map((x) => x.focusArea),
    supportingSignals: chosen,
    confidence,
    rationale: focusSnapshot(policy.selectionRationale),
    alternatives,
  };
}

/** P5: permit revision only for a stable-window expiry, a meaningful constraint change,
 * a confidence-gate crossing, or a meaningful accumulated skill shift. */
export function shouldReviseWeeklyFocus(
  input: WeeklyFocusRevisionInput,
  cfg: MethodologyConfig,
): {
  revise: boolean;
  reason: "stable" | "window" | "constraints" | "confidence" | "skill";
  rationale: FocusRationaleSnapshot | null;
} {
  const p = cfg.weeklyFocus;
  if (!p) throw new Error("Methodology config has no weekly focus policy");
  if (input.ageDays >= p.stabilityDays.value)
    return {
      revise: true,
      reason: "window",
      rationale: focusSnapshot(p.revisionRationale),
    };
  if (
    Math.abs(
      input.nextConstraints.minutesPerDay -
        input.previousConstraints.minutesPerDay,
    ) >= p.meaningfulConstraintMinutes.value ||
    input.nextConstraints.daysPerWeek !== input.previousConstraints.daysPerWeek
  )
    return {
      revise: true,
      reason: "constraints",
      rationale: focusSnapshot(p.revisionRationale),
    };
  const minimum = CONFIDENCE_ORDER[p.minimumSignalConfidence.value];
  const qualified = (signals: readonly WeaknessSignal[]) =>
    new Set(
      signals
        .filter((s) => CONFIDENCE_ORDER[s.confidence] >= minimum)
        .map((s) => s.dimension),
    );
  const before = qualified(input.previousSignals);
  const after = qualified(input.nextSignals);
  if (
    [...new Set([...before, ...after])].some(
      (d) => before.has(d) !== after.has(d),
    )
  )
    return {
      revise: true,
      reason: "confidence",
      rationale: focusSnapshot(p.revisionRationale),
    };
  const oldSkill = new Map(
    input.previousSkillState.map((s) => [s.dimension, s.estimate]),
  );
  if (
    input.nextSkillState.some(
      (s) =>
        oldSkill.has(s.dimension) &&
        Math.abs(s.estimate - oldSkill.get(s.dimension)!) >=
          p.meaningfulSkillDelta.value,
    )
  )
    return {
      revise: true,
      reason: "skill",
      rationale: focusSnapshot(p.revisionRationale),
    };
  return { revise: false, reason: "stable", rationale: null };
}

// ---------------------------------------------------------------------------
// Seam 6 — Spacing / scheduling (SPACED_REPETITION; METHODOLOGY Seam 6, M7)
// ---------------------------------------------------------------------------

/**
 * Seam 6 — map an outcome to an FSRS grade (1 Again · 2 Hard · 3 Good · 4 Easy). A wrong
 * answer is always Again. A correct answer is Good unless solve time (relative to the band
 * median) places it Fast→Easy or Slow→Hard. The solve-time thresholds are a STUB until the
 * app has its own timing data, so without a median (or without timing) every correct answer
 * is Good. All numbers read from config (L1).
 */
export function gradeFromOutcome(
  input: {
    correct: boolean;
    solveTimeMs?: number | null;
    bandMedianMs?: number | null;
  },
  cfg: MethodologyConfig,
): FsrsGrade {
  if (!input.correct) return 1;
  const median = input.bandMedianMs;
  const t = input.solveTimeMs;
  if (median != null && median > 0 && t != null) {
    const g = cfg.scheduling.solveTimeGrade;
    if (t < median * g.fastFactor.value) return 4;
    if (t > median * g.slowFactor.value) return 2;
  }
  return 3;
}

export function newItemScheduleGrade(cfg: MethodologyConfig): FsrsGrade {
  const seed = cfg.scheduling.newItemSeedGrade;
  if (!seed) {
    throw new Error("Methodology config is missing the new-item schedule seed");
  }
  return seed.value;
}

/**
 * Seam 6 — step an item's spaced-review schedule for a grade. The Engine owns the FSRS math
 * (engine/math/fsrsStep); this fn only feeds it the Seam-6 parameters (weight vector,
 * desired retention, interval cap). `fsrsState === null` is a first review. Pure (L2): the
 * review time `now` is injected. Returns the next due time + the new memory state.
 */
export function scheduleReview(
  input: { grade: FsrsGrade; fsrsState: FsrsState | null; now: number },
  cfg: MethodologyConfig,
): { nextDue: number; newState: FsrsState } {
  const s = cfg.scheduling;
  const newState = fsrsStep(input.fsrsState, input.grade, input.now, {
    weights: s.fsrsWeights.value,
    desiredRetention: s.desiredRetention.value,
    maximumIntervalDays: s.maximumIntervalDays.value,
  });
  return { nextDue: newState.due, newState };
}

export interface RedoFlowPolicy {
  retestDelaySec: number;
  hint: {
    mode: "solution-start-square";
    includeMotifNames: boolean;
    copy: string;
    evidenceGrade: Grade;
    evidenceTier: Tier;
    citationKey: string;
    flag?: GradedFlag;
  };
}

/** Seam 6: read the complete redo scaffold as one graded policy. */
export function redoFlowPolicy(cfg: MethodologyConfig): RedoFlowPolicy {
  const delay = cfg.scheduling.intraSessionRetestDelaySec;
  const hint = cfg.scheduling.scaffoldedHint;
  if (!delay || !hint) {
    throw new Error("Methodology config is missing the redo-flow policy");
  }
  return {
    retestDelaySec: delay.value,
    hint: {
      mode: hint.mode.value,
      includeMotifNames: hint.includeMotifNames.value,
      copy: hint.copy.value,
      evidenceGrade: hint.copy.grade,
      evidenceTier: hint.copy.tier,
      citationKey: hint.copy.citationKey,
      flag: hint.copy.flag,
    },
  };
}

// ---------------------------------------------------------------------------
// Measurement & expectations — signal-vs-noise on the Glicko-2 CI (EXPECTATIONS;
// METHODOLOGY Measurement, M7). The expectation table + FIDE rule land with M8.
// ---------------------------------------------------------------------------

/** One point in a rating time series (a ChessProfileSnapshot reduced to rating + RD). */
export interface RatingPoint {
  at: number;
  rating: number;
  rd: number;
}

/** Whether a rating is a "stable enough" baseline: its RD is at/below the config max. */
export function isStableBaseline(rd: number, cfg: MethodologyConfig): boolean {
  return rd <= cfg.measurement.rdBaselineMax.value;
}

/**
 * Measurement — is the change between the first and latest STABLE points a real gain, not
 * noise? True only when the latest CI lower bound clears the baseline CI upper bound (the
 * non-overlapping-CI rule; Glickman 2012). Needs ≥2 stable points, else false.
 */
export function isProgressReal(
  input: { history: readonly RatingPoint[] },
  cfg: MethodologyConfig,
): boolean {
  const k = cfg.measurement.ciMultiplier.value;
  const stable = input.history
    .filter((p) => isStableBaseline(p.rd, cfg))
    .sort((a, b) => a.at - b.at);
  if (stable.length < 2) return false;
  const base = stable[0]!;
  const cur = stable[stable.length - 1]!;
  return (
    glickoConfidenceInterval(cur.rating, cur.rd, k).lower >
    glickoConfidenceInterval(base.rating, base.rd, k).upper
  );
}

export interface PlateauResult {
  isPlateau: boolean;
  suggestedStimulusChange: boolean;
  /** Why this verdict — surfaced honestly (insufficient data is not a plateau). */
  reason: "insufficient" | "new_high" | "plateau";
}

/**
 * Seam 7 — plateau detection over a Glicko-2 history (uses the Measurement CI rule). A
 * plateau is flagged when, within the last `plateauWindowDays`, the CI upper bound has set
 * NO new high above its pre-window historical max — i.e. progress has stalled within noise.
 * Deterministic without a clock: "now" is the latest stable point's timestamp. Insufficient
 * history (no stable points before/within the window) is reported as such, never as a
 * plateau (the honesty engine).
 */
export function detectPlateau(
  input: { history: readonly RatingPoint[] },
  cfg: MethodologyConfig,
): PlateauResult {
  const k = cfg.measurement.ciMultiplier.value;
  const windowMs = cfg.measurement.plateauWindowDays.value * DAY_MS;
  const stable = input.history
    .filter((p) => isStableBaseline(p.rd, cfg))
    .sort((a, b) => a.at - b.at);
  if (stable.length < 2) {
    return {
      isPlateau: false,
      suggestedStimulusChange: false,
      reason: "insufficient",
    };
  }
  const windowStart = stable[stable.length - 1]!.at - windowMs;
  const before = stable.filter((p) => p.at < windowStart);
  const within = stable.filter((p) => p.at >= windowStart);
  if (before.length === 0 || within.length === 0) {
    return {
      isPlateau: false,
      suggestedStimulusChange: false,
      reason: "insufficient",
    };
  }
  const upper = (p: RatingPoint): number =>
    glickoConfidenceInterval(p.rating, p.rd, k).upper;
  const histMax = Math.max(...before.map(upper));
  const recentMax = Math.max(...within.map(upper));
  if (recentMax > histMax) {
    return {
      isPlateau: false,
      suggestedStimulusChange: false,
      reason: "new_high",
    };
  }
  return { isPlateau: true, suggestedStimulusChange: true, reason: "plateau" };
}

export interface GradedExpectation {
  text: string;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  flag?: GradedFlag;
}

/**
 * Measurement — return the graded expectation copy for a specific band.
 */
export function expectationForBand(
  band: Band,
  cfg: MethodologyConfig,
): GradedExpectation {
  const ex = cfg.measurement.expectationsByBand[band];
  if (!ex) {
    // Fall back to top band if missing (should not happen with coherent stub).
    const topBand = cfg.bands[cfg.bands.length - 1]!.id;
    const topEx = cfg.measurement.expectationsByBand[topBand]!;
    return {
      text: topEx.value,
      evidenceGrade: topEx.grade,
      evidenceTier: topEx.tier,
      citationKey: topEx.citationKey,
      flag: topEx.flag,
    };
  }
  return {
    text: ex.value,
    evidenceGrade: ex.grade,
    evidenceTier: ex.tier,
    citationKey: ex.citationKey,
    flag: ex.flag,
  };
}

// ---------------------------------------------------------------------------
// Seam 4.1 — Structured game-analysis protocol (GAME_ANALYSIS; Seam 4 §4.1)
// ---------------------------------------------------------------------------

function gameAnalysisRuntime(cfg: MethodologyConfig) {
  const runtime = cfg.gameAnalysis.runtime;
  if (!runtime) {
    throw new Error("Methodology config is missing game-analysis runtime data");
  }
  return runtime;
}

function gameSelectionScoring(cfg: MethodologyConfig) {
  const scoring = cfg.gameAnalysis.selectionScoring;
  if (!scoring) {
    throw new Error(
      "Methodology config is missing game-selection scoring data",
    );
  }
  return scoring;
}

export interface GameInput {
  id: string;
  pgn: string;
  playedAt: Date | string | number | null;
  result: "win" | "loss" | "draw" | string | null;
  color: "w" | "b" | string | null;
  userRatingAtGame?: number | null;
  rawFeatures?: RawGameFeatures | null;
}

export interface CriticalMoment {
  ply: number;
  cpBefore: number;
  cpAfter: number;
  cpLoss: number;
  fen?: string;
  /** An alternative move is graded "correct" when its own cpLoss is at or below this
   *  (Seam 4.1 §guessAcceptanceCpLossRatio combined with the RPL visible threshold) —
   *  the player need not find the engine's literal #1 move (L1: the number is config,
   *  the comparison is plain UI arithmetic). */
  maxAcceptableCpLoss: number;
  /** An alternative also grades "correct" when its win-probability drop is at or below this
   *  (Seam 4 §maxAcceptableWinProbDrop) — the mate-safe grading the client prefers, so a
   *  move that keeps the win counts even if it isn't the engine's fastest mate. */
  maxAcceptableWinProbDrop: number;
}

export interface EngineLine {
  pv: string[];
  depth: number;
  evaluation: number;
  mate: boolean;
}

export interface FilteredLine extends EngineLine {
  visible: boolean;
  reason: string;
  humanAlternative?: EngineLine;
}

export interface SRSPuzzle {
  ply: number;
  fen: string;
  cpLoss: number;
  movePlayed?: string;
  alternativeMove?: string;
}

export interface AnalysisSession {
  calibrationPrompt: string;
  analysisUnlockDelay: number;
  tiltBlocked: boolean;
  criticalMoments: CriticalMoment[];
  rplFilteredLines: FilteredLine[];
  srsPuzzles: SRSPuzzle[];
  gameSelectionRatio: { win: number; loss: number };
  /** Failed attempts allowed before the player may reveal the engine's moves (Seam 4 §Step
   *  2/3 — the desirable-difficulty dosage; config-driven, L1). */
  revealAfterMisses: number;
}

export interface RecentGame {
  id: string;
  result: "win" | "loss" | "draw" | string | null;
  color: "w" | "b" | string | null;
  playedAt: Date | string | number;
  rawFeatures?: RawGameFeatures | null;
}

export interface SuggestedGame {
  gameId: string;
  score: number;
  suggestedReason: string;
  isWinRatioMatch: boolean;
  result: "win" | "loss" | "draw" | string | null;
}

export interface RecentResult {
  playedAt: Date | string | number;
  result: "win" | "loss" | "draw" | string | null;
}

export interface TiltState {
  tilted: boolean;
  reason?: string;
}

/**
 * Seam 4.1 — detect tilt based on per-band rules (losses in time, losses in row, rating decline).
 * Pure and deterministic (L2).
 */
export function detectTilt(
  recentResults: readonly RecentResult[],
  band: Band,
  clock: Clock,
  cfg: MethodologyConfig,
): TiltState {
  const emotional = cfg.gameAnalysis.emotionalCalibration;
  if (
    !emotional.enabled.value ||
    !cfg.gameAnalysis.tiltPreventionEnabled.value
  ) {
    return { tilted: false };
  }

  const bandCfg = emotional.perBand[band];
  if (!bandCfg) {
    return { tilted: false };
  }

  const trigger = bandCfg.tiltTrigger.value;
  if (trigger.kind === "none") {
    return { tilted: false };
  }

  // Sort descending: most recent game first
  const sorted = [...recentResults].sort((a, b) => {
    const tA = new Date(a.playedAt).getTime();
    const tB = new Date(b.playedAt).getTime();
    return tB - tA;
  });
  const runtime = gameAnalysisRuntime(cfg);

  if (trigger.kind === "losses_in_row") {
    const countNeeded = trigger.count ?? runtime.lossesInRowCount.value;
    if (sorted.length < countNeeded) {
      return { tilted: false };
    }
    // Check if the most recent N games are all losses
    const consecutiveLosses = sorted
      .slice(0, countNeeded)
      .filter((r) => r.result === "loss");
    if (consecutiveLosses.length === countNeeded) {
      return {
        tilted: true,
        reason: `Loss-chasing cooldown active after ${countNeeded} consecutive losses. Take a break!`,
      };
    }
  } else if (trigger.kind === "losses_in_time") {
    const countNeeded = trigger.count ?? runtime.lossesInRowCount.value;
    const windowMs = trigger.timeWindowMs ?? runtime.lossesInTimeWindowMs.value;
    const now = clock.now();
    const cutoff = now - windowMs;

    const recentLosses = sorted.filter((r) => {
      const t = new Date(r.playedAt).getTime();
      return t >= cutoff && r.result === "loss";
    });

    if (recentLosses.length >= countNeeded) {
      return {
        tilted: true,
        reason: `Loss-chasing cooldown active after ${recentLosses.length} losses in the last hour. Take a break!`,
      };
    }
  } else if (trigger.kind === "performance_decline") {
    const threshold =
      trigger.declineThreshold ?? runtime.performanceDeclineThreshold.value;
    const recentWindowSize = runtime.performanceRecentWindowGames.value;
    const baselineWindowSize = runtime.performanceBaselineWindowGames.value;
    const minimumSampleGames = runtime.performanceMinimumSampleGames.value;

    const recentGames = sorted.slice(0, recentWindowSize);
    const baselineGames = sorted.slice(
      recentWindowSize,
      recentWindowSize + baselineWindowSize,
    );

    // Only assess if we have enough games in both groups to be statistically sound
    if (
      recentGames.length >= minimumSampleGames &&
      baselineGames.length >= minimumSampleGames
    ) {
      const winRate = (games: readonly RecentResult[]): number => {
        const wins = games.filter((g) => g.result === "win").length;
        const draws = games.filter((g) => g.result === "draw").length;
        return (wins + 0.5 * draws) / games.length;
      };

      const recentWinRate = winRate(recentGames);
      const baselineWinRate = winRate(baselineGames);

      if (baselineWinRate - recentWinRate >= threshold) {
        return {
          tilted: true,
          reason: `Performance decline detected. Win rate dropped by ${Math.round((baselineWinRate - recentWinRate) * 100)}%. Take a break!`,
        };
      }
    }
  }

  return { tilted: false };
}

/** Helper function to score a game based on learning opportunities. */
function scoreGameForAnalysis(
  game: RecentGame,
  cfg: MethodologyConfig,
): number {
  if (!game.rawFeatures) return 0;
  const isUserPly = (ply: number): boolean => {
    return game.color === "w" ? ply % 2 === 1 : ply % 2 === 0;
  };

  const evals = game.rawFeatures.moveEvals || [];
  const scoring = gameSelectionScoring(cfg);
  let score = 0;

  if (game.result === "win") {
    // Look for conversion opportunities: won, but had mistakes/blunders
    for (const m of evals) {
      if (
        isUserPly(m.ply) &&
        m.cpLoss >= scoring.winMoveCpLossThreshold.value
      ) {
        score += m.cpLoss;
      }
    }
    if (game.rawFeatures.conversion?.reachedWinningPlus) {
      score += scoring.winConversionBonus.value;
    }
  } else if (game.result === "loss") {
    // Look for clear learning moments: critical blunders
    for (const m of evals) {
      if (
        isUserPly(m.ply) &&
        m.cpLoss >= scoring.lossMoveCpLossThreshold.value
      ) {
        score += m.cpLoss;
      }
    }
  } else {
    // Draw: check for blunders or failed conversion
    for (const m of evals) {
      if (
        isUserPly(m.ply) &&
        m.cpLoss >= scoring.drawMoveCpLossThreshold.value
      ) {
        score += m.cpLoss;
      }
    }
    if (
      game.rawFeatures.conversion?.reachedWinningPlus &&
      !game.rawFeatures.conversion?.converted
    ) {
      score += scoring.drawFailedConversionBonus.value;
    }
  }

  return score;
}

/**
 * Seam 4.1 — select and suggest recent games for analysis, enforcing the per-band win:loss ratios.
 * Pure and deterministic (L2).
 */
export function selectGamesForAnalysis(
  recentGames: readonly RecentGame[],
  band: Band,
  cfg: MethodologyConfig,
): SuggestedGame[] {
  const selection = cfg.gameAnalysis.gameSelection;
  if (!selection.enabled.value) {
    return [];
  }

  const bandCfg = selection.perBand[band];
  if (!bandCfg) {
    return [];
  }

  const winRatio = bandCfg.winRatio.value;

  const wins = recentGames.filter((g) => g.result === "win");
  // Non-wins (losses and draws) are grouped for success-biased selection
  const nonWins = recentGames.filter((g) => g.result !== "win");

  const scoredWins = wins
    .map((g) => ({ game: g, score: scoreGameForAnalysis(g, cfg) }))
    .sort((a, b) => b.score - a.score);

  const scoredNonWins = nonWins
    .map((g) => ({ game: g, score: scoreGameForAnalysis(g, cfg) }))
    .sort((a, b) => b.score - a.score);

  const maxSuggestions = gameSelectionScoring(cfg).maxSuggestions.value;
  const targetWinsCount = Math.round(maxSuggestions * winRatio);
  const targetLossesCount = maxSuggestions - targetWinsCount;

  const selected: SuggestedGame[] = [];
  let winIdx = 0;
  let lossIdx = 0;

  // 1. Fill up to target counts with the best available games
  while (
    selected.length < maxSuggestions &&
    winIdx < scoredWins.length &&
    selected.filter((g) => g.result === "win").length < targetWinsCount
  ) {
    const item = scoredWins[winIdx]!;
    selected.push({
      gameId: item.game.id,
      score: item.score,
      suggestedReason: `Success reinforcement: ${bandCfg.focusDescription.value}`,
      isWinRatioMatch: true,
      result: "win",
    });
    winIdx++;
  }

  while (
    selected.length < maxSuggestions &&
    lossIdx < scoredNonWins.length &&
    selected.filter((g) => g.result !== "win").length < targetLossesCount
  ) {
    const item = scoredNonWins[lossIdx]!;
    selected.push({
      gameId: item.game.id,
      score: item.score,
      suggestedReason: `Learning moment: ${bandCfg.focusDescription.value}`,
      isWinRatioMatch: true,
      result: item.game.result,
    });
    lossIdx++;
  }

  // 2. Backfill with wins if we have slots left
  while (selected.length < maxSuggestions && winIdx < scoredWins.length) {
    const item = scoredWins[winIdx]!;
    selected.push({
      gameId: item.game.id,
      score: item.score,
      suggestedReason: `Additional won game for conversion review`,
      isWinRatioMatch: false,
      result: "win",
    });
    winIdx++;
  }

  // 3. Backfill with non-wins if we have slots left
  while (selected.length < maxSuggestions && lossIdx < scoredNonWins.length) {
    const item = scoredNonWins[lossIdx]!;
    selected.push({
      gameId: item.game.id,
      score: item.score,
      suggestedReason: `Additional game for error review`,
      isWinRatioMatch: false,
      result: item.game.result,
    });
    lossIdx++;
  }

  return selected;
}

/**
 * Seam 3 §(d) — Applies RPL filtering to engine lines. The per-band visible-error threshold
 * is read from config (`visibleErrorThresholdCp`, a graded leaf): a line is shown only when
 * it is a forced mate or its swing clears the band's threshold — sub-threshold swings are
 * noise/positional subtleties beyond that band's Region of Proximal Learning. A threshold of
 * 0 (top bands) shows everything. The graded entropy window flags chaotic positions in the
 * `reason`. Pure and deterministic (L2); no hardcoded band logic or thresholds.
 */
export function filterEngineLines(
  lines: readonly EngineLine[],
  band: Band,
  cfg: MethodologyConfig,
): FilteredLine[] {
  const rpl = cfg.gameAnalysis.rplFiltering;
  const bandCfg = rpl.enabled.value ? rpl.perBand[band] : undefined;

  // Filtering disabled or band unknown → surface every line untouched.
  if (!bandCfg) {
    return lines.map((l) => ({
      pv: [...l.pv],
      depth: l.depth,
      evaluation: l.evaluation,
      mate: l.mate,
      visible: true,
      reason: "",
    }));
  }

  const thresholdCp = bandCfg.visibleErrorThresholdCp.value;

  // Chaotic if ≥2 non-mate lines fall within the entropy window of the best non-mate line.
  const nonMate = lines.filter((l) => !l.mate);
  const top = nonMate[0];
  const chaotic =
    top !== undefined &&
    nonMate.filter(
      (l) =>
        Math.abs(l.evaluation - top.evaluation) <=
        gameAnalysisRuntime(cfg).entropyWindowCp.value,
    ).length >= 2;

  const out: FilteredLine[] = lines.map((line) => {
    const visible = line.mate || Math.abs(line.evaluation) >= thresholdCp;
    let reason = "";
    if (!visible) {
      reason = `Below the ${thresholdCp}cp visibility threshold for this level; beyond your Region of Proximal Learning.`;
    } else if (chaotic) {
      reason =
        "Position is high-entropy (chaotic): several moves are nearly equal.";
    }
    return {
      pv: [...line.pv],
      depth: line.depth,
      evaluation: line.evaluation,
      mate: line.mate,
      visible,
      reason,
    };
  });

  // If the engine's top line is hidden, point to the best visible line as a human alternative.
  if (out.length > 0 && !out[0]!.visible) {
    const alternative = out.find((l) => l.visible);
    if (alternative) {
      out[0]!.humanAlternative = {
        pv: [...alternative.pv],
        depth: alternative.depth,
        evaluation: alternative.evaluation,
        mate: alternative.mate,
      };
    }
  }

  return out;
}

/**
 * Seam 4.1 §Step5 — the per-band suggested win:loss analysis ratio, as percentages, plus its
 * focus copy. Lets a caller show the honest recommendation as a one-line statement instead of
 * a curated game list, without hardcoding the ratio outside config (L1).
 */
export function gameSelectionRatioFor(
  band: Band,
  cfg: MethodologyConfig,
): { winPct: number; lossPct: number; focusDescription: string } | null {
  const selection = cfg.gameAnalysis.gameSelection;
  if (!selection.enabled.value) return null;
  const bandCfg = selection.perBand[band];
  if (!bandCfg) return null;
  return {
    winPct: Math.round(bandCfg.winRatio.value * 100),
    lossPct: Math.round(bandCfg.lossRatio.value * 100),
    focusDescription: bandCfg.focusDescription.value,
  };
}

/**
 * Seam 4.1 — Orchestrates the 5 steps of the game analysis protocol.
 * Pure and deterministic (L2).
 */
export function gameAnalysisProtocol(
  game: GameInput,
  band: Band,
  cfg: MethodologyConfig,
  options?: {
    recentResults?: readonly RecentResult[];
    clock?: Clock;
  },
): AnalysisSession {
  // Step 1: Calibration
  const calibration = cfg.gameAnalysis.emotionalCalibration;
  const calibrationPrompt =
    calibration.enabled.value && calibration.perBand[band]
      ? calibration.perBand[band]!.reflectionPrompt.value
      : "";
  const analysisUnlockDelay =
    calibration.enabled.value && calibration.perBand[band]
      ? calibration.perBand[band]!.analysisUnlockDelayMs.value
      : 0;

  // Tilt Detection
  let tiltBlocked = false;
  if (options?.recentResults && options?.clock) {
    tiltBlocked = detectTilt(
      options.recentResults,
      band,
      options.clock,
      cfg,
    ).tilted;
  }

  // Step 2 & 3: Active Reproduction & RPL Filtering
  const criticalMoments: CriticalMoment[] = [];
  const srsPuzzles: SRSPuzzle[] = [];

  const rpl = cfg.gameAnalysis.rplFiltering;
  const reproduction = cfg.gameAnalysis.activeReproduction.perBand[band];

  if (game.rawFeatures && reproduction) {
    const threshold =
      rpl.perBand[band]?.visibleErrorThresholdCp.value ??
      gameAnalysisRuntime(cfg).fallbackRplThresholdCp.value;
    const maxMoments = reproduction.maxCriticalMoments.value;
    const userColor = game.color;

    const isUserPly = (ply: number): boolean => {
      return userColor === "w" ? ply % 2 === 1 : ply % 2 === 0;
    };

    // Mate-aware, rating-dependent selection (Seam 4). Severity is a move's win-probability
    // drop when available (saturating: a missed mate that stays winning is ~0) — falling
    // back to cpLoss for analyses predating win-prob — and a decisive-zone guard drops moves
    // that didn't change the practical result (still winning / still losing). The winning
    // side can be re-surfaced at bands that train conversion (surfaceMissedConversion).
    const minWinDrop = reproduction.criticalMomentMinWinProbDrop?.value;
    const winningZone = cfg.gameAnalysis.winningZoneCp?.value;
    const surfaceMissed = reproduction.surfaceMissedConversion?.value ?? false;
    const severityOf = (m: { cpLoss: number; winProbDrop?: number }): number =>
      typeof m.winProbDrop === "number" ? m.winProbDrop : m.cpLoss;
    const isCritical = (m: {
      cpLoss: number;
      cpBefore: number;
      cpAfter: number;
      winProbDrop?: number;
    }): boolean => {
      if (winningZone !== undefined) {
        const stillLosing =
          m.cpBefore <= -winningZone && m.cpAfter <= -winningZone;
        if (stillLosing) return false; // don't reproduce blunders in an already-lost game
        const stillWinning =
          m.cpBefore >= winningZone && m.cpAfter >= winningZone;
        if (stillWinning && !surfaceMissed) return false; // missed mate but stayed winning
      }
      return typeof m.winProbDrop === "number" && minWinDrop !== undefined
        ? m.winProbDrop >= minWinDrop
        : m.cpLoss >= threshold;
    };

    // Selected by severity (highest first) but re-sorted back to ply order — the player
    // reproduces them in the order they happened, not in error-severity order.
    const candidates = (game.rawFeatures.moveEvals || [])
      .filter((m) => isUserPly(m.ply) && isCritical(m))
      .sort((a, b) => severityOf(b) - severityOf(a));

    const selectedMoments = candidates
      .slice(0, maxMoments)
      .sort((a, b) => a.ply - b.ply);

    const guessRatio = reproduction.guessAcceptanceCpLossRatio.value;
    const maxAcceptableWinProbDrop =
      reproduction.maxAcceptableWinProbDrop?.value ?? 0;

    for (const moment of selectedMoments) {
      // Find matching FEN from blunder features if available
      const blunder = game.rawFeatures.blunders?.find(
        (b) => b.ply === moment.ply,
      );
      let fen = blunder?.fen || "";

      if (!fen && game.pgn) {
        // If not a blunder (e.g. a mistake under 300cp), reconstruct the FEN by replaying the PGN
        try {
          const replay = new Chess();
          replay.loadPgn(game.pgn);
          const history = replay.history({ verbose: true });
          const played = history[moment.ply - 1];
          if (played) {
            fen = played.before;
          }
        } catch (e) {
          console.warn("gameAnalysisProtocol replay FEN failed:", e);
        }
      }

      criticalMoments.push({
        ply: moment.ply,
        cpBefore: moment.cpBefore,
        cpAfter: moment.cpAfter,
        cpLoss: moment.cpLoss,
        fen,
        // The player's alternative need not be the engine's literal #1 move: it's
        // "correct" once its own cpLoss is at most `guessRatio` of the original
        // blunder AND stays inside this band's RPL visibility threshold — whichever
        // of those two caps is tighter.
        maxAcceptableCpLoss: Math.max(
          0,
          Math.min(moment.cpLoss * guessRatio, threshold),
        ),
        maxAcceptableWinProbDrop,
      });

      // Step 4: SRS Puzzles
      if (cfg.gameAnalysis.srsIntegration.enabled.value && fen) {
        srsPuzzles.push({
          ply: moment.ply,
          fen,
          cpLoss: moment.cpLoss,
        });
      }
    }
  }

  // Step 5: Game Selection
  const selection = cfg.gameAnalysis.gameSelection.perBand[band];
  const gameSelectionRatio = selection
    ? { win: selection.winRatio.value, loss: selection.lossRatio.value }
    : { win: 0.5, loss: 0.5 };

  return {
    calibrationPrompt,
    analysisUnlockDelay,
    tiltBlocked,
    criticalMoments,
    rplFilteredLines: [], // Release engine lines when evaluated client-side
    srsPuzzles,
    gameSelectionRatio,
    revealAfterMisses:
      cfg.gameAnalysis.activeReproduction.revealAfterMisses.value,
  };
}
