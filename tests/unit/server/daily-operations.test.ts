import { beforeEach, describe, expect, it, vi } from "vitest";

const maintenance = vi.hoisted(() => ({
  enqueueDailyWork: vi.fn(),
  pruneOperationalRows: vi.fn(),
  retryFailedJob: vi.fn(),
}));

vi.mock("@/server/maintenance", () => maintenance);

import { runDailyOperations } from "@/server/daily-operations";

describe("daily operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maintenance.enqueueDailyWork.mockResolvedValue({
      users: 2,
      connections: 1,
      enqueued: 5,
    });
    maintenance.pruneOperationalRows.mockResolvedValue({
      prunedBudgetBuckets: 2,
      prunedJobRuns: 3,
    });
  });

  it("persists the queue before draining and prioritizes local maintenance", async () => {
    const db = {
      jobRun: {
        findMany: vi.fn().mockResolvedValue([
          { id: "import", kind: "import_sync", key: "import_sync:k" },
          {
            id: "adapt",
            kind: "daily_adaptation",
            key: "daily_adaptation:k",
          },
          { id: "missed", kind: "day_missed", key: "day_missed:k" },
          { id: "purge", kind: "account_purge", key: "account_purge:k" },
        ]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    maintenance.retryFailedJob
      .mockResolvedValueOnce({ state: "completed", kind: "account_purge" })
      .mockResolvedValueOnce({ state: "completed", kind: "daily_adaptation" })
      .mockResolvedValueOnce({
        state: "completed",
        kind: "day_missed",
        missedDayEvent: true,
      })
      .mockResolvedValueOnce({
        state: "completed",
        kind: "import_sync",
        imported: 4,
      });

    const result = await runDailyOperations(
      db as never,
      { now: () => 1_000 },
      100_000,
    );

    expect(maintenance.enqueueDailyWork).toHaveBeenCalledOnce();
    expect(
      maintenance.enqueueDailyWork.mock.invocationCallOrder[0],
    ).toBeLessThan(
      db.jobRun.findMany.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(
      maintenance.retryFailedJob.mock.calls.map((call) => call[1]),
    ).toEqual(["purge", "adapt", "missed", "import"]);
    expect(result).toMatchObject({
      import: { users: 1, imported: 4, errors: 0 },
      maintenance: {
        users: 2,
        adaptationRuns: 1,
        missedDayEvents: 1,
      },
      queue: { enqueued: 5, processed: 4, remaining: 1 },
    });
  });

  it("leaves queued work untouched when the safe start deadline is exhausted", async () => {
    const db = {
      jobRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "adapt",
            kind: "daily_adaptation",
            key: "daily_adaptation:k",
          },
        ]),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    const result = await runDailyOperations(
      db as never,
      { now: () => 1_000 },
      20_000,
    );

    expect(maintenance.retryFailedJob).not.toHaveBeenCalled();
    expect(result.queue).toMatchObject({
      processed: 0,
      remaining: 1,
      deadlineReached: true,
    });
  });
});
