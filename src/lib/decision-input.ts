// ProgramDecisionInput boundary types (FEATURE_ROADMAP P4). The single typed snapshot the
// state assembler produces and persists on every generated program, so any "Today" can be
// deterministically re-derived from the inputs it ran on (L2 reproducibility). Shared by
// the server assembler (`@/server/decision-input`), the generation snapshot, and the JSON
// column typing — one validation truth (BUILD.md §3), like lib/constraints.ts.
//
// Boundary (L1 + roadmap §1 locked decisions): this is a SHAPSHOT of state, never a graded
// decision. No chess/learning constant lives here; the assembler only READS methodology and
// Engine state. Subjective feedback surfaces ONLY through `trainingPreferences` (P8), and
// can never write SkillState values (a roadmap-wide invariant, §9).
//
// Determinism: every field here is derivable from persisted, ordered, immutable rows
// (ActivityEvent, ScheduleState, SkillState, SkillStateSnapshot, ConstraintSet,
// TrainingPreferenceState) plus an injected Clock. Re-running the assembler at the same
// logical time reproduces the same snapshot.

import { z } from "zod";

import {
  constraintsInputSchema,
  goalSchema,
  ownedResourceSchema,
} from "@/lib/constraints";

/** One per-dimension skill estimate (mirrors `SkillStateValue` in `engine/adaptation.ts`,
 *  redefined here so `lib/` has no engine import — L1). The numbers are RAW competence
 *  proxies produced by the generic running-proportion estimator (engine/math), not graded
 *  chess constants. */
export const skillStateValueSchema = z
  .object({
    dimension: z.string().min(1).max(80),
    estimate: z.number().finite(),
    uncertainty: z.number().finite().nonnegative(),
    sampleSize: z.number().int().nonnegative(),
  })
  .strict();
export type SkillStateValue = z.infer<typeof skillStateValueSchema>;

/** One immutable point in the per-dimension skill history (mirrors the
 *  `SkillStateSnapshot` table in `prisma/schema.prisma`). */
export const skillStateSnapshotValueSchema = skillStateValueSchema
  .extend({
    methodologyVersion: z.string().min(1).max(80),
    runAt: z.number().int(), // epoch ms — the adaptation run's logical time
    capturedAt: z.number().int(), // epoch ms — when the row was persisted
  })
  .strict();
export type SkillStateSnapshotValue = z.infer<
  typeof skillStateSnapshotValueSchema
>;

/** A spaced-review item due at (or before) the assembler's `assembledAt`. Mirrors
 *  `DueItem` plus the persisted `due` timestamp so a historic snapshot can be replayed. */
export const decisionDueItemSchema = z
  .object({
    itemRef: z.string().min(1).max(120),
    itemType: z.string().min(1).max(120),
    due: z.number().int(), // epoch ms
  })
  .strict();
export type DecisionDueItem = z.infer<typeof decisionDueItemSchema>;

/** Rolling success rate per Seam-5 track (the servo input, M7). Plumbing only; the
 *  graded decision lives in `targetPuzzleRating` (Seam 5). */
export const recentSuccessByTrackSchema = z
  .object({
    pattern: z.number().finite().min(0).max(1).optional(),
    calculation: z.number().finite().min(0).max(1).optional(),
  })
  .strict();
export type RecentSuccessByTrack = z.infer<typeof recentSuccessByTrackSchema>;

/** Activity-type recency and adherence roll-ups derived from immutable ActivityEvents and
 *  ProgramItem status. Generic descriptive statistics — no graded chess decision. The agent
 *  fields are typed as numbers and capped conservatively so a corrupted column can't poison
 *  the snapshot. */
export const activityRecencySchema = z
  .object({
    /** Epoch ms of the most recent ActivityEvent, by type (absent when never). */
    lastEventAtByType: z.record(z.string(), z.number().int()).default({}),
    /** Counts over the trailing window (default 28 days, BUILD.md active-user definition). */
    completionsByType: z
      .record(z.string(), z.number().int().nonnegative())
      .default({}),
    skipsByType: z
      .record(z.string(), z.number().int().nonnegative())
      .default({}),
    /** Sum of self-reported / measured durations (minutes) per activity type. */
    durationMinutesByType: z
      .record(z.string(), z.number().nonnegative())
      .default({}),
    /** Trailing 28-day session count — a "session" is one or more events on a UTC day. */
    activeDays: z.number().int().nonnegative().default(0),
    /** Total events in the trailing window. */
    totalEvents: z.number().int().nonnegative().default(0),
  })
  .strict();
export type ActivityRecency = z.infer<typeof activityRecencySchema>;

/** Derived training-fit preferences ONLY — never a skill estimate (roadmap §1, P4/P8
 *  boundary). P4 ships the empty default; P8 populates it from `TrainingFeedback`. All
 *  values are descriptive and bounded; nothing here may push a recommendation past
 *  methodology-approved bounds (the bounded-alternative contract P5 enforces). */
export const trainingPreferencesSchema = z
  .object({
    /** 0..1 normalized enjoyment per activity type (absent = no signal). */
    enjoyment: z
      .record(z.string(), z.number().finite().min(0).max(1))
      .default({}),
    /** 0..1 normalized resource preference by resource label/id (absent = no signal). */
    resourceAffinity: z
      .record(z.string(), z.number().finite().min(0).max(1))
      .default({}),
    /** Recurring friction tags P8 distills from feedback (e.g. "too_long", "no_board"). */
    frictionTags: z.array(z.string().min(1).max(80)).max(50).default([]),
    /** Count of feedback rows behind this rollup (transparency). */
    evidenceCount: z.number().int().nonnegative().default(0),
    /** Methodology version this rollup was last derived under. */
    methodologyVersion: z.string().min(1).max(80).optional(),
  })
  .strict();
export type TrainingPreferences = z.infer<typeof trainingPreferencesSchema>;

/** The empty default — used when no TrainingPreferenceState row exists yet (P4 ships this
 *  empty; P8 is the first writer). */
export const EMPTY_TRAINING_PREFERENCES: TrainingPreferences = {
  enjoyment: {},
  resourceAffinity: {},
  frictionTags: [],
  evidenceCount: 0,
};

/** The persisted training-preference row shape (mirrors TrainingPreferenceState in
 *  prisma/schema.prisma). `userOverride` is null until a user pins/resets a preference
 *  (P8); `resetAt` is null until the first reset. */
export const trainingPreferenceStateSchema = z
  .object({
    preferences: trainingPreferencesSchema,
    userOverride: trainingPreferencesSchema.nullable(),
    resetAt: z.number().int().nullable(), // epoch ms, null when never reset
    updatedAt: z.number().int(), // epoch ms
  })
  .strict();
export type TrainingPreferenceStateSnapshot = z.infer<
  typeof trainingPreferenceStateSchema
>;

/** The single typed snapshot persisted as `Program.generationInput` (replacing the ad-hoc
 *  shape M6 wrote). Every field is derivable from persisted rows + the injected Clock, so
 *  the same snapshot + config reproduces the same program (L2). */
export const programDecisionInputSchema = z
  .object({
    /** Schema version — bumps only if the snapshot shape changes (additive, never breaking). */
    schemaVersion: z.literal(1),
    /** The methodology config the program was (will be) produced under. */
    methodologyVersion: z.string().min(1).max(80),
    /** The logical time the assembler ran — drives day-stamping and idempotency. */
    assembledAt: z.number().int(),
    /** The user this snapshot belongs to (no email/PII — owner id only, for tracing). */
    userId: z.string().min(1).max(80),
    /** Band the generator used, precomputed from `tacticalRating` (a prior; data overrides). */
    band: z.string().min(1).max(40),
    /** The user's tactical/puzzle rating — drives Seam-5 difficulty targets. */
    tacticalRating: z.number().finite(),
    /** Band used to select/recommend books (highest live rating); may equal `band`. */
    libraryBand: z.string().min(1).max(40),
    /** Current constraints (minutes/day, days/week, formats, owned resources, etc.). */
    constraints: constraintsInputSchema,
    /** Goals extracted separately so P5 can translate them into process work (G9). */
    goals: z.array(goalSchema).max(20),
    /** Owned resources — the generator prefers what the user already has (Seam 7). */
    ownedResources: z.array(ownedResourceSchema).max(100),
    /** Latest per-dimension skill state (the upserted SkillState rows). */
    latestSkillState: z.array(skillStateValueSchema).max(50),
    /** Immutable per-dimension skill history (recent snapshots, oldest→newest). */
    skillHistory: z.array(skillStateSnapshotValueSchema).max(500),
    /** Spaced-review items due at/ before `assembledAt` (Seam 6). */
    dueWork: z.array(decisionDueItemSchema).max(500),
    /** Activity recency, completion/skip, and actual-duration roll-ups (P4 derives these). */
    activityRecency: activityRecencySchema,
    /** Rolling success rate per Seam-5 track (the servo input). */
    recentSuccessByTrack: recentSuccessByTrackSchema,
    /** Graded weakness signals from Seam 3 (may be empty / insufficient-data). */
    weaknessSignals: z
      .array(
        z
          .object({
            dimension: z.string().min(1).max(80),
            severity: z.number().finite().min(0).max(1),
            confidence: z.string().min(1).max(40),
            sampleSize: z.number().int().nonnegative(),
            evidenceGrade: z.enum(["A", "B", "C", "D"]),
            evidenceTier: z.union([z.literal(1), z.literal(2)]),
            citationKey: z.string().min(1).max(120),
            rationaleKey: z.string().min(1).max(120),
          })
          .strict(),
      )
      .max(50),
    /** Derived training-fit preferences (never a skill estimate; P8 writes). */
    trainingPreferences: trainingPreferenceStateSchema,
  })
  .strict();
export type ProgramDecisionInput = z.infer<typeof programDecisionInputSchema>;

/** Convenience: the subset of the snapshot the pure `generateProgram` consumes. The
 *  generator keeps its narrow `GenerateProgramInput` (engine/generator.ts); this helper
 *  derives it from a parsed snapshot so the server stays the only constructor. */
export interface GenerateProgramSlice {
  band: string;
  tacticalRating: number;
  libraryBand: string;
  minutesPerDay: number;
  formats: readonly string[];
  ownedRefs: readonly string[];
  depthVsBreadth: "depth" | "balanced" | "breadth" | undefined;
  dueItems: readonly DecisionDueItem[];
  recentSuccessByTrack: RecentSuccessByTrack;
}
