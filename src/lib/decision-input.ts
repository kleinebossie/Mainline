// Persisted input for deterministic program generation. It contains descriptive state,
// never graded decisions. Training preferences must never write skill estimates.

import { z } from "zod";

import {
  constraintsInputSchema,
  goalSchema,
  ownedResourceSchema,
} from "@/lib/constraints";

/** Raw per-dimension competence estimate, kept in lib to avoid an Engine import. */
const skillStateValueSchema = z
  .object({
    dimension: z.string().min(1).max(80),
    estimate: z.number().finite(),
    uncertainty: z.number().finite().nonnegative(),
    sampleSize: z.number().int().nonnegative(),
  })
  .strict();

/** One immutable point in the per-dimension skill history. */
const skillStateSnapshotValueSchema = skillStateValueSchema
  .extend({
    methodologyVersion: z.string().min(1).max(80),
    runAt: z.number().int(),
    capturedAt: z.number().int(),
  })
  .strict();
export type SkillStateSnapshotValue = z.infer<
  typeof skillStateSnapshotValueSchema
>;

/** A review due at or before the snapshot's logical time. */
const decisionDueItemSchema = z
  .object({
    itemRef: z.string().min(1).max(120),
    itemType: z.string().min(1).max(120),
    due: z.number().int(),
  })
  .strict();
export type DecisionDueItem = z.infer<typeof decisionDueItemSchema>;

/** Rolling success rate by track. Target selection remains in methodology. */
const recentSuccessByTrackSchema = z
  .object({
    pattern: z.number().finite().min(0).max(1).optional(),
    calculation: z.number().finite().min(0).max(1).optional(),
  })
  .strict();

/** Descriptive activity rollups derived from immutable events. */
const activityRecencySchema = z
  .object({
    lastEventAtByType: z.record(z.string(), z.number().int()).default({}),
    completionsByType: z
      .record(z.string(), z.number().int().nonnegative())
      .default({}),
    skipsByType: z
      .record(z.string(), z.number().int().nonnegative())
      .default({}),
    durationMinutesByType: z
      .record(z.string(), z.number().nonnegative())
      .default({}),
    activeDays: z.number().int().nonnegative().default(0),
    totalEvents: z.number().int().nonnegative().default(0),
  })
  .strict();
export type ActivityRecency = z.infer<typeof activityRecencySchema>;

/** Descriptive training preferences. These are never skill estimates. */
export const trainingPreferencesSchema = z
  .object({
    enjoyment: z
      .record(z.string(), z.number().finite().min(0).max(1))
      .default({}),
    resourceAffinity: z
      .record(z.string(), z.number().finite().min(0).max(1))
      .default({}),
    frictionTags: z.array(z.string().min(1).max(80)).max(50).default([]),
    evidenceCount: z.number().int().nonnegative().default(0),
    methodologyVersion: z.string().min(1).max(80).optional(),
  })
  .strict();
type TrainingPreferences = z.infer<typeof trainingPreferencesSchema>;

export const EMPTY_TRAINING_PREFERENCES: TrainingPreferences = {
  enjoyment: {},
  resourceAffinity: {},
  frictionTags: [],
  evidenceCount: 0,
};

/** Persisted preference state, including an optional user override. */
const trainingPreferenceStateSchema = z
  .object({
    preferences: trainingPreferencesSchema,
    userOverride: trainingPreferencesSchema.nullable(),
    resetAt: z.number().int().nullable(),
    updatedAt: z.number().int(),
  })
  .strict();
export type TrainingPreferenceStateSnapshot = z.infer<
  typeof trainingPreferenceStateSchema
>;

/** The validated snapshot persisted as `Program.generationInput`. */
export const programDecisionInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    methodologyVersion: z.string().min(1).max(80),
    assembledAt: z.number().int(),
    userId: z.string().min(1).max(80),
    band: z.string().min(1).max(40),
    tacticalRating: z.number().finite(),
    libraryBand: z.string().min(1).max(40),
    constraints: constraintsInputSchema,
    goals: z.array(goalSchema).max(20),
    ownedResources: z.array(ownedResourceSchema).max(100),
    latestSkillState: z.array(skillStateValueSchema).max(50),
    skillHistory: z.array(skillStateSnapshotValueSchema).max(500),
    dueWork: z.array(decisionDueItemSchema).max(500),
    activityRecency: activityRecencySchema,
    recentSuccessByTrack: recentSuccessByTrackSchema,
    weaknessSignals: z
      .array(
        z
          .object({
            dimension: z.string().min(1).max(80),
            severity: z.number().finite().min(0).max(1),
            confidence: z.enum(["insufficient", "low", "medium", "high"]),
            sampleSize: z.number().int().nonnegative(),
            evidenceGrade: z.enum(["A", "B", "C", "D"]),
            evidenceTier: z.union([z.literal(1), z.literal(2)]),
            citationKey: z.string().min(1).max(120),
            rationaleKey: z.string().min(1).max(120),
          })
          .strict(),
      )
      .max(50),
    trainingPreferences: trainingPreferenceStateSchema,
  })
  .strict();
export type ProgramDecisionInput = z.infer<typeof programDecisionInputSchema>;
