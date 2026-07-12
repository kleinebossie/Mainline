import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/weekly-focus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weekly-focus")>();
  return {
    ...actual,
    programGenerationInputSchema: { parse: (value: unknown) => value },
  };
});

import {
  getAvailabilityOverrides,
  refreshForecast,
  removeAvailabilityOverride,
} from "@/server/program-forecast";

const now = Date.parse("2026-07-13T10:00:00Z");
const rationale = {
  text: "Current measured signal",
  grade: "C",
  tier: 1 as const,
  citationKey: "methodology",
  soften: true,
};

function forecastRow(id: string, date: number, status: string) {
  return {
    id,
    userId: "u1",
    weeklyFocusId: "focus-1",
    date: new Date(date),
    status,
    plannedBlocks: [],
    expectedMinutes: 0,
    focusLinks: ["calculation"],
    dueReviewPressure: { count: 0 },
    rationaleSnapshots: [rationale],
    methodologyVersion: "research-1.1.0",
    inputSnapshot: {},
    createdAt: new Date(now - 1),
  };
}

describe("P6 forecast persistence", () => {
  it("lists and removes only the current user's normalized date override", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        date: new Date("2026-07-14T00:00:00Z"),
        minutes: null,
        unavailable: true,
      },
    ]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { availabilityOverride: { findMany, deleteMany } };

    await expect(
      getAvailabilityOverrides(db as never, "u1", { now: () => now }),
    ).resolves.toEqual([
      {
        date: Date.parse("2026-07-14T00:00:00Z"),
        minutes: null,
        unavailable: true,
      },
    ]);
    await removeAvailabilityOverride(
      db as never,
      "u1",
      Date.parse("2026-07-14T18:30:00Z"),
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        date: new Date("2026-07-14T00:00:00Z"),
      },
    });
  });

  it("keeps committed Today and appends an inspectable future revision", async () => {
    const today = forecastRow(
      "today-old",
      Date.parse("2026-07-13T00:00:00Z"),
      "materialized",
    );
    const tomorrow = forecastRow(
      "future-old",
      Date.parse("2026-07-14T00:00:00Z"),
      "provisional",
    );
    const updateMany = vi.fn();
    const revisionCreate = vi.fn(async ({ data }) => ({
      id: "revision",
      ...data,
    }));
    let sequence = 0;
    const forecastCreate = vi.fn(async ({ data }) => ({
      id: `future-new-${sequence++}`,
      createdAt: new Date(now),
      ...data,
    }));
    const priorRows = [today, tomorrow];
    const tx = {
      programDayForecast: {
        findMany: vi.fn().mockResolvedValue(priorRows),
        updateMany,
        create: forecastCreate,
      },
      programRevision: { create: revisionCreate },
    };
    const db = {
      weeklyAvailability: { findUnique: vi.fn().mockResolvedValue(null) },
      availabilityOverride: { findMany: vi.fn().mockResolvedValue([]) },
      program: {
        findFirst: vi.fn().mockResolvedValue({
          methodologyVersion: "research-1.1.0",
          generationInput: {
            constraints: { minutesPerDay: 20 },
            dueWork: [],
            weeklyFocus: {
              id: "focus-1",
              focusAreas: ["calculation"],
              rationaleSnapshots: [rationale],
            },
          },
          items: [
            {
              activityId: "calculation",
              activityType: "puzzle_theme",
              params: { estMinutes: 10 },
              dimensionsTargeted: ["calculation"],
              rationaleKey: "weekly_focus_primary",
              rationaleText: rationale.text,
              evidenceGrade: rationale.grade,
              evidenceTier: rationale.tier,
              citationKey: rationale.citationKey,
              confidence: "medium",
              soften: rationale.soften,
            },
          ],
        }),
      },
      programDayForecast: {
        findMany: vi.fn().mockResolvedValue(priorRows),
      },
      programRevision: {},
      $transaction: async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
    };

    const result = await refreshForecast(
      db as never,
      "u1",
      { now: () => now },
      "availability",
      true,
    );

    expect(result[0]?.id).toBe("today-old");
    expect(forecastCreate).toHaveBeenCalledTimes(6);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "today-old" } }),
      }),
    );
    expect(revisionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousForecastId: "future-old",
        newForecastId: "future-new-0",
        trigger: "availability",
        methodologyVersion: "research-1.1.0",
        gradedDecisions: [rationale],
        changedFields: expect.arrayContaining(["plannedBlocks"]),
      }),
    });
  });

  it("uses a newly selected focus for future days while retaining committed Today", async () => {
    const today = forecastRow(
      "today-old",
      Date.parse("2026-07-13T00:00:00Z"),
      "materialized",
    );
    const tomorrow = forecastRow(
      "future-old",
      Date.parse("2026-07-14T00:00:00Z"),
      "provisional",
    );
    const createdRows: Array<Record<string, unknown>> = [];
    const revisionCreate = vi.fn();
    const tx = {
      programDayForecast: {
        findMany: vi.fn().mockResolvedValue([today, tomorrow]),
        updateMany: vi.fn(),
        create: vi.fn(async ({ data }) => {
          const row = {
            id: `new-${createdRows.length}`,
            createdAt: new Date(now),
            ...data,
          };
          createdRows.push(row);
          return row;
        }),
      },
      programRevision: { create: revisionCreate },
    };
    const db = {
      weeklyAvailability: { findUnique: vi.fn().mockResolvedValue(null) },
      availabilityOverride: { findMany: vi.fn().mockResolvedValue([]) },
      program: { findFirst: vi.fn() },
      programDayForecast: { findMany: vi.fn() },
      programRevision: {},
      $transaction: async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
    };
    const nextRationale = { ...rationale, text: "New approved focus" };
    const source = {
      methodologyVersion: "research-1.1.0",
      generationInput: {
        constraints: { minutesPerDay: 20 },
        dueWork: [],
        weeklyFocus: {
          id: "focus-2",
          focusAreas: ["tactics"],
          rationaleSnapshots: [nextRationale],
        },
      },
      items: [
        {
          activityId: "tactics",
          activityType: "puzzle_theme",
          params: { estMinutes: 10 },
          dimensionsTargeted: ["tactics"],
          rationaleKey: "weekly_focus_primary",
          rationaleText: nextRationale.text,
          evidenceGrade: nextRationale.grade,
          evidenceTier: nextRationale.tier,
          citationKey: nextRationale.citationKey,
          confidence: "medium",
          soften: nextRationale.soften,
        },
      ],
    };

    const result = await refreshForecast(
      db as never,
      "u1",
      { now: () => now },
      "focus_alternative",
      true,
      source,
    );

    expect(result[0]?.id).toBe("today-old");
    expect(result[1]).toMatchObject({
      focusLinks: ["tactics"],
      plannedBlocks: [
        expect.objectContaining({
          activityId: "tactics",
          rationaleText: "New approved focus",
          evidenceGrade: "C",
          citationKey: "methodology",
        }),
      ],
    });
    expect(revisionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousFocusId: "focus-1",
        newFocusId: "focus-2",
        previousForecastId: "future-old",
        newForecastId: "new-0",
        changedFields: expect.arrayContaining(["weeklyFocus"]),
      }),
    });
  });
});
