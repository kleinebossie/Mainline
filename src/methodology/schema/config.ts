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
// Forthcoming (added by their slices, never invented early — that would inject ungraded
// science): scheduling (6, M7), engagement (9, M9), measurement (M7/M8). Parsing is
// non-strict, so a future config may carry them before their schema lands.

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

const assessmentSchema = z.object({
  // Dunning-Kruger: self-report is INVALID for skill diagnosis, VALID for
  // constraints/goals (heck2025, G8). These two flags encode exactly that split.
  selfReportForSkill: gradedValue(z.boolean()),
  selfReportForConstraints: gradedValue(z.boolean()),
  instantEvalGames: gradedValue(z.number().int().positive()),
  calibration: calibrationSchema,
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
  volume: z.object({
    dailyPuzzleDose: gradedValue(z.number().int().positive()),
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

// §5 — the evidence ledger the UI cites. Mirrors the METHODOLOGY §5 columns.
const anchorSourceSchema = z.object({
  key: z.string().min(1),
  source: z.string().min(1),
  anchors: z.string().min(1), // what this source anchors
  grade: z.enum(["A", "B", "C", "D"]),
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
    measurement: measurementSchema,
    rationale: z.array(rationaleEntrySchema).min(1),
    evidenceLedger: z.array(anchorSourceSchema).min(1),
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
      cfg.measurement,
      cfg.rationale,
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
    cfg.activities.forEach((a, i) =>
      requireBands(a.priorityByBand, ["activities", i, "priorityByBand"]),
    );

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
  });

export type MethodologyConfig = z.infer<typeof methodologyConfigSchema>;
export type AssessmentConfig = MethodologyConfig["assessment"];
export type CalibrationConfig = AssessmentConfig["calibration"];
export type BandDefinition = MethodologyConfig["bands"][number];
export type SkillDimension = MethodologyConfig["dimensions"][number];
export type InterpretationConfig = MethodologyConfig["interpretation"];
export type ActivityDefinition = MethodologyConfig["activities"][number];
export type WeaknessResourceRule =
  MethodologyConfig["weaknessResourceRules"][number];
export type DifficultyConfig = MethodologyConfig["difficulty"];
export type SchedulingConfig = MethodologyConfig["scheduling"];
export type PrioritizationConfig = MethodologyConfig["prioritization"];
export type MeasurementConfig = MethodologyConfig["measurement"];
export type RationaleEntry = MethodologyConfig["rationale"][number];
export type AnchorSource = MethodologyConfig["evidenceLedger"][number];
