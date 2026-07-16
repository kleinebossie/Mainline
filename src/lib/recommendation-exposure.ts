import { z } from "zod";
import { CHESS_FORMATS } from "@/lib/constraints";

const evidenceGradeSchema = z.enum(["A", "B", "C", "D"]);
const evidenceTierSchema = z.union([z.literal(1), z.literal(2)]);
const confidenceSchema = z.enum(["insufficient", "low", "medium", "high"]);

export const recommendationCandidateSnapshotSchema = z
  .object({
    activityId: z.string().min(1).max(120),
    activityType: z.string().min(1).max(120),
    dimensionsTargeted: z.array(z.string().min(1).max(80)).max(50),
    rank: z.number().int().nonnegative(),
    score: z.number().finite(),
    dueEligible: z.boolean(),
    confidence: confidenceSchema,
    evidenceGrade: evidenceGradeSchema,
    evidenceTier: evidenceTierSchema,
    citationKey: z.string().min(1).max(120),
    softened: z.boolean(),
  })
  .strict();

export const servedRecommendationSnapshotSchema =
  recommendationCandidateSnapshotSchema
    .extend({
      allocatedMinutes: z.number().int().positive(),
    })
    .strict();

export const eligibleAlternativesSnapshotSchema = z
  .object({
    complete: z.literal(true),
    totalEligibleCount: z.number().int().nonnegative().max(100),
    alternatives: z.array(recommendationCandidateSnapshotSchema).max(99),
  })
  .strict();

export const recommendationExposureDraftSchema = z
  .object({
    servedRecommendation: servedRecommendationSnapshotSchema,
    eligibleAlternatives: eligibleAlternativesSnapshotSchema,
  })
  .strict()
  .superRefine((exposure, ctx) => {
    const { alternatives, totalEligibleCount } = exposure.eligibleAlternatives;
    if (totalEligibleCount !== alternatives.length + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Eligible count must include the served recommendation",
        path: ["eligibleAlternatives", "totalEligibleCount"],
      });
    }
    const ranks = [
      exposure.servedRecommendation.rank,
      ...alternatives.map((candidate) => candidate.rank),
    ];
    if (
      new Set(ranks).size !== ranks.length ||
      ranks.some((rank) => rank < 0 || rank >= totalEligibleCount)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Eligible ranks must be unique and complete",
        path: ["eligibleAlternatives", "alternatives"],
      });
    }
  });

export type RecommendationCandidateSnapshot = z.infer<
  typeof recommendationCandidateSnapshotSchema
>;
export type ServedRecommendationSnapshot = z.infer<
  typeof servedRecommendationSnapshotSchema
>;
export type EligibleAlternativesSnapshot = z.infer<
  typeof eligibleAlternativesSnapshotSchema
>;

export type RecommendationExposureDraft = z.infer<
  typeof recommendationExposureDraftSchema
>;

export const researchOutcomeSchema = z
  .object({
    type: z.string().min(1).max(80),
    occurredAt: z.string().datetime(),
    correct: z.boolean().nullable(),
    solveTimeMs: z.number().int().nonnegative().nullable(),
    durationMin: z.number().nonnegative().nullable(),
  })
  .strict();

export const researchConstraintProjectionSchema = z
  .object({
    band: z.string().min(1).max(40).nullable(),
    minutesPerDay: z.number().int().positive().nullable(),
    daysPerWeek: z.number().int().min(1).max(7).nullable(),
    formatCount: z.number().int().nonnegative(),
    weaknessSignalCount: z.number().int().nonnegative(),
    dueWorkCount: z.number().int().nonnegative(),
  })
  .strict();

export const researchRatingSchema = z
  .object({
    platform: z.enum(["lichess", "chesscom"]),
    capturedAt: z.string().datetime(),
    ratings: z
      .array(
        z
          .object({
            format: z.enum(CHESS_FORMATS),
            rating: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .max(CHESS_FORMATS.length),
    totalGames: z.number().int().nonnegative(),
  })
  .strict();

export const controlledResearchRowSchema = z
  .object({
    participant: z.string().regex(/^participant_[a-f0-9]{32}$/),
    exposedAt: z.string().datetime(),
    methodologyVersion: z.string().min(1).max(80),
    servedRecommendation: servedRecommendationSnapshotSchema,
    eligibleAlternatives: eligibleAlternativesSnapshotSchema,
    constraints: researchConstraintProjectionSchema,
    ratingSnapshot: researchRatingSchema.nullable(),
    outcomes: z.array(researchOutcomeSchema).max(500),
  })
  .strict();

export const controlledResearchExportSchema = z
  .object({
    format: z.literal("mainline-controlled-research/v1"),
    associationOnly: z.literal(true),
    window: z
      .object({ from: z.string().datetime(), to: z.string().datetime() })
      .strict(),
    rows: z.array(controlledResearchRowSchema),
    metadata: z
      .object({
        requestedLimit: z.number().int().positive(),
        returnedRecords: z.number().int().nonnegative(),
        truncated: z.boolean(),
        excludedForConsent: z.number().int().nonnegative(),
        missingDecisionInput: z.number().int().nonnegative(),
        missingRatingSnapshot: z.number().int().nonnegative(),
        exposuresWithoutOutcomes: z.number().int().nonnegative(),
        outcomeTruncatedExposures: z.number().int().nonnegative(),
        ratingSearchTruncatedExposures: z.number().int().nonnegative(),
        malformedOutcomeEvents: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type ControlledResearchExport = z.infer<
  typeof controlledResearchExportSchema
>;
