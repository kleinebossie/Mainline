import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { EMPTY_TRAINING_PREFERENCES } from "@/lib/decision-input";
import { loadMethodology } from "@/methodology";
import {
  recommendationForPersistedFocus,
  selectPersistedFocusChoice,
} from "@/server/weekly-focus";

const rationale = {
  text: "Provisional recommendation.",
  grade: "C" as const,
  tier: 1 as const,
  citationKey: "weakness_diagnosis",
  soften: true,
};

const inputSnapshot = {
  schemaVersion: 1 as const,
  methodologyVersion: "research-1.3.0",
  assembledAt: 1_700_000_000_000,
  userId: "u1",
  band: "band1200_1600",
  tacticalRating: 1300,
  libraryBand: "band1200_1600",
  constraints: {
    minutesPerDay: 30,
    daysPerWeek: 5,
    goals: [{ kind: "rating" as const, label: "Improve" }],
    ownedResources: [],
    formatPrefs: {
      formats: [],
      preferredVariety: false,
      targetFocus: "online" as const,
    },
    sessionStyle: { depthVsBreadth: "balanced" as const, interleave: true },
    ifThenPlan: null,
  },
  goals: [{ kind: "rating" as const, label: "Improve" }],
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
    preferences: EMPTY_TRAINING_PREFERENCES,
    userOverride: null,
    resetAt: null,
    updatedAt: 1_700_000_000_000,
  },
};

describe("weekly focus choices", () => {
  it("allows the snapshotted methodology recommendation to replace a user choice", async () => {
    const active = {
      id: "focus-user",
      weekStart: 1_699_660_800_000,
      focusAreas: ["endgames"],
      supportingSignals: [],
      confidence: "low" as const,
      methodologyVersion: "research-1.3.0",
      inputSnapshot,
      status: "active" as const,
      rationaleSnapshots: [rationale],
      alternatives: [],
      selectedAlternative: "endgames",
      revisionTrigger: "user_alternative",
      createdAt: 1_700_000_000_000,
    };
    const recommendation = recommendationForPersistedFocus(
      active,
      loadMethodology("research-1.3.0"),
    );
    expect(recommendation.focusAreas).not.toEqual(active.focusAreas);

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "focus-recommended",
        status: "active",
        createdAt: new Date(inputSnapshot.assembledAt),
        ...data,
      }),
    );
    const tx = { weeklyFocus: { updateMany, create } };
    const db = {
      weeklyFocus: {
        findFirst: vi.fn().mockResolvedValue({
          ...active,
          weekStart: new Date(active.weekStart),
          createdAt: new Date(active.createdAt),
        }),
      },
      $transaction: async (work: (client: typeof tx) => unknown) => work(tx),
    } as unknown as PrismaClient;

    const selected = await selectPersistedFocusChoice(
      db,
      "u1",
      active.id,
      recommendation.focusAreas,
    );

    expect(selected.focusAreas).toEqual(recommendation.focusAreas);
    expect(selected.selectedAlternative).toBeNull();
    expect(selected.revisionTrigger).toBe("user_recommendation");
  });
});
