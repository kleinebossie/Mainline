import { describe, expect, it, vi } from "vitest";

import {
  getProgramHistory,
  MAX_HISTORY_EVENTS_PER_ITEM,
} from "@/server/program-history";
import { loadMethodology } from "@/methodology";

const day = new Date("2026-07-13T00:00:00.000Z");

function item(
  id: string,
  events: { occurredAt: Date; payload: unknown }[],
  estMinutes: number,
) {
  return {
    id,
    date: day,
    orderIndex: 0,
    activityId: "analyse_own_games",
    activityType: "analyse",
    params: { estMinutes },
    dimensionsTargeted: ["calculation"],
    rationaleText: "Review the decisions in your own game.",
    evidenceGrade: "C",
    evidenceTier: 1,
    citationKey: "stub_open_question",
    confidence: "low",
    soften: true,
    status: events.length > 0 ? "done" : "pending",
    activityEvents: events
      .map((event, index) => ({ id: `${id}-event-${index}`, ...event }))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()),
    _count: { activityEvents: events.length },
  };
}

function program(
  id: string,
  createdAt: Date,
  items: ReturnType<typeof item>[],
) {
  return {
    id,
    status: id === "program-3" ? "active" : "superseded",
    createdAt,
    methodologyVersion: "research-1.3.0",
    items,
  };
}

describe("getProgramHistory", () => {
  it("keeps same-day versions and distinguishes unmeasured time from zero", async () => {
    const measuredAt = new Date("2026-07-13T10:00:00.000Z");
    const findMany = vi.fn().mockResolvedValue([
      program("program-3", new Date("2026-07-13T09:30:00.000Z"), [
        item(
          "item-3",
          [
            {
              occurredAt: measuredAt,
              payload: { durationMin: 12, solveTimeMs: 30_000 },
            },
            {
              occurredAt: new Date("2026-07-13T10:10:00.000Z"),
              payload: { solveTimeMs: 120_000 },
            },
            {
              occurredAt: new Date("2026-07-13T10:05:00.000Z"),
              payload: { correct: true },
            },
          ],
          20,
        ),
      ]),
      program("program-2", new Date("2026-07-13T08:00:00.000Z"), [
        item(
          "item-2",
          [{ occurredAt: measuredAt, payload: { correct: true } }],
          15,
        ),
      ]),
      program("program-1", new Date("2026-07-12T08:00:00.000Z"), [
        item("item-1", [], 10),
      ]),
    ]);

    const result = await getProgramHistory(
      { program: { findMany } } as never,
      "user-1",
      { limit: 2 },
    );

    expect(result.entries.map((entry) => entry.id)).toEqual([
      "program-3",
      "program-2",
    ]);
    expect(result.entries.map((entry) => entry.scheduledDate)).toEqual([
      day,
      day,
    ]);
    expect(result.entries[0]).toMatchObject({
      plannedMinutes: 20,
      actualMinutes: 14,
      eventCount: 3,
      measuredEventCount: 2,
      measurementTruncated: false,
      lastActivityAt: new Date("2026-07-13T10:10:00.000Z"),
      items: [
        {
          label: "Analyse your own games",
          dimensionLabels: ["Calculation / Visualisation"],
          plannedMinutes: 20,
          actualMinutes: 14,
          eventCount: 3,
          measuredEventCount: 2,
          measurementTruncated: false,
          rationale: {
            citationKey: "stub_open_question",
            citationSource: expect.any(String),
          },
        },
      ],
    });
    expect(result.entries[1]!.actualMinutes).toBeNull();
    expect(result.entries[1]!.items[0]!.actualMinutes).toBeNull();
    expect(result.nextCursor).toEqual({
      createdAt: new Date("2026-07-13T08:00:00.000Z"),
      id: "program-2",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        take: 3,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(
      findMany.mock.calls[0]![0].select.items.select.activityEvents,
    ).toEqual({
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: MAX_HISTORY_EVENTS_PER_ITEM,
      select: { id: true, occurredAt: true, payload: true },
    });
  });

  it("uses a stable cursor and never relabels an unavailable old release", async () => {
    const createdAt = new Date("2026-07-12T08:00:00.000Z");
    const findMany = vi.fn().mockResolvedValue([
      {
        ...program("program-old", createdAt, [item("item-old", [], 10)]),
        methodologyVersion: "retired-0.1.0",
      },
    ]);
    const methodologyLoader = vi.fn(loadMethodology);

    const result = await getProgramHistory(
      { program: { findMany } } as never,
      "user-1",
      {
        limit: 5,
        cursor: {
          createdAt: new Date("2026-07-13T08:00:00.000Z"),
          id: "program-2",
        },
      },
      methodologyLoader,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          OR: [
            { createdAt: { lt: new Date("2026-07-13T08:00:00.000Z") } },
            {
              createdAt: new Date("2026-07-13T08:00:00.000Z"),
              id: { lt: "program-2" },
            },
          ],
        },
        take: 6,
      }),
    );
    expect(result.entries[0]!.items[0]).toMatchObject({
      label: "analyse_own_games",
      dimensionLabels: ["calculation"],
      rationale: { citationSource: null },
    });
    expect(result.nextCursor).toBeNull();
  });

  it("surfaces unexpected methodology loader failures", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        program("program-1", new Date("2026-07-13T08:00:00.000Z"), [
          item("item-1", [], 10),
        ]),
      ]);
    const invalidLoader = vi.fn(() => {
      throw new Error("invalid methodology config");
    });

    await expect(
      getProgramHistory(
        { program: { findMany } } as never,
        "user-1",
        { limit: 5 },
        invalidLoader,
      ),
    ).rejects.toThrow("invalid methodology config");
  });
});
