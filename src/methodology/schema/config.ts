// The MethodologyConfig structural contract (BUILD.md §2.5; METHODOLOGY §3). This is
// the ONE object through which science enters the system (VISION §4). Every leaf is a
// GradedValue (L3), and every citationKey must resolve in `evidenceLedger` — both are
// enforced here so an ungraded or dangling value is a boot error (loader, §2.6),
// never a silent fallback.
//
// INCREMENTAL BY DESIGN. The full top-level shape in BUILD.md §2.5 lists 13 sub-objects,
// one per seam. Each seam's Zod sub-schema lands with the milestone that first consumes
// it (BUILD.md §2.5: "encoded as Zod schemas under src/methodology/schema/" as seams
// land). M4 shipped bands + assessment (Seam 2) + evidenceLedger; M6 adds the seams the
// program generator consumes:
//   • dimensions            (Seam 1 — the skill taxonomy ProgramItems target)
//   • interpretation        (Seam 3 — raw game features → graded weakness signals)
//   • activities + rules    (Seam 4 — weakness/band → external activity + params)
//   • difficulty            (Seam 5 — servo-controlled puzzle-rating targets)
//   • prioritization        (Seam 7 — the daily-mix scoring weights + volume)
//   • rationale             (Seam 8 — the "why this / why now" copy table)
// M7 added scheduling (Seam 6) + measurement (CI/baseline/plateau). M9 adds engagement
// (Seam 9 — the motivation event policy + ethical guardrails). Parsing is non-strict, so a
// future config may carry a not-yet-coded seam before its schema lands.

import { z } from "zod";

import {
  gradeSchema,
  gradedFlagSchema,
  gradedValue,
  isGradedValue,
  tierSchema,
} from "@/methodology/schema/graded";

// Channel-qualified version id (also the config filename stem and the value persisted
// as `methodologyVersion` for reproducibility, §2.6). e.g. "stub-0.1.0".
const versionSchema = z
  .string()
  .regex(
    /^(stub|research)-\d+\.\d+\.\d+$/,
    "version must be <channel>-<semver>, e.g. stub-0.1.0",
  );

// §0.4 — a band is a convenience prior; the user's own data always overrides it. `id`
// and `label` are structural (an identifier / a display string), not evidence claims;
// the rating cutoffs ARE methodology leaves, so they are graded. null = open-ended edge.
const bandSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  minRating: gradedValue(z.number().nullable()),
  maxRating: gradedValue(z.number().nullable()),
});

// Seam 1 — skill dimensions (SKILL_TAXONOMY; METHODOLOGY Seam 1). `id`/`label` are
// structural (identifier / display string), like a band's — the taxonomy is data, not a
// graded number. ProgramItem.dimensionsTargeted and a WeaknessSignal.dimension reference
// these ids. The per-band salience prior (METHODOLOGY Seam 1) is the research config's
// job; the stub ships the taxonomy only, so a placeholder weight never reads as fact.
const dimensionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

// Seam 2 — assessment calibration. Every number a graded leaf; the two pure functions
// (provider.ts) read these and nothing else, so re-tuning calibration is a config edit.
const calibrationSchema = z.object({
  minItems: gradedValue(z.number().int().positive()),
  maxItems: gradedValue(z.number().int().positive()),
  timeBudgetMin: gradedValue(z.number().positive()),
  // Default ladder start when the user has no platform rating (else the caller passes
  // the platform puzzle/rapid rating — Seam 2 startRating rule).
  startRating: gradedValue(z.number()),
  // The success rate the adaptive ladder servos toward (~75–85%, Seam 5 / wilson2019).
  targetSuccessRate: gradedValue(z.number().min(0).max(1)),
  // Transformed-staircase steps: harder by `stepUp` after a solve, easier by `stepDown`
  // after a miss. The ratio sets the convergence success rate (stepDown/(up+down)).
  stepUp: gradedValue(z.number().positive()),
  stepDown: gradedValue(z.number().positive()),
  // Calibration rating span (clamps the ladder). Best-guess methodology range.
  ratingFloor: gradedValue(z.number()),
  ratingCeil: gradedValue(z.number()),
  // Estimator knobs: success-vs-target → rating offset, and base SE shrunk by √n.
  abilitySpread: gradedValue(z.number().positive()),
  uncertaintyBase: gradedValue(z.number().positive()),
  // Stop early once the estimate's uncertainty drops below this (and minItems met).
  stopUncertainty: gradedValue(z.number().positive()),
});

// A behavioural calibration track — one adaptive ladder per skill dimension we probe
// (tactics, calculation, endgames…). Structural data (ids/label/theme), like a band id:
// WHICH dimensions get a behavioural probe is methodology, but the values are identifiers,
// not graded numbers. `dimension` must resolve in `dimensions`; `theme` is the external
// puzzle-pointer (a Lichess theme tag). The shared ladder PARAMETERS live in `calibration`.
const calibrationTrackSchema = z.object({
  id: z.string().min(1),
  dimension: z.string().min(1),
  label: z.string().min(1),
  theme: z.string().min(1),
});

const assessmentSchema = z.object({
  // Dunning-Kruger: self-report is INVALID for skill diagnosis, VALID for
  // constraints/goals (heck2025, G8). These two flags encode exactly that split.
  selfReportForSkill: gradedValue(z.boolean()),
  selfReportForConstraints: gradedValue(z.boolean()),
  instantEvalGames: gradedValue(z.number().int().positive()),
  calibration: calibrationSchema,
  // The dimensions probed behaviourally, in order (each a reused ladder run). The first
  // track is the primary tactical estimate that seeds the band (Seam 2 startRating rule).
  tracks: z.array(calibrationTrackSchema).min(1),
});

// Seam 3 — game-feature → weakness interpretation (WEAKNESS_DIAGNOSIS §1). The analysis
// module emits RAW features (lib/raw-features); this seam turns them into graded
// WeaknessSignals with a confidence + sample size. The stub implements the single
// highest-ROI signal — blunder rate (S3) — and gates it on sample size (the honesty
// engine: below the gate it emits nothing rather than a fabricated diagnosis). Other
// signals (phase localisation, conversion, time/VOC) are deliberately deferred
// (METHODOLOGY Seam 3 STUB); each emitted signal's evidence grade is sourced from its
// `rationaleKey` entry (single source of the grade), never duplicated here.
const confidenceGateSchema = z.object({
  // Trailing game counts at which a signal's confidence steps up; below `low` the signal
  // is `insufficient` and is suppressed (binomial-power gate, METHODOLOGY Seam 3 (d)).
  low: gradedValue(z.number().int().nonnegative()),
  medium: gradedValue(z.number().int().nonnegative()),
  high: gradedValue(z.number().int().nonnegative()),
});

const interpretationSchema = z.object({
  thresholds: z.object({
    // A move's centipawn loss at/above this is a "blunder" (≥150cp, WEAKNESS_DIAGNOSIS).
    blunderCpLoss: gradedValue(z.number().positive()),
    // Positions already decided (|eval| above this) are excluded — blundering a lost
    // game is not a signal (METHODOLOGY Seam 3 `excludeDecidedAbove`).
    excludeDecidedAboveCp: gradedValue(z.number().positive()),
    // A move's win-probability DROP at/above this is a blunder — the mate-safe, saturating
    // companion to blunderCpLoss (a missed mate that stays winning is a ~0 drop, not a
    // blunder). Preferred over cpLoss when the raw feature carries win-prob; optional so
    // configs predating it still validate (the provider falls back to cpLoss).
    blunderWinProbDrop: gradedValue(z.number().min(0).max(1)).optional(),
  }),
  blunderRate: z.object({
    // Which dimension a high blunder rate flags (resolves in `dimensions`).
    dimension: z.string().min(1),
    // Expected blunder rate per band (fraction of moves). `contested` across reports —
    // carry conservative values; recalibrate from the app's own corpus (METHODOLOGY §4).
    baselineByBand: z.record(gradedValue(z.number().min(0).max(1))),
    // Flag a weakness when the user's rate exceeds baseline × this (1.2×, Seam 3 (c)).
    weaknessMultiplier: gradedValue(z.number().positive()),
    // The rationale entry whose grade/citation/copy this signal carries (resolves in
    // `rationale`); keeps the evidence grade in one place (Seam 8).
    rationaleKey: z.string().min(1),
  }),
  confidenceGates: z.object({
    blunderRate: confidenceGateSchema,
  }),
});

// Seam 4 — weakness/level → resource + params (WHAT_RAISES_RATING). A data-driven catalog
// of external-only activities with a per-band ROI prior, plus rules that elevate an
// activity in response to a weakness signal. The causal-evidence grade travels on each
// activity's `rationaleKey` entry (Seam 8), so most activities are honestly Grade C.
const activityDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  // The persisted ProgramItem.activityType (e.g. "puzzle_theme", "play_game").
  activityType: z.string().min(1),
  // Dimensions this activity trains (resolve in `dimensions`).
  dimensions: z.array(z.string().min(1)).min(1),
  // Default external resource pointer: a Lichess theme tag, or null for non-puzzle
  // activities. Structural reference data (which external page), NOT a graded value —
  // WHICH theme fixes WHICH weakness is encoded as the rule mapping below + the grade.
  resourceTheme: z.string().min(1).nullable(),
  // Estimated minutes the activity costs — the only input the Engine's time-budget
  // packing reads, so it lives in config (no "puzzles take 10 min" constant in engine/).
  estMinutes: gradedValue(z.number().positive()),
  // Per-band ROI prior (★★★→3 … ★→1; 0 = not recommended). The daily-mix weight.
  priorityByBand: z.record(gradedValue(z.number().min(0))),
  // Seam-5 difficulty track for puzzle activities; null for non-puzzle activities.
  track: z.enum(["pattern", "calculation"]).nullable(),
  // Time controls this activity is specific to (structural ref — like a theme). null/absent =
  // format-agnostic (most puzzles). Used by the Seam-7 format-fit penalty; never a graded number.
  formats: z.array(z.string().min(1)).nullable().optional(),
  delivery: gradedValue(z.enum(["internal", "external"])),
  rationaleKey: z.string().min(1),
});

const weaknessResourceRuleSchema = z.object({
  // Responds to weakness signals on this dimension (resolves in `dimensions`).
  dimension: z.string().min(1),
  // The activity to elevate/instantiate (resolves in `activities`).
  activityId: z.string().min(1),
  // Theme override for the elevated activity (structural ref), or null to keep default.
  theme: z.string().min(1).nullable(),
  rationaleKey: z.string().min(1),
});

// Seam 5 — difficulty / calibration targets (PRACTICE_DESIGN). Dual-track, servo-
// controlled: success rate is the control variable, the Elo offset is the actuator. The
// offsets ship as `contested` seeds; the servo (engine/math) nudges them toward the
// measured success target.
const difficultyTrackSchema = z.object({
  successTarget: gradedValue(z.number().min(0).max(1)),
  // Per-band seed offset added to the user's rating (negative = easier). Seeds only —
  // reports disagree (incl. −50), so flagged `contested`; the servo owns the rest.
  offsetSeedByBand: z.record(gradedValue(z.number())),
});

const difficultySchema = z.object({
  patternTrack: difficultyTrackSchema,
  calculationTrack: difficultyTrackSchema,
  // Servo gain: maps a success-rate error (measured − target) to a rating-offset nudge.
  controllerSuccessToRating: gradedValue(z.number().positive()),
  // Bands that get the motivational success-target override (structural list).
  beginnerBands: z.array(z.string().min(1)),
  // Raised success target for the fragile early phase (a motivation decision, Grade C).
  beginnerSuccessTarget: gradedValue(z.number().min(0).max(1)),
  // Per-band practice structure (blocked → interleaved as load tolerance rises).
  structureByBand: z.record(
    gradedValue(z.enum(["blocked", "clustered", "interleaved"])),
  ),
  // Block a new motif until accuracy clears this, then interleave it (best-guess).
  motifMasteryThreshold: gradedValue(z.number().min(0).max(1)),
  // Bands that always get a worked example before active testing (structural list).
  workedExampleBands: z.array(z.string().min(1)),
  // …or any item whose element-interactivity (complexity) clears this (van Gog 2015).
  workedExampleComplexityThreshold: gradedValue(z.number()),
  // Clamp for any servo-produced puzzle-rating target (realistic puzzle-DB span).
  ratingFloor: gradedValue(z.number()),
  ratingCeil: gradedValue(z.number()),
});

// Seam 7 — periodisation / prioritisation (TRAINING_PROGRAMMING). The daily program is an
// ordered set maximising a weighted score over candidate activities. Every number a
// best-guess (the literature has no chess dose-response curve, METHODOLOGY §4 gap #2).
const prioritizationSchema = z.object({
  weights: z.object({
    weaknessSeverity: gradedValue(z.number().min(0)),
    activityRoiPrior: gradedValue(z.number().min(0)),
    dueReviews: gradedValue(z.number().min(0)),
    varietyRecency: gradedValue(z.number().min(0)),
  }),
  // Personalisation levers (Seam 7): how the user's stated PREFERENCES (formats they play,
  // resources they own, depth-vs-breadth) reshape the daily mix. All best-guess magnitudes
  // (no dose-response literature, METHODOLOGY §4 gap #2) — the mechanism is wired, the
  // numbers carry their honest grade.
  preferences: z.object({
    // Subtracted from an activity's score when it declares formats and none overlap the
    // formats the user actually plays (a format-specific drill for a format they never play).
    formatMismatchPenalty: gradedValue(z.number().min(0)),
    // Added when an activity's resource is one the user already owns (prefer what they can use).
    ownedResourceBonus: gradedValue(z.number().min(0)),
    // "Go deep": multiply the weakness term by (1 + this) to concentrate on the biggest leak.
    depthWeaknessBonus: gradedValue(z.number().min(0)),
    // "Go broad": multiply the ROI term by (1 + this) to spread across high-value activities.
    breadthRoiBonus: gradedValue(z.number().min(0)),
  }),
  volume: z.object({
    // A CAP (not a fixed count): the session is sized to the user's hard time budget, and
    // puzzle count = min(this, time that fits). Never volume-chasing (S7).
    dailyPuzzleDose: gradedValue(z.number().int().positive()),
    // Max time per puzzle by track — the per-unit cost the hard-time-limit packer divides
    // the budget by. Type-aware: pattern recognition is fast, calculation needs longer.
    // Optional so configs predating it still validate (the packer falls back to estMinutes).
    secondsPerPuzzleByTrack: z
      .record(gradedValue(z.number().positive()))
      .optional(),
    // Expected minutes per game by format — used to cap how many games fit the budget
    // ("a logical number for the time control you play"). Optional (fallback: estMinutes).
    minutesPerGameByFormat: z
      .record(gradedValue(z.number().positive()))
      .optional(),
    // Upper bound on games scheduled in one session, so a fast format can't fill it.
    maxGamesPerSession: gradedValue(z.number().int().positive()).optional(),
  }),
});

// Seam 6 — spacing / scheduling (SPACED_REPETITION). FSRS v6: the Engine owns the generic
// `fsrsStep` math (engine/math/fsrs.ts); this seam supplies its parameters and the
// outcome→grade mapping. `scheduler` is a structural selector (which algorithm), like a
// dimension id — not a graded number. The weight vector is ONE graded leaf (a single
// trained artifact with one provenance), semi-evidenced (Anki defaults, not chess-validated).
const schedulingSchema = z.object({
  scheduler: z.string().min(1),
  // Target recall probability that sets review intervals (≈0.90; Ye et al. 2022).
  desiredRetention: gradedValue(z.number().min(0).max(1)),
  // Hard cap on any scheduled interval (days) — keeps the queue sane.
  maximumIntervalDays: gradedValue(z.number().int().positive()),
  // FSRS-6 weight vector: 21 entries (w0..w20). Graded as a unit.
  fsrsWeights: gradedValue(z.array(z.number()).length(21)),
  // Outcome→FSRS-grade solve-time thresholds, relative to the band median (STUB until the
  // app has its own timing data): fast (< median×fast) → Easy, slow (> median×slow) → Hard.
  solveTimeGrade: z.object({
    fastFactor: gradedValue(z.number().positive()),
    slowFactor: gradedValue(z.number().positive()),
  }),
  // The within-session wait before a just-failed puzzle is retested without its hint (the
  // §7.5 redo flow's delayed intra-session retest — a massed immediate retest only checks
  // working memory; a short spacing gap turns it into durable encoding). Best-guess value
  // (the exact gap is unstudied); optional so configs predating it still validate (the
  // solving surface falls back to a safe default).
  intraSessionRetestDelaySec: gradedValue(
    z.number().int().positive(),
  ).optional(),
});

// Measurement & expectations (cross-cutting; EXPECTATIONS.md). A rating is a distribution,
// not a number — progress/plateau are signal-vs-noise on the Glicko-2 CI. M7 ships the
// CI + baseline + plateau-window parameters the adaptation loop reads (detectPlateau /
// isProgressReal / isStableBaseline); the per-band expectation table + FIDE rule (surfaced
// in the dashboard) land with M8.
const measurementSchema = z.object({
  // CI multiplier (≈1.96 for 95%; Glickman 2012).
  ciMultiplier: gradedValue(z.number().positive()),
  // RD at/below which a rating is a "stable enough" baseline (best-guess value).
  rdBaselineMax: gradedValue(z.number().positive()),
  // Active-day window over which a non-new CI high is read as a plateau (best-guess; the
  // CI-crossing rule itself is evidenced).
  plateauWindowDays: gradedValue(z.number().int().positive()),
  // Expectations copy per band (surfaced on dashboards).
  expectationsByBand: z.record(gradedValue(z.string().min(1))),
});

// Seam 8 — rationale & evidence copy (USER_FACING). A versioned copy table keyed by
// trigger. Each entry IS the graded leaf: `value` is the microcopy, with its grade/tier/
// citation alongside (so isGradedValue picks up its citationKey). `soften` MUST be true
// whenever the grade is C/D, so weak-evidence copy can never render as fact (the Seam-8
// honesty rule; enforced in superRefine + the L3 guard, §13.4).
const rationaleEntrySchema = z.object({
  key: z.string().min(1),
  whenShown: z.string().min(1).optional(),
  value: z.string().min(1),
  grade: gradeSchema,
  tier: tierSchema,
  citationKey: z.string().min(1),
  flag: gradedFlagSchema.optional(),
  soften: z.boolean(),
});

// Seam 9 — engagement mechanics + ethical guardrails (MOTIVATION). The Engine owns the
// event plumbing; this seam supplies the allow/forbid lists, thresholds, and copy. The
// FORBID LIST IS STRUCTURAL, not a runtime check: the reward-event taxonomy is a fixed enum
// (there is no "global_leaderboard" or "tangible_reward" member), the streak is capped (never
// infinite — anti-loss-aversion), and `globalLeaderboards` must be false (enforced in
// superRefine). Each event rule maps a state-change trigger → an allowed event type + a
// Seam-8 `copyKey` (its grade/soften travel with the copy, L3). Mechanisms are well-evidenced
// (Grade A/B); the exact numbers are best-guess (METHODOLOGY Seam 9 STUB).
export const REWARD_EVENT_TYPES = [
  "streak_tick",
  "competence_milestone",
  "consistency_grid",
  "recovery_prompt",
] as const;

export const ENGAGEMENT_TRIGGERS = [
  "activity_completed",
  "streak_advanced",
  "milestone_reached",
  "day_missed",
] as const;

const engagementEventRuleSchema = z.object({
  // The state-change trigger this rule fires on (structural selector, like a band id).
  trigger: z.enum(ENGAGEMENT_TRIGGERS),
  // The reward-event type to emit — only the allowed taxonomy (forbidden mechanics are not
  // members of the enum, so they are unrepresentable, not merely discouraged).
  type: z.enum(REWARD_EVENT_TYPES),
  // The Seam-8 rationale entry carrying the user-facing copy + its grade (resolves in
  // `rationale`; checked in superRefine) — engagement copy is graded like everything else.
  copyKey: z.string().min(1),
});

const engagementSchema = z.object({
  // (a) SDT bounded-choice autonomy: a few science-backed paths/day; free skips, no penalty.
  dailyChoiceCount: gradedValue(z.number().int().positive()),
  freeSkipsPerWeek: gradedValue(z.number().int().nonnegative()),
  // (c) forgiving habit design: a CAPPED streak (never infinite) cycling over this many days,
  // an asymptotic consistency window, and the habit-formation expectation we communicate.
  streakCapDays: gradedValue(z.number().int().positive()),
  consistencyWindowDays: gradedValue(z.number().int().positive()),
  habitExpectationDays: gradedValue(z.number().int().positive()),
  // Competence-milestone thresholds (badges only for genuine work) — one graded leaf vector.
  competenceMilestones: gradedValue(
    z.array(z.number().int().positive()).min(1),
  ),
  // (d) guardrails: peer comparison opt-in (off in the stub); global leaderboards are a dark
  // pattern and must be FALSE; reminders capped per day (anti-nag); tilt cooldown is a
  // thin-evidence stub (forgiving default only).
  peerComparison: gradedValue(z.boolean()),
  globalLeaderboards: gradedValue(z.boolean()),
  reminderCadenceCapPerDay: gradedValue(z.number().int().nonnegative()),
  tiltCooldownLossStreak: gradedValue(z.number().int().positive()),
  // The state-change → reward-event policy table (the which/when/copy the engine fires).
  events: z.array(engagementEventRuleSchema).min(1),
});

// §5 — the evidence ledger the UI cites. Mirrors the METHODOLOGY §5 columns.
const anchorSourceSchema = z.object({
  key: z.string().min(1),
  source: z.string().min(1),
  anchors: z.string().min(1), // what this source anchors
  grade: z.enum(["A", "B", "C", "D"]),
});

const tiltTriggerConfigSchema = z.object({
  kind: z.enum([
    "losses_in_time",
    "losses_in_row",
    "performance_decline",
    "none",
  ]),
  count: z.number().int().optional(),
  timeWindowMs: z.number().int().optional(),
  declineThreshold: z.number().optional(),
});

export type TiltTriggerConfig = z.infer<typeof tiltTriggerConfigSchema>;

const emotionalCalibrationBandSchema = z.object({
  reflectionPrompt: gradedValue(z.string()),
  analysisUnlockDelayMs: gradedValue(z.number()),
  tiltTrigger: gradedValue(tiltTriggerConfigSchema),
});

const activeReproductionBandSchema = z.object({
  taskDescription: gradedValue(z.string()),
  maxCriticalMoments: gradedValue(z.number()),
  timeLimitPerMomentMs: gradedValue(z.number().nullable()),
  // Accept an alternative move whose own cpLoss is at most this fraction of the
  // original blunder's cpLoss (combined with the RPL visible-error threshold in
  // provider.ts) — there is no direct study on the tolerance fraction itself, so this
  // is graded like the other per-band active-reproduction params (stub/best-guess).
  guessAcceptanceCpLossRatio: gradedValue(z.number().min(0).max(1)),
  // A move is a "critical moment" worth reproducing only when its win-probability drop
  // clears this (rating-dependent: lower bands need a bigger practical swing). Mate-safe,
  // so a missed mate that stays winning is never flagged. Optional; the provider falls
  // back to the RPL cp threshold when absent.
  criticalMomentMinWinProbDrop: gradedValue(
    z.number().min(0).max(1),
  ).optional(),
  // The player's alternative grades "correct" when its OWN win-probability drop is at most
  // this — lenient at low bands (just find a non-disastrous move), tighter higher up.
  maxAcceptableWinProbDrop: gradedValue(z.number().min(0).max(1)).optional(),
  // Whether to still surface a "winning → still winning" missed conversion (e.g. a missed
  // mate). True only at bands that train conversion technique; false lower down.
  surfaceMissedConversion: gradedValue(z.boolean()).optional(),
});

const rplFilteringBandSchema = z.object({
  visibleErrorThresholdCp: gradedValue(z.number()),
  entropyFilter: gradedValue(z.string()),
  learningFocus: gradedValue(z.string()),
});

const gameSelectionBandSchema = z.object({
  winRatio: gradedValue(z.number().min(0).max(1)),
  lossRatio: gradedValue(z.number().min(0).max(1)),
  focusDescription: gradedValue(z.string()),
});

const gameAnalysisSchema = z.object({
  // The eval magnitude (mover POV, cp) above which a position is "decided/winning". The
  // decisive-zone guard uses it: a move that was winning before AND still winning after did
  // not change the practical result, so it isn't a mistake worth reproducing (unless the
  // band trains conversion). Optional; the guard is skipped when absent.
  winningZoneCp: gradedValue(z.number().positive()).optional(),
  emotionalCalibration: z.object({
    enabled: gradedValue(z.boolean()),
    perBand: z.record(emotionalCalibrationBandSchema),
  }),
  activeReproduction: z.object({
    // How many failed attempts the player makes before they may reveal the engine's
    // moves (the desirable-difficulty dosage — they retrieve first, the engine only
    // bails them out after a genuine effort). A best-guess count, not a studied value.
    revealAfterMisses: gradedValue(z.number().int().min(1)),
    perBand: z.record(activeReproductionBandSchema),
  }),
  rplFiltering: z.object({
    enabled: gradedValue(z.boolean()),
    perBand: z.record(rplFilteringBandSchema),
  }),
  srsIntegration: z.object({
    enabled: gradedValue(z.boolean()),
    onFail: gradedValue(z.enum(["lapse"])),
    onCorrectCritical: gradedValue(z.number().int().positive()),
  }),
  gameSelection: z.object({
    enabled: gradedValue(z.boolean()),
    perBand: z.record(gameSelectionBandSchema),
  }),
  engineDelayRequired: gradedValue(z.boolean()),
  tiltPreventionEnabled: gradedValue(z.boolean()),
  physicalBoardRecommendation: gradedValue(z.string()),
});

// Seam 4 §4.4(c) — the in-app board's interface-restriction doctrine (METHODOLOGY §4.4(c),
// the "anti-crutch" rule). The Engine's board exposes science-free affordance toggles; this
// config supplies their graded values so L1 holds (no affordance policy in the board itself).
// Eval bar + legal-move dots are crutches absent from a real board, so they are off across
// ALL bands; right-click arrows + piece-hover highlight are gated by the user's play medium
// (`targetFocus`) — an OTB-bound trainer drills without them. Band refinement is deferred to
// the research config; the stub keys arrows/hover by focus only.
export const TARGET_FOCUSES = ["online", "otb", "hybrid"] as const;
export const targetFocusSchema = z.enum(TARGET_FOCUSES);

const byFocusSchema = z.object({
  online: gradedValue(z.boolean()),
  otb: gradedValue(z.boolean()),
  hybrid: gradedValue(z.boolean()),
});

const boardSchema = z.object({
  showEvalBar: gradedValue(z.boolean()),
  showLegalMoveDots: gradedValue(z.boolean()),
  allowArrowsByFocus: byFocusSchema,
  allowHoverByFocus: byFocusSchema,
  // Seam-8 rationale entry (resolves in `rationale`) explaining why a crutch is hidden.
  restrictionRationaleKey: z.string().min(1),
});

// Seam 4 — the in-app endgame curriculum (METHODOLOGY Seam 4 endgame ladder, M13). A
// per-band set of curated endgame positions the user trains in-app against the chess engine
// (the internalised former `endgame_trainer`). The POSITION data (id/label/fen/category) is
// structural reference data — like an activity's `resourceTheme`, which external/open thing
// to render — while the `objective` (the technique outcome the drill requires: win, or hold
// the draw) is the graded methodology decision the endgame scorer reads. WHICH endgames
// matter at WHICH band is coaching consensus (Grade C); the stub ships conservative,
// decisive positions, swapped for the research curriculum later with no Engine change.
const endgamePositionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  fen: z.string().min(1),
  // A structural family tag (e.g. "basic_mate", "kp", "rook") for grouping/UI only.
  category: z.string().min(1),
  // The technique target the scorer judges the played-out result against (Seam 4, graded).
  objective: gradedValue(z.enum(["win", "draw"])),
});

const endgameCurriculumSchema = z.object({
  // Curated positions per band (full band coverage enforced below). May be empty for a
  // band with no curated positions yet; the endgame_drill activity simply seeds none.
  positionsByBand: z.record(z.array(endgamePositionSchema)),
});

// Seam 4 §4.2–4.3 — the book-study protocol + per-band book catalog (METHODOLOGY §4.2/§4.3,
// research/BEST_BOOKS.md, M14). Books/courses are DELIBERATELY EXTERNAL — recommended +
// logged, never hosted (VISION §6). The book DATA (id/title/author/category) is structural
// reference data, like an activity's `resourceTheme` (which external thing to name); the
// GRADED methodology calls are the study-protocol parameters (active recall, the 85%
// difficulty rule, the Woodpecker cycle), the per-band BLOCKED categories (the cognitive-load
// rule — low-band strategy/opening books overload a beginner), and each recommendation's
// graded "why this". Causal grade is C (coaching consensus); the mechanisms it leans on
// (chunking, retrieval, spacing) are A — so the recommendation copy is softened, the
// protocol params carry their real grade.
export const BOOK_CATEGORIES = [
  "tactics",
  "strategy",
  "endgame",
  "opening",
  "calculation",
  "games",
] as const;
export const bookCategorySchema = z.enum(BOOK_CATEGORIES);

const bookRecSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  // A structural family tag (which kind of book) - drives the cognitive-load block rule.
  category: bookCategorySchema,
  studyUnit: z.enum(["exercises", "games"]),
  // The graded "why this book at this band" focus copy (Grade C coaching consensus); carries
  // the citation so a recommendation can never render as Grade-A fact.
  recommendation: gradedValue(z.string().min(1)),
});

const activityBookSubstitutionSchema = z.object({
  // The activity whose slot can be satisfied by an owned external book instead.
  activityId: z.string().min(1),
  // Structural fallback: a band-appropriate owned book in one of these categories can replace
  // the activity if no preferred book id is owned.
  categories: z.array(bookCategorySchema).min(1),
  // Graded policy: which books are the preferred replacements for this activity by band.
  preferredBookIdsByBand: z.record(gradedValue(z.array(z.string().min(1)))),
});

const bookStudySchema = z.object({
  // Active recall: cover the answer, set up the position, calculate first (anti fluency-trap).
  activeRecall: z.object({
    enabled: gradedValue(z.boolean()),
    // Minutes to calculate a diagram before checking the solution (best-guess length).
    timeLimitMin: gradedValue(z.number().positive()),
  }),
  // The 85% difficulty-calibration rule (Wilson 2019): a book matches the reader when the
  // self-reported exercise-success rate sits in [lowerBound, upperBound]; outside ⇒ adjust.
  difficultyCalibration: z.object({
    targetSuccessRate: gradedValue(z.number().min(0).max(1)),
    lowerBound: gradedValue(z.number().min(0).max(1)),
    upperBound: gradedValue(z.number().min(0).max(1)),
  }),
  // Woodpecker cycles: re-solve the same set with a shrinking interval to automate patterns
  // (spaced, never massed — the reconciliation in METHODOLOGY §1.3).
  woodpecker: z.object({
    minCycles: gradedValue(z.number().int().positive()),
    maxCycles: gradedValue(z.number().int().positive()),
    firstCycleDays: gradedValue(z.number().int().positive()),
    // Each cycle's interval = the previous × this (0.5 ⇒ halving). Best-guess decay.
    cycleDecay: gradedValue(z.number().min(0).max(1)),
  }),
  // When a user already owns a band-appropriate book, it can enter the timed daily mix even
  // though generic book-study starts with a conservative priority of 0. The value is graded:
  // "expert-picked owned book over generated drills" is plausible, not direct causal evidence.
  ownedBookDailyPriority: gradedValue(z.number().min(0)),
  // Structural taxonomy: which skill dimensions each book category can serve. The daily mix
  // uses this to bind an owned endgame book to endgame work, a tactics workbook to tactics,
  // etc., without hardcoding chess categories in app/server code.
  categoryDimensions: z.record(z.array(z.string().min(1)).min(1)),
  // Config-driven owned-book substitutions: an owned expert-picked book can satisfy a
  // generated drill/study activity in the same focus, rather than adding a decoupled card.
  activitySubstitutions: z.array(activityBookSubstitutionSchema),
  // The cognitive-load block rule (Sweller): categories that OVERLOAD a band are suppressed
  // (e.g. strategy/opening for beginners). One graded leaf per band (the list + its grade).
  blockedCategoriesByBand: z.record(gradedValue(z.array(bookCategorySchema))),
  // The per-band recommended catalog (full band coverage enforced below; may be empty).
  catalogByBand: z.record(z.array(bookRecSchema)),
  // Seam-8 rationale keys for the three protocol pieces (resolve in `rationale`).
  activeRecallRationaleKey: z.string().min(1),
  calibrationRationaleKey: z.string().min(1),
  woodpeckerRationaleKey: z.string().min(1),
});

// Seam 4 §4.4(a/b) — the 2D/3D visual-modality split + OTB tournament-simulation cadence
// (METHODOLOGY §4.4, research/2D_VS_3D.md, M14). Drives the modality/OTB recommendations,
// gated by the user's play medium (`targetFocus`). The split ratios are best-guess (B/C);
// the OTB-stress finding motivating simulation is strong (A, Künn 2021) but the per-band
// cadence is coaching opinion (best-guess).
const modalitySplitSchema = z.object({
  digitalPct: gradedValue(z.number().min(0).max(100)),
  physicalPct: gradedValue(z.number().min(0).max(100)),
});

const modalitySchema = z.object({
  // The recommended 2D-screen / 3D-physical time split per band (full band coverage below).
  splitByBand: z.record(modalitySplitSchema),
  // Per-band OTB tournament-simulation cadence copy (e.g. "1× per month (15+10), Zen mode").
  otbSimulationByBand: z.record(gradedValue(z.string().min(1))),
  // Advice surfaced when the user is OTB/hybrid-bound (set up a physical board).
  physicalBoardAdvice: gradedValue(z.string().min(1)),
  // Seam-8 rationale keys (resolve in `rationale`).
  modalityRationaleKey: z.string().min(1),
  otbRationaleKey: z.string().min(1),
});

/** Recursively collect every citationKey appearing on a GradedValue in the config. */
function collectCitationKeys(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectCitationKeys(item, into);
    return;
  }
  if (node && typeof node === "object") {
    if (isGradedValue(node)) into.add(node.citationKey);
    for (const v of Object.values(node)) collectCitationKeys(v, into);
  }
}

export const methodologyConfigSchema = z
  .object({
    version: versionSchema,
    bands: z.array(bandSchema).min(1),
    dimensions: z.array(dimensionSchema).min(1),
    assessment: assessmentSchema,
    interpretation: interpretationSchema,
    activities: z.array(activityDefinitionSchema).min(1),
    weaknessResourceRules: z.array(weaknessResourceRuleSchema),
    difficulty: difficultySchema,
    scheduling: schedulingSchema,
    prioritization: prioritizationSchema,
    engagement: engagementSchema,
    measurement: measurementSchema,
    rationale: z.array(rationaleEntrySchema).min(1),
    evidenceLedger: z.array(anchorSourceSchema).min(1),
    gameAnalysis: gameAnalysisSchema,
    board: boardSchema,
    endgameCurriculum: endgameCurriculumSchema,
    bookStudy: bookStudySchema,
    modality: modalitySchema,
  })
  .superRefine((cfg, ctx) => {
    // L3 — every citationKey must resolve to a ledger anchor (fail-closed, §2.6).
    const ledger = new Set(cfg.evidenceLedger.map((a) => a.key));
    const usedCitations = new Set<string>();
    for (const section of [
      cfg.bands,
      cfg.assessment,
      cfg.interpretation,
      cfg.activities,
      cfg.difficulty,
      cfg.scheduling,
      cfg.prioritization,
      cfg.engagement,
      cfg.measurement,
      cfg.rationale,
      cfg.gameAnalysis,
      cfg.board,
      cfg.endgameCurriculum,
      cfg.bookStudy,
      cfg.modality,
    ]) {
      collectCitationKeys(section, usedCitations);
    }
    for (const key of usedCitations) {
      if (!ledger.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `citationKey "${key}" does not resolve in evidenceLedger`,
          path: ["evidenceLedger"],
        });
      }
    }

    // Coherent stub = full band coverage: every per-band record covers every band id.
    const bandIds = cfg.bands.map((b) => b.id);
    const requireBands = (
      rec: Record<string, unknown>,
      path: (string | number)[],
    ): void => {
      for (const id of bandIds) {
        if (!(id in rec)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `per-band record is missing band "${id}"`,
            path,
          });
        }
      }
    };
    requireBands(cfg.interpretation.blunderRate.baselineByBand, [
      "interpretation",
      "blunderRate",
      "baselineByBand",
    ]);
    requireBands(cfg.difficulty.patternTrack.offsetSeedByBand, [
      "difficulty",
      "patternTrack",
      "offsetSeedByBand",
    ]);
    requireBands(cfg.difficulty.calculationTrack.offsetSeedByBand, [
      "difficulty",
      "calculationTrack",
      "offsetSeedByBand",
    ]);
    requireBands(cfg.difficulty.structureByBand, [
      "difficulty",
      "structureByBand",
    ]);
    requireBands(cfg.measurement.expectationsByBand, [
      "measurement",
      "expectationsByBand",
    ]);
    cfg.activities.forEach((a, i) =>
      requireBands(a.priorityByBand, ["activities", i, "priorityByBand"]),
    );
    requireBands(cfg.gameAnalysis.emotionalCalibration.perBand, [
      "gameAnalysis",
      "emotionalCalibration",
      "perBand",
    ]);
    requireBands(cfg.gameAnalysis.activeReproduction.perBand, [
      "gameAnalysis",
      "activeReproduction",
      "perBand",
    ]);
    requireBands(cfg.gameAnalysis.rplFiltering.perBand, [
      "gameAnalysis",
      "rplFiltering",
      "perBand",
    ]);
    requireBands(cfg.gameAnalysis.gameSelection.perBand, [
      "gameAnalysis",
      "gameSelection",
      "perBand",
    ]);
    requireBands(cfg.endgameCurriculum.positionsByBand, [
      "endgameCurriculum",
      "positionsByBand",
    ]);
    // M14 — book catalog + the cognitive-load block list + the modality split/cadence all
    // cover every band (a missing band would silently drop recommendations there).
    requireBands(cfg.bookStudy.blockedCategoriesByBand, [
      "bookStudy",
      "blockedCategoriesByBand",
    ]);
    requireBands(cfg.bookStudy.catalogByBand, ["bookStudy", "catalogByBand"]);
    cfg.bookStudy.activitySubstitutions.forEach((sub, i) => {
      requireBands(sub.preferredBookIdsByBand, [
        "bookStudy",
        "activitySubstitutions",
        i,
        "preferredBookIdsByBand",
      ]);
    });
    requireBands(cfg.modality.splitByBand, ["modality", "splitByBand"]);
    requireBands(cfg.modality.otbSimulationByBand, [
      "modality",
      "otbSimulationByBand",
    ]);

    // Referential integrity: dimension/activity/rationale ids must all resolve, so a
    // signal or program item can never point at a non-existent leaf.
    const dimIds = new Set(cfg.dimensions.map((d) => d.id));
    const actIds = new Set(cfg.activities.map((a) => a.id));
    const ratKeys = new Set(cfg.rationale.map((r) => r.key));
    const requireDim = (id: string, path: (string | number)[]): void => {
      if (!dimIds.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `dimension "${id}" does not resolve in dimensions`,
          path,
        });
      }
    };
    const requireRat = (key: string, path: (string | number)[]): void => {
      if (!ratKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rationaleKey "${key}" does not resolve in rationale`,
          path,
        });
      }
    };
    cfg.assessment.tracks.forEach((t, i) =>
      requireDim(t.dimension, ["assessment", "tracks", i, "dimension"]),
    );
    requireDim(cfg.interpretation.blunderRate.dimension, [
      "interpretation",
      "blunderRate",
      "dimension",
    ]);
    requireRat(cfg.interpretation.blunderRate.rationaleKey, [
      "interpretation",
      "blunderRate",
      "rationaleKey",
    ]);
    cfg.activities.forEach((a, i) => {
      a.dimensions.forEach((d, j) =>
        requireDim(d, ["activities", i, "dimensions", j]),
      );
      requireRat(a.rationaleKey, ["activities", i, "rationaleKey"]);
    });
    Object.entries(cfg.bookStudy.categoryDimensions).forEach(
      ([category, dimensions]) => {
        if (!BOOK_CATEGORIES.includes(category as BookCategory)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `book category "${category}" does not resolve in BOOK_CATEGORIES`,
            path: ["bookStudy", "categoryDimensions", category],
          });
        }
        dimensions.forEach((d, j) =>
          requireDim(d, ["bookStudy", "categoryDimensions", category, j]),
        );
      },
    );
    cfg.bookStudy.activitySubstitutions.forEach((sub, i) => {
      if (!actIds.has(sub.activityId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `activityId "${sub.activityId}" does not resolve in activities`,
          path: ["bookStudy", "activitySubstitutions", i, "activityId"],
        });
      }
      Object.entries(sub.preferredBookIdsByBand).forEach(([band, gv]) => {
        const catalogIds = new Set(
          (cfg.bookStudy.catalogByBand[band] ?? []).map((b) => b.id),
        );
        gv.value.forEach((bookId, j) => {
          if (!catalogIds.has(bookId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `book id "${bookId}" does not resolve in catalogByBand.${band}`,
              path: [
                "bookStudy",
                "activitySubstitutions",
                i,
                "preferredBookIdsByBand",
                band,
                "value",
                j,
              ],
            });
          }
        });
      });
    });
    cfg.weaknessResourceRules.forEach((rule, i) => {
      requireDim(rule.dimension, ["weaknessResourceRules", i, "dimension"]);
      requireRat(rule.rationaleKey, [
        "weaknessResourceRules",
        i,
        "rationaleKey",
      ]);
      if (!actIds.has(rule.activityId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `activityId "${rule.activityId}" does not resolve in activities`,
          path: ["weaknessResourceRules", i, "activityId"],
        });
      }
    });

    // Seam-8 honesty rule: C/D-grade copy must be softened (never rendered as fact).
    cfg.rationale.forEach((r, i) => {
      if ((r.grade === "C" || r.grade === "D") && !r.soften) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rationale "${r.key}" is grade ${r.grade} but soften is false (Seam-8 honesty rule)`,
          path: ["rationale", i, "soften"],
        });
      }
    });

    // Seam 4 §4.4(c) — the board's restriction rationale must resolve to a real entry, so
    // the "why is this hidden?" card always has graded copy to show.
    requireRat(cfg.board.restrictionRationaleKey, [
      "board",
      "restrictionRationaleKey",
    ]);

    // M14 §4.2/§4.4 — the book-study + modality rationale keys must resolve, so the "why"
    // card always has graded copy for active recall, the 85% rule, Woodpecker, and OTB prep.
    requireRat(cfg.bookStudy.activeRecallRationaleKey, [
      "bookStudy",
      "activeRecallRationaleKey",
    ]);
    requireRat(cfg.bookStudy.calibrationRationaleKey, [
      "bookStudy",
      "calibrationRationaleKey",
    ]);
    requireRat(cfg.bookStudy.woodpeckerRationaleKey, [
      "bookStudy",
      "woodpeckerRationaleKey",
    ]);
    requireRat(cfg.modality.modalityRationaleKey, [
      "modality",
      "modalityRationaleKey",
    ]);
    requireRat(cfg.modality.otbRationaleKey, ["modality", "otbRationaleKey"]);

    // Seam 9 — every engagement event copyKey must resolve to a rationale entry (so its
    // graded copy exists); the event TYPE is enum-bounded already (forbidden mechanics excluded).
    cfg.engagement.events.forEach((ev, i) => {
      requireRat(ev.copyKey, ["engagement", "events", i, "copyKey"]);
    });
    // The forbid list is enforced by CONFIG, not the engine: global leaderboards are a
    // dark pattern (downward social comparison; Hanus & Fox 2015) and must be off. (An
    // infinite streak is excluded structurally — the cap is a positive int, always finite.)
    if (cfg.engagement.globalLeaderboards.value !== false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "engagement.globalLeaderboards must be false (forbidden dark pattern, Seam 9)",
        path: ["engagement", "globalLeaderboards", "value"],
      });
    }
  });

export type MethodologyConfig = z.infer<typeof methodologyConfigSchema>;
export type AssessmentConfig = MethodologyConfig["assessment"];
export type CalibrationConfig = AssessmentConfig["calibration"];
export type CalibrationTrack = AssessmentConfig["tracks"][number];
export type BandDefinition = MethodologyConfig["bands"][number];
export type SkillDimension = MethodologyConfig["dimensions"][number];
export type InterpretationConfig = MethodologyConfig["interpretation"];
export type ActivityDefinition = MethodologyConfig["activities"][number];
export type BoardConfig = MethodologyConfig["board"];
export type EndgameCurriculumConfig = MethodologyConfig["endgameCurriculum"];
export type EndgamePosition =
  EndgameCurriculumConfig["positionsByBand"][string][number];
export type EndgameObjective = EndgamePosition["objective"]["value"];
export type BookStudyConfig = MethodologyConfig["bookStudy"];
export type BookRec = BookStudyConfig["catalogByBand"][string][number];
export type BookCategory = (typeof BOOK_CATEGORIES)[number];
export type ModalityConfig = MethodologyConfig["modality"];
export type TargetFocus = (typeof TARGET_FOCUSES)[number];
export type WeaknessResourceRule =
  MethodologyConfig["weaknessResourceRules"][number];
export type DifficultyConfig = MethodologyConfig["difficulty"];
export type SchedulingConfig = MethodologyConfig["scheduling"];
export type PrioritizationConfig = MethodologyConfig["prioritization"];
export type EngagementConfig = MethodologyConfig["engagement"];
export type EngagementEventRule = EngagementConfig["events"][number];
export type RewardEventType = (typeof REWARD_EVENT_TYPES)[number];
export type EngagementTrigger = (typeof ENGAGEMENT_TRIGGERS)[number];
export type MeasurementConfig = MethodologyConfig["measurement"];
export type RationaleEntry = MethodologyConfig["rationale"][number];
export type AnchorSource = MethodologyConfig["evidenceLedger"][number];
export type GameAnalysisConfig = MethodologyConfig["gameAnalysis"];
export type EmotionalCalibrationConfig =
  GameAnalysisConfig["emotionalCalibration"];
export type ActiveReproductionConfig = GameAnalysisConfig["activeReproduction"];
export type RplFilteringConfig = GameAnalysisConfig["rplFiltering"];
export type SrsIntegrationConfig = GameAnalysisConfig["srsIntegration"];
export type GameSelectionConfig = GameAnalysisConfig["gameSelection"];
