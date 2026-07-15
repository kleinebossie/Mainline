import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/weekly-focus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weekly-focus")>();
  return {
    ...actual,
    programGenerationInputSchema: {
      parse: (value: unknown) => {
        if (
          value &&
          typeof value === "object" &&
          "legacyFixture" in value
        ) {
          throw new Error("Legacy snapshot");
        }
        return value;
      },
    },
  };
});

import {
  getAvailabilityOverrides,
  getForecast,
  getProgramRevisions,
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
  it("repairs a legacy Program using its persisted active weekly focus", async () => {
    const created: Array<Record<string, unknown>> = [];
    const focus = {
      id: "focus-legacy",
      userId: "u1",
      weekStart: new Date("2026-07-13T00:00:00.000Z"),
      focusAreas: ["calculation"],
      supportingSignals: [],
      confidence: "medium",
      methodologyVersion: "research-1.1.0",
      inputSnapshot: {},
      status: "active",
      rationaleSnapshots: [rationale],
      alternatives: [],
      selectedAlternative: null,
      revisionTrigger: null,
      createdAt: new Date("2026-07-13T08:00:00.000Z"),
    };
    const db = {
      weeklyFocus: { findFirst: vi.fn().mockResolvedValue(focus) },
      weeklyAvailability: { findUnique: vi.fn().mockResolvedValue(null) },
      availabilityOverride: { findMany: vi.fn().mockResolvedValue([]) },
      program: {
        findFirst: vi.fn().mockResolvedValue({
          methodologyVersion: "research-1.1.0",
          generationInput: {
            legacyFixture: true,
            constraints: { minutesPerDay: 20 },
            dueWork: [],
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
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        create: vi.fn(async ({ data }) => {
          const row = { id: `legacy-${created.length}`, ...data };
          created.push(row);
          return row;
        }),
      },
      programRevision: { create: vi.fn() },
    };

    const result = await getForecast(db as never, "u1", { now: () => now });

    expect(result).toHaveLength(7);
    expect(result[0]).toMatchObject({
      status: "materialized",
      focusLinks: ["calculation"],
    });
    expect(db.weeklyFocus.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", status: "active" },
      orderBy: [{ weekStart: "desc" }, { createdAt: "desc" }],
    });
  });

  it("repairs a missing current window from the active persisted Program", async () => {
    const created: Array<Record<string, unknown>> = [];
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
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        create: vi.fn(async ({ data }) => {
          const row = { id: `new-${created.length}`, ...data };
          created.push(row);
          return row;
        }),
      },
      programRevision: { create: vi.fn() },
    };

    const result = await getForecast(db as never, "u1", { now: () => now });

    expect(result).toHaveLength(7);
    expect(result[0]).toMatchObject({
      status: "materialized",
      expectedMinutes: 10,
    });
    expect(result.slice(1).every((day) => day.status === "provisional")).toBe(
      true,
    );
  });

  it("pages revisions with a stable per-user cursor", async () => {
    const occurredAt = new Date("2026-07-13T09:00:00.000Z");
    const revision = (id: string, at: Date) => ({
      id,
      userId: "u1",
      previousFocusId: null,
      newFocusId: "focus-1",
      previousForecastId: null,
      newForecastId: "forecast-1",
      trigger: "generation",
      changedFields: ["forecast"],
      gradedDecisions: [rationale],
      methodologyVersion: "research-1.1.0",
      occurredAt: at,
      createdAt: at,
    });
    const findMany = vi
      .fn()
      .mockResolvedValue([
        revision("revision-3", occurredAt),
        revision("revision-2", occurredAt),
        revision("revision-1", new Date(occurredAt.getTime() - 1)),
      ]);

    const result = await getProgramRevisions(
      { programRevision: { findMany } } as never,
      "u1",
      {
        limit: 2,
        cursor: { occurredAt: occurredAt.getTime() + 1, id: "revision-4" },
      },
    );

    expect(result.revisions.map((entry) => entry.id)).toEqual([
      "revision-3",
      "revision-2",
    ]);
    expect(result.nextCursor).toEqual({
      occurredAt: occurredAt.getTime(),
      id: "revision-2",
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        OR: [
          { occurredAt: { lt: new Date(occurredAt.getTime() + 1) } },
          {
            occurredAt: new Date(occurredAt.getTime() + 1),
            id: { lt: "revision-4" },
          },
        ],
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 3,
    });
  });

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
