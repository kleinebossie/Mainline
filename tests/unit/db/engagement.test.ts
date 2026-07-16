import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { countCompletedActivities, findActiveDayEpochs } from "@/db/engagement";

function fakeActivityEventDb() {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  const db = {
    activityEvent: { findMany, count },
  } as unknown as PrismaClient;
  return { db, findMany, count };
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
      },
      select: { occurredAt: true },
    });
  });
});

describe("countCompletedActivities", () => {
  it("excludes both skip and skip_undone events from the completed count", async () => {
    const { db, count } = fakeActivityEventDb();

    await countCompletedActivities(db, "u1");

    expect(count).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        type: { notIn: ["skip", "skip_undone"] },
      },
    });
  });
});
