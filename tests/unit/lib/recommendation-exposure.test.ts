import { describe, expect, it } from "vitest";

import {
  recommendationExposureDraftSchema,
  type RecommendationExposureDraft,
} from "@/lib/recommendation-exposure";

describe("recommendationExposureDraftSchema", () => {
  const validDraft: RecommendationExposureDraft = {
    servedRecommendation: {
      activityId: "puzzles_fork",
      activityType: "tactics",
      dimensionsTargeted: ["tactics"],
      rank: 0,
      score: 1.5,
      dueEligible: true,
      confidence: "high",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "deliberate_practice",
      softened: false,
      allocatedMinutes: 15,
    },
    eligibleAlternatives: {
      complete: true,
      totalEligibleCount: 3,
      alternatives: [
        {
          activityId: "analysis",
          activityType: "game_analysis",
          dimensionsTargeted: ["analysis"],
          rank: 1,
          score: 1.2,
          dueEligible: false,
          confidence: "medium",
          evidenceGrade: "B",
          evidenceTier: 1,
          citationKey: "self_analysis",
          softened: false,
        },
        {
          activityId: "endgame_drill",
          activityType: "endgame",
          dimensionsTargeted: ["endgame"],
          rank: 2,
          score: 0.9,
          dueEligible: false,
          confidence: "low",
          evidenceGrade: "B",
          evidenceTier: 2,
          citationKey: "endgame_curriculum",
          softened: false,
        },
      ],
    },
  };

  it("accepts a valid draft where totalEligibleCount matches alternatives + 1 and ranks are contiguous", () => {
    expect(recommendationExposureDraftSchema.safeParse(validDraft).success).toBe(true);
  });

  it("rejects when totalEligibleCount does not match alternatives.length + 1", () => {
    const invalid = {
      ...validDraft,
      eligibleAlternatives: {
        ...validDraft.eligibleAlternatives,
        totalEligibleCount: 5,
      },
    };
    const result = recommendationExposureDraftSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Eligible count must include the served recommendation",
      );
    }
  });

  it("rejects when ranks have duplicates", () => {
    const invalid = {
      ...validDraft,
      eligibleAlternatives: {
        ...validDraft.eligibleAlternatives,
        alternatives: [
          {
            ...validDraft.eligibleAlternatives.alternatives[0]!,
            rank: 0, // Duplicate rank with served recommendation (0)
          },
          validDraft.eligibleAlternatives.alternatives[1]!,
        ],
      },
    };
    const result = recommendationExposureDraftSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Eligible ranks must be unique and complete",
      );
    }
  });

  it("rejects when ranks are out of range", () => {
    const invalid = {
      ...validDraft,
      eligibleAlternatives: {
        ...validDraft.eligibleAlternatives,
        alternatives: [
          {
            ...validDraft.eligibleAlternatives.alternatives[0]!,
            rank: 5, // Out of range [0, 3)
          },
          validDraft.eligibleAlternatives.alternatives[1]!,
        ],
      },
    };
    const result = recommendationExposureDraftSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Eligible ranks must be unique and complete",
      );
    }
  });
});
