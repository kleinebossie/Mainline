import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { countCompletedActivities, findActiveDayEpochs } from "@/db/engagement";

function fakeActivityEventDb() {
  const findMany = vi.fn().mockResolvedValue([]);
  const eventCount = vi.fn().mockResolvedValue(0);
  const itemCount = vi.fn().mockResolvedValue(0);
  const db = {
    activityEvent: { findMany, count: eventCount },
    programItem: { count: itemCount },
  } as unknown as PrismaClient;
  return { db, findMany, eventCount, itemCount };
}

describe("findActiveDayEpochs", () => {
  it("excludes both skip and skip_undone events from active-day epochs", async () => {
    const { db, findMany } = fakeActivityEventDb();
    const since = 1_700_000_000_000;

    await findActiveDayEpochs(db, "u1", since);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        type: { notIn: ["skip", "skip_undone"] },
        occurredAt: { gte: new Date(since) },
        OR: [
          { programItemId: null },
          { programItem: { is: { status: "done" } } },
        ],
      },
      select: { occurredAt: true, programItemId: true },
    });
  });

  it("counts a completed multi-outcome block on its final event only", async () => {
    const { db, findMany } = fakeActivityEventDb();
    findMany.mockResolvedValue([
      { programItemId: "item-1", occurredAt: new Date(100) },
      { programItemId: "item-1", occurredAt: new Date(200) },
      { programItemId: null, occurredAt: new Date(150) },
    ]);

    await expect(findActiveDayEpochs(db, "u1", 0)).resolves.toEqual([150, 200]);
  });
});

describe("countCompletedActivities", () => {
  it("counts each completed program item once plus standalone completions", async () => {
    const { db, eventCount, itemCount } = fakeActivityEventDb();
    itemCount.mockResolvedValue(3);
    eventCount.mockResolvedValue(2);

    await expect(countCompletedActivities(db, "u1")).resolves.toBe(5);

    expect(itemCount).toHaveBeenCalledWith({
      where: { program: { userId: "u1" }, status: "done" },
    });
    expect(eventCount).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        programItemId: null,
        type: { notIn: ["skip", "skip_undone"] },
      },
    });
  });
});
