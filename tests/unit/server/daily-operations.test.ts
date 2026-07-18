import { beforeEach, describe, expect, it, vi } from "vitest";

const maintenance = vi.hoisted(() => ({
  RETRYABLE_JOB_KINDS: [
    "account_purge",
    "daily_adaptation",
    "day_missed",
    "import_sync",
  ],
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

  it("prunes, persists the queue, then prioritizes local maintenance", async () => {
    const candidates = [
      { id: "import", kind: "import_sync", key: "import_sync:k" },
      {
        id: "adapt",
        kind: "daily_adaptation",
        key: "daily_adaptation:k",
      },
      { id: "missed", kind: "day_missed", key: "day_missed:k" },
      { id: "purge", kind: "account_purge", key: "account_purge:k" },
    ];
    const db = {
      jobRun: {
        findMany: vi.fn(
          ({ where }: { where: { kind: string }; take: number }) =>
            Promise.resolve(
              candidates.filter((candidate) => candidate.kind === where.kind),
            ),
        ),
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
    expect(maintenance.pruneOperationalRows).toHaveBeenCalledOnce();
    expect(
      maintenance.pruneOperationalRows.mock.invocationCallOrder[0],
    ).toBeLessThan(
      maintenance.enqueueDailyWork.mock.invocationCallOrder[0] ??
        Number.MAX_SAFE_INTEGER,
    );
    expect(
      maintenance.enqueueDailyWork.mock.invocationCallOrder[0],
    ).toBeLessThan(
      db.jobRun.findMany.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(
      db.jobRun.findMany.mock.calls.map((call) => call[0].where.kind),
    ).toEqual([
      "account_purge",
      "daily_adaptation",
      "day_missed",
      "import_sync",
    ]);
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
        findMany: vi.fn(
          ({ where }: { where: { kind: string }; take: number }) =>
            Promise.resolve(
              where.kind === "daily_adaptation"
                ? [
                    {
                      id: "adapt",
                      kind: "daily_adaptation",
                      key: "daily_adaptation:k",
                    },
                  ]
                : [],
            ),
        ),
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

  it("reserves the bounded candidate window for account purge priority", async () => {
    const oldAdaptations = Array.from({ length: 500 }, (_, index) => ({
      id: `adapt-${index}`,
      kind: "daily_adaptation",
      key: `daily_adaptation:${index}`,
    }));
    const purge = {
      id: "newer-purge",
      kind: "account_purge",
      key: "account_purge:opaque",
    };
    const db = {
      jobRun: {
        findMany: vi.fn(
          ({ where }: { where: { kind: string }; take: number }) =>
            Promise.resolve(
              where.kind === "account_purge"
                ? [purge]
                : where.kind === "daily_adaptation"
                  ? oldAdaptations.slice(0, 499)
                  : [],
            ),
        ),
        count: vi.fn().mockResolvedValue(500),
      },
    };
    maintenance.retryFailedJob.mockResolvedValue({ state: "skipped" });

    await runDailyOperations(db as never, { now: () => 1_000 }, 100_000);

    expect(maintenance.retryFailedJob).toHaveBeenCalledTimes(500);
    expect(maintenance.retryFailedJob.mock.calls[0]?.[1]).toBe("newer-purge");
    expect(db.jobRun.findMany).toHaveBeenCalledTimes(2);
    expect(db.jobRun.findMany.mock.calls[1]?.[0].take).toBe(499);
  });
});
