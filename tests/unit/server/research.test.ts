import { describe, expect, it, vi } from "vitest";

import {
  exportControlledObservationalResearch,
  pseudonymizeResearchParticipant,
} from "@/server/research";
import { CURRENT_DATA_USE_NOTICE } from "@/lib/research-consent";
import { servedRecommendationSnapshotSchema } from "@/lib/recommendation-exposure";

const served = {
  activityId: "calculation_drill",
  activityType: "puzzle",
  dimensionsTargeted: ["calculation"],
  rank: 0,
  score: 4,
  dueEligible: false,
  confidence: "medium",
  evidenceGrade: "B",
  evidenceTier: 2,
  citationKey: "retrieval",
  softened: true,
  allocatedMinutes: 12,
};

const generationInput = {
  schemaVersion: 1,
  methodologyVersion: "research-1.4.0",
  assembledAt: 1,
  userId: "raw-user-id",
  band: "b1200_1600",
  tacticalRating: 1400,
  libraryBand: "b1200_1600",
  constraints: {
    minutesPerDay: 30,
    daysPerWeek: 5,
    goals: [],
    ownedResources: [],
    formatPrefs: {
      formats: ["rapid"],
      preferredVariety: false,
      targetFocus: "online",
    },
    sessionStyle: { depthVsBreadth: "balanced", interleave: true },
    ifThenPlan: { cue: "secret cue", plan: "secret plan" },
  },
  goals: [],
  ownedResources: [],
  latestSkillState: [],
  skillHistory: [],
  dueWork: [],
  activityRecency: {
    lastEventAtByType: {},
    completionsByType: {},
    skipsByType: {},
    durationMinutesByType: {},
    activeDays: 0,
    totalEvents: 0,
  },
  recentSuccessByTrack: {},
  weaknessSignals: [],
  trainingPreferences: {
    preferences: {
      enjoyment: {},
      enjoymentEvidenceCount: {},
      resourceAffinity: {},
      resourceEvidenceCount: {},
      timeFit: {},
      sessionTimeFit: null,
      frictionTags: [],
      evidenceCount: 0,
    },
    userOverride: null,
    resetAt: null,
    updatedAt: 1,
  },
  weeklyFocus: { freeTextThatMustNotExport: "private" },
};

function exposure() {
  return {
    id: "raw-exposure-id",
    userId: "raw-user-id",
    methodologyVersion: "research-1.4.0",
    exposedAt: new Date("2026-07-10T00:00:00Z"),
    servedRecommendation: served,
    eligibleAlternatives: {
      complete: true,
      totalEligibleCount: 1,
      alternatives: [],
    },
    program: { generationInput },
    programItem: {
      activityEvents: [
        {
          type: "puzzle_attempt",
          occurredAt: new Date("2026-07-10T00:10:00Z"),
          payload: {
            correct: true,
            solveTimeMs: 20_000,
            puzzleId: "private-puzzle",
            externalRef: "private-external",
          },
        },
      ],
    },
    user: {
      chessProfileSnapshots: [
        {
          platform: "lichess",
          capturedAt: new Date("2026-07-11T00:00:00Z"),
          ratings: {
            puzzle: { rating: 2200, rd: 60 },
            chess960: { rating: 1800, rd: 90 },
            blitz: { rating: 1380, rd: 85 },
            rapid: { rating: 1420, rd: 80 },
          },
          totalGames: 123,
        },
      ],
    },
  };
}

describe("controlled observational research export", () => {
  it("rejects extra persisted snapshot fields", () => {
    expect(
      servedRecommendationSnapshotSchema.safeParse({
        ...served,
        puzzleId: "private",
      }).success,
    ).toBe(false);
  });

  it("uses deterministic secret-keyed pseudonyms", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    expect(pseudonymizeResearchParticipant("u1", secret)).toBe(
      pseudonymizeResearchParticipant("u1", secret),
    );
    expect(pseudonymizeResearchParticipant("u1", secret)).not.toBe(
      pseudonymizeResearchParticipant("u1", "fedcba9876543210fedcba9876543210"),
    );
    expect(() => pseudonymizeResearchParticipant("u1", "short")).toThrow(
      /at least 32/,
    );
  });

  it("checks current consent in the query and excludes dangerous fields", async () => {
    const count = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    const findMany = vi.fn().mockResolvedValue([exposure()]);
    const result = await exportControlledObservationalResearch(
      { recommendationExposure: { count, findMany } } as never,
      {
        from: new Date("2026-07-01T00:00:00Z"),
        to: new Date("2026-08-01T00:00:00Z"),
        maxRecords: 10,
        secret: "0123456789abcdef0123456789abcdef",
      },
    );

    expect(findMany.mock.calls[0]?.[0].where.user).toEqual({
      deletedAt: null,
      researchConsents: {
        some: {
          noticeVersion: CURRENT_DATA_USE_NOTICE.id,
          scopes: { has: "aggregate_observational_training" },
          withdrawnAt: null,
        },
      },
    });
    expect(result.metadata).toMatchObject({
      excludedForConsent: 2,
      missingDecisionInput: 0,
      missingRatingSnapshot: 0,
      exposuresWithoutOutcomes: 0,
      malformedOutcomeEvents: 0,
    });
    expect(result.rows[0]).toMatchObject({
      methodologyVersion: "research-1.4.0",
      constraints: {
        band: "b1200_1600",
        minutesPerDay: 30,
        daysPerWeek: 5,
        formatCount: 1,
      },
      ratingSnapshot: {
        ratings: [
          { format: "blitz", rating: 1380 },
          { format: "rapid", rating: 1420 },
        ],
        totalGames: 123,
      },
      outcomes: [{ correct: true, solveTimeMs: 20_000 }],
    });
    const serialized = JSON.stringify(result);
    for (const dangerous of [
      "raw-user-id",
      "raw-exposure-id",
      "private-puzzle",
      "private-external",
      "secret cue",
      "secret plan",
      "weeklyFocus",
      "puzzleId",
      "externalRef",
    ]) {
      expect(serialized).not.toContain(dangerous);
    }
  });

  it("reports missing outcomes, decision inputs, ratings, and truncation", async () => {
    const invalid = exposure();
    invalid.program.generationInput = {} as never;
    invalid.programItem.activityEvents = [];
    invalid.user.chessProfileSnapshots = [];
    const result = await exportControlledObservationalResearch(
      {
        recommendationExposure: {
          count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(2),
          findMany: vi.fn().mockResolvedValue([invalid, exposure()]),
        },
      } as never,
      {
        from: new Date("2026-07-01T00:00:00Z"),
        to: new Date("2026-08-01T00:00:00Z"),
        maxRecords: 1,
        secret: "0123456789abcdef0123456789abcdef",
      },
    );
    expect(result.rows).toHaveLength(0);
    expect(result.metadata).toMatchObject({
      truncated: true,
      missingDecisionInput: 1,
      returnedRecords: 0,
    });
  });

  it("skips malformed activity event payloads instead of aborting the export", async () => {
    const withBadEvent = exposure();
    withBadEvent.programItem.activityEvents.push({
      type: "puzzle_attempt",
      occurredAt: new Date("2026-07-10T00:11:00Z"),
      payload: { correct: "not-a-boolean" } as never,
    });
    const result = await exportControlledObservationalResearch(
      {
        recommendationExposure: {
          count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
          findMany: vi.fn().mockResolvedValue([withBadEvent]),
        },
      } as never,
      {
        from: new Date("2026-07-01T00:00:00Z"),
        to: new Date("2026-08-01T00:00:00Z"),
        maxRecords: 10,
        secret: "0123456789abcdef0123456789abcdef",
      },
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.outcomes).toHaveLength(1);
    expect(row.outcomes[0]?.correct).toBe(true);
    expect(result.metadata.malformedOutcomeEvents).toBe(1);
  });

  it("rejects a RESEARCH_EXPORT_SECRET that reuses AUTH_SECRET or CRON_SECRET", async () => {
    const shared = "0123456789abcdef0123456789abcdef";
    const originalAuth = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = shared;
    try {
      await expect(
        exportControlledObservationalResearch(
          {
            recommendationExposure: {
              count: vi.fn(),
              findMany: vi.fn(),
            },
          } as never,
          {
            from: new Date("2026-07-01T00:00:00Z"),
            to: new Date("2026-08-01T00:00:00Z"),
            maxRecords: 10,
            secret: shared,
          },
        ),
      ).rejects.toThrow(/must not reuse AUTH_SECRET/);
    } finally {
      if (originalAuth === undefined) {
        delete process.env.AUTH_SECRET;
      } else {
        process.env.AUTH_SECRET = originalAuth;
      }
    }
  });
});
