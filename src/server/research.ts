import { createHmac } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { programDecisionInputSchema } from "@/lib/decision-input";
import { CHESS_FORMATS } from "@/lib/constraints";
import {
  controlledResearchExportSchema,
  recommendationExposureDraftSchema,
  type ControlledResearchExport,
} from "@/lib/recommendation-exposure";
import {
  CURRENT_DATA_USE_NOTICE,
  type ResearchConsentScope,
} from "@/lib/research-consent";

const RESEARCH_SCOPE: ResearchConsentScope = "aggregate_observational_training";
export const MAX_RESEARCH_EXPORT_RECORDS = 1_000;
const MAX_RESEARCH_WINDOW_DAYS = 366;

const safeOutcomePayloadSchema = z.object({
  correct: z.boolean().optional(),
  solveTimeMs: z.number().int().nonnegative().optional(),
  durationMin: z.number().nonnegative().optional(),
});

export class ResearchExportConfigurationError extends Error {
  override name = "ResearchExportConfigurationError";
}

export function validateResearchExportSecret(
  secret: string | undefined,
): string {
  if (!secret || secret.trim().length < 32) {
    throw new ResearchExportConfigurationError(
      "RESEARCH_EXPORT_SECRET must contain at least 32 non-whitespace characters",
    );
  }
  return secret;
}

const DISALLOWED_SECRET_VARS: ReadonlyArray<[string, string]> = [
  ["AUTH_SECRET", "AUTH_SECRET"],
  ["CRON_SECRET", "CRON_SECRET"],
];

function assertSecretIsNotReused(secret: string): void {
  for (const [envName, label] of DISALLOWED_SECRET_VARS) {
    const other = process.env[envName];
    if (other && other.length > 0 && other === secret) {
      throw new ResearchExportConfigurationError(
        `RESEARCH_EXPORT_SECRET must not reuse ${label}. Generate a separate, randomly generated secret.`,
      );
    }
  }
}

export function pseudonymizeResearchParticipant(
  userId: string,
  secret: string,
): string {
  const validated = validateResearchExportSecret(secret);
  return `participant_${createHmac("sha256", validated)
    .update(userId, "utf8")
    .digest("hex")
    .slice(0, 32)}`;
}

function standardPlayingRatings(
  ratings: unknown,
): { format: (typeof CHESS_FORMATS)[number]; rating: number }[] {
  if (!ratings || typeof ratings !== "object" || Array.isArray(ratings)) {
    return [];
  }
  const record = ratings as Record<string, unknown>;
  return CHESS_FORMATS.flatMap((format) => {
    const value = record[format];
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const rating = (value as { rating?: unknown }).rating;
    if (typeof rating === "number" && Number.isInteger(rating) && rating > 0) {
      return [{ format, rating }];
    }
    return [];
  });
}

function safeConstraints(generationInput: unknown) {
  const parsed = programDecisionInputSchema
    .passthrough()
    .safeParse(generationInput);
  if (!parsed.success) return null;
  const input = parsed.data;
  return {
    band: input.band,
    minutesPerDay: input.constraints.minutesPerDay,
    daysPerWeek: input.constraints.daysPerWeek,
    formatCount: input.constraints.formatPrefs.formats.length,
    weaknessSignalCount: input.weaknessSignals.length,
    dueWorkCount: input.dueWork.length,
  };
}

export interface ControlledResearchExportInput {
  from: Date;
  to: Date;
  maxRecords: number;
  secret: string;
}

/** Read-only derivation. Operational rows remain canonical and this service performs no writes. */
export async function exportControlledObservationalResearch(
  db: PrismaClient,
  input: ControlledResearchExportInput,
): Promise<ControlledResearchExport> {
  const secret = validateResearchExportSecret(input.secret);
  assertSecretIsNotReused(secret);
  if (
    !Number.isInteger(input.maxRecords) ||
    input.maxRecords < 1 ||
    input.maxRecords > MAX_RESEARCH_EXPORT_RECORDS
  ) {
    throw new RangeError(
      `maxRecords must be between 1 and ${MAX_RESEARCH_EXPORT_RECORDS}`,
    );
  }
  const windowMs = input.to.getTime() - input.from.getTime();
  if (
    !Number.isFinite(windowMs) ||
    windowMs <= 0 ||
    windowMs > MAX_RESEARCH_WINDOW_DAYS * 86_400_000
  ) {
    throw new RangeError(
      `Research export window must be between 1 millisecond and ${MAX_RESEARCH_WINDOW_DAYS} days`,
    );
  }

  const baseWhere = {
    exposedAt: { gte: input.from, lt: input.to },
  } as const;
  const eligibleWhere = {
    ...baseWhere,
    user: {
      deletedAt: null,
      researchConsents: {
        some: {
          noticeVersion: CURRENT_DATA_USE_NOTICE.id,
          scopes: { has: RESEARCH_SCOPE },
          withdrawnAt: null,
        },
      },
    },
  } as const;
  const [allCount, eligibleCount, exposures] = await Promise.all([
    db.recommendationExposure.count({ where: baseWhere }),
    db.recommendationExposure.count({ where: eligibleWhere }),
    db.recommendationExposure.findMany({
      where: eligibleWhere,
      orderBy: [{ exposedAt: "asc" }, { id: "asc" }],
      take: input.maxRecords + 1,
      include: {
        program: { select: { generationInput: true } },
        programItem: {
          select: {
            activityEvents: {
              orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
              take: 501,
              select: { type: true, occurredAt: true, payload: true },
            },
          },
        },
        user: {
          select: {
            chessProfileSnapshots: {
              where: { capturedAt: { gte: input.from } },
              orderBy: { capturedAt: "asc" },
              take: 501,
              select: {
                platform: true,
                capturedAt: true,
                ratings: true,
                totalGames: true,
              },
            },
          },
        },
      },
    }),
  ]);

  let missingDecisionInput = 0;
  let missingRatingSnapshot = 0;
  let exposuresWithoutOutcomes = 0;
  let outcomeTruncatedExposures = 0;
  let ratingSearchTruncatedExposures = 0;
  let malformedOutcomeEvents = 0;
  const rows = exposures.slice(0, input.maxRecords).flatMap((exposure) => {
    const recommendation = recommendationExposureDraftSchema.safeParse({
      servedRecommendation: exposure.servedRecommendation,
      eligibleAlternatives: exposure.eligibleAlternatives,
    });
    const constraints = safeConstraints(exposure.program.generationInput);
    if (!recommendation.success || !constraints) {
      missingDecisionInput += 1;
      return [];
    }
    if (exposure.user.chessProfileSnapshots.length > 500) {
      ratingSearchTruncatedExposures += 1;
    }
    const rating = exposure.user.chessProfileSnapshots
      .slice(0, 500)
      .flatMap((snapshot) => {
        if (
          snapshot.capturedAt < exposure.exposedAt ||
          (snapshot.platform !== "lichess" && snapshot.platform !== "chesscom")
        ) {
          return [];
        }
        const ratings = standardPlayingRatings(snapshot.ratings);
        return ratings.length > 0 ? [{ snapshot, ratings }] : [];
      })[0];
    if (!rating) missingRatingSnapshot += 1;
    if (exposure.programItem.activityEvents.length > 500) {
      outcomeTruncatedExposures += 1;
    }
    const outcomes = exposure.programItem.activityEvents
      .slice(0, 500)
      .flatMap((event) => {
        const parsed = safeOutcomePayloadSchema.safeParse(event.payload);
        if (!parsed.success) {
          malformedOutcomeEvents += 1;
          return [];
        }
        const payload = parsed.data;
        return [
          {
            type: event.type,
            occurredAt: event.occurredAt.toISOString(),
            correct: payload.correct ?? null,
            solveTimeMs: payload.solveTimeMs ?? null,
            durationMin: payload.durationMin ?? null,
          },
        ];
      });
    if (outcomes.length === 0) exposuresWithoutOutcomes += 1;
    return [
      {
        participant: pseudonymizeResearchParticipant(exposure.userId, secret),
        exposedAt: exposure.exposedAt.toISOString(),
        methodologyVersion: exposure.methodologyVersion,
        servedRecommendation: recommendation.data.servedRecommendation,
        eligibleAlternatives: recommendation.data.eligibleAlternatives,
        constraints,
        ratingSnapshot: rating
          ? {
              platform: rating.snapshot.platform as "lichess" | "chesscom",
              capturedAt: rating.snapshot.capturedAt.toISOString(),
              ratings: rating.ratings,
              totalGames: rating.snapshot.totalGames,
            }
          : null,
        outcomes,
      },
    ];
  });

  return controlledResearchExportSchema.parse({
    format: "mainline-controlled-research/v1",
    associationOnly: true,
    window: { from: input.from.toISOString(), to: input.to.toISOString() },
    rows,
    metadata: {
      requestedLimit: input.maxRecords,
      returnedRecords: rows.length,
      truncated: eligibleCount > input.maxRecords,
      excludedForConsent: Math.max(0, allCount - eligibleCount),
      missingDecisionInput,
      missingRatingSnapshot,
      exposuresWithoutOutcomes,
      outcomeTruncatedExposures,
      ratingSearchTruncatedExposures,
      malformedOutcomeEvents,
    },
  });
}
