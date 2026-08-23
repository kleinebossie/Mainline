import { describe, expect, it, vi } from "vitest";

import { reconcileAnalysisItems } from "@/server/analysis-reconcile";
import { loadMethodology } from "@/methodology";
import { fixedClock } from "@/lib/clock";
import { GAME_ANALYSED_ACTIVITY_EVENT_TYPE } from "@/lib/tracker";

describe("reconcileAnalysisItems", () => {
  const clock = fixedClock(new Date("2026-08-23T14:00:00Z").getTime());
  const cfg = loadMethodology();
  const scheduledDate = new Date("2026-08-23T00:00:00Z");

  function createMockDb(events: Array<{ payload?: unknown }>) {
    const findManyEvents = vi.fn().mockResolvedValue(events);
    const findFirstItem = vi.fn().mockResolvedValue({ id: "item1" });
    const updateItem = vi.fn().mockResolvedValue({ id: "item1" });
    const createEvent = vi.fn().mockResolvedValue({ id: "ev1" });
    const findUniqueEvent = vi.fn().mockResolvedValue(null);
    const findUniquePref = vi.fn().mockResolvedValue(null);
    const createReward = vi.fn().mockResolvedValue({ id: "rw1" });

    const tx = {
      activityEvent: {
        findUnique: findUniqueEvent,
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: createEvent,
      },
      programItem: {
        findFirst: findFirstItem,
        update: updateItem,
        count: vi.fn().mockResolvedValue(0),
      },
      notificationPref: {
        findUnique: findUniquePref,
      },
      rewardEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: createReward,
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $executeRaw: vi.fn(),
    };

    return {
      db: {
        activityEvent: { findMany: findManyEvents },
        $transaction: vi.fn(async (callback) => callback(tx)),
      },
      updateItem,
      findManyEvents,
    };
  }

  it("does nothing when the program contains no analyse items", async () => {
    const findMany = vi.fn();
    const db = { activityEvent: { findMany } };
    const program = {
      id: "prog1",
      scheduledDate,
      items: [
        {
          id: "item1",
          activityType: "puzzle_theme",
          status: "pending",
          params: {},
          estMinutes: 15,
        },
      ],
    };

    await reconcileAnalysisItems(db as never, "u1", program, cfg, clock);

    expect(findMany).not.toHaveBeenCalled();
    expect(program.items[0]?.status).toBe("pending");
  });

  it("does nothing when analyse items are already done or skipped", async () => {
    const findMany = vi.fn();
    const db = { activityEvent: { findMany } };
    const program = {
      id: "prog1",
      scheduledDate,
      items: [
        {
          id: "item1",
          activityType: "analyse",
          status: "done",
          params: {},
          estMinutes: 15,
        },
      ],
    };

    await reconcileAnalysisItems(db as never, "u1", program, cfg, clock);

    expect(findMany).not.toHaveBeenCalled();
  });

  it("completes pending analyse item when target review count is reached", async () => {
    const { db, updateItem, findManyEvents } = createMockDb([
      { payload: { gameId: "g1", durationSeconds: 600 } },
    ]);

    const program = {
      id: "prog1",
      scheduledDate,
      items: [
        {
          id: "item1",
          activityType: "analyse",
          status: "pending",
          params: { budgetMinutes: 15 },
          estMinutes: 15,
        },
      ],
    };

    await reconcileAnalysisItems(db as never, "u1", program, cfg, clock);

    expect(findManyEvents).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        type: GAME_ANALYSED_ACTIVITY_EVENT_TYPE,
        occurredAt: { gte: scheduledDate },
      },
      select: { payload: true },
    });
    expect(program.items[0]?.status).toBe("done");
    expect(updateItem).toHaveBeenCalledWith({
      where: { id: "item1" },
      data: { status: "done" },
    });
  });

  it("completes pending analyse item when accumulated duration reaches budget with at least one review", async () => {
    // 30 min budget -> target count is 2. 1 review finished with 35 min (2100s).
    const { db, updateItem } = createMockDb([
      { payload: { gameId: "g1", durationSeconds: 2100 } },
    ]);

    const program = {
      id: "prog1",
      scheduledDate,
      items: [
        {
          id: "item1",
          activityType: "analyse",
          status: "pending",
          params: { budgetMinutes: 30 },
          estMinutes: 30,
        },
      ],
    };

    await reconcileAnalysisItems(db as never, "u1", program, cfg, clock);

    expect(program.items[0]?.status).toBe("done");
    expect(updateItem).toHaveBeenCalled();
  });

  it("falls back missing duration to methodology average review minutes", async () => {
    // 30 min budget -> target count is 2. 2 reviews without durationSeconds -> 15 + 15 = 30 min.
    const { db, updateItem } = createMockDb([
      { payload: { gameId: "g1" } }, // missing duration -> 15 min
      { payload: { gameId: "g2" } }, // missing duration -> 15 min
    ]);

    const program = {
      id: "prog1",
      scheduledDate,
      items: [
        {
          id: "item1",
          activityType: "analyse",
          status: "pending",
          params: { budgetMinutes: 30 },
          estMinutes: 30,
        },
      ],
    };

    await reconcileAnalysisItems(db as never, "u1", program, cfg, clock);

    expect(program.items[0]?.status).toBe("done");
    expect(updateItem).toHaveBeenCalled();
  });

  it("does not complete when reviews do not meet target count and duration is under budget", async () => {
    // 30 min budget -> target count is 2. 1 review of 10 min (600s).
    const { db, updateItem } = createMockDb([
      { payload: { gameId: "g1", durationSeconds: 600 } },
    ]);

    const program = {
      id: "prog1",
      scheduledDate,
      items: [
        {
          id: "item1",
          activityType: "analyse",
          status: "pending",
          params: { budgetMinutes: 30 },
          estMinutes: 30,
        },
      ],
    };

    await reconcileAnalysisItems(db as never, "u1", program, cfg, clock);

    expect(program.items[0]?.status).toBe("pending");
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("handles concurrent conflict error gracefully during completion", async () => {
    const findManyEvents = vi
      .fn()
      .mockResolvedValue([
        { payload: { gameId: "g1", durationSeconds: 1200 } },
      ]);
    const findFirstItem = vi.fn().mockResolvedValue(null); // simulates item completed/status changed concurrently
    const findUniqueEvent = vi.fn().mockResolvedValue(null);

    const tx = {
      activityEvent: {
        findUnique: findUniqueEvent,
      },
      programItem: {
        findFirst: findFirstItem,
      },
      $executeRaw: vi.fn(),
    };

    const db = {
      activityEvent: { findMany: findManyEvents },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };

    const program = {
      id: "prog1",
      scheduledDate,
      items: [
        {
          id: "item1",
          activityType: "analyse",
          status: "pending",
          params: { budgetMinutes: 15 },
          estMinutes: 15,
        },
      ],
    };

    await expect(
      reconcileAnalysisItems(db as never, "u1", program, cfg, clock),
    ).resolves.toBeUndefined();

    expect(program.items[0]?.status).toBe("done");
  });

  it("returns early if methodology config has no analyse activity with estMinutes", async () => {
    const findMany = vi.fn();
    const db = { activityEvent: { findMany } };
    const customCfg = {
      ...cfg,
      activities: cfg.activities.filter(
        (a) => a.activityType !== "analyse" && a.id !== "analyse_own_games",
      ),
    };

    const program = {
      id: "prog1",
      scheduledDate,
      items: [
        {
          id: "item1",
          activityType: "analyse",
          status: "pending",
          params: {},
          estMinutes: 15,
        },
      ],
    };

    await reconcileAnalysisItems(db as never, "u1", program, customCfg as never, clock);

    expect(findMany).not.toHaveBeenCalled();
    expect(program.items[0]?.status).toBe("pending");
  });
});
