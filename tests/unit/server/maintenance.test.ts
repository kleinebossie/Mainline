import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { fixedClock } from "@/lib/clock";
import {
  enqueueDailyWork,
  pruneOperationalRows,
  retryFailedJob,
} from "@/server/maintenance";

describe("daily job queue", () => {
  it("prunes old successful and failed job rows", async () => {
    const deleteJobs = vi.fn().mockResolvedValue({ count: 4 });
    const db = {
      apiCallBudget: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      jobRun: { deleteMany: deleteJobs },
    };

    await expect(
      pruneOperationalRows(
        db as never,
        fixedClock(Date.parse("2026-07-16T12:00:00.000Z")),
      ),
    ).resolves.toEqual({ prunedBudgetBuckets: 2, prunedJobRuns: 4 });
    expect(deleteJobs).toHaveBeenCalledWith({
      where: {
        status: { in: ["success", "error"] },
        finishedAt: { lt: new Date("2026-06-16T00:00:00.000Z") },
      },
    });
  });

  it("persists every user's local jobs and every connection import in one batch", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 5 });
    const db = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: "u1" }, { id: "u2" }]),
      },
      platformConnection: {
        findMany: vi.fn().mockResolvedValue([{ id: "c1" }]),
      },
      accountPurgeLedger: { findMany: vi.fn().mockResolvedValue([]) },
      jobRun: { createMany },
    };

    await expect(
      enqueueDailyWork(
        db as never,
        fixedClock(Date.parse("2026-07-11T12:00:00.000Z")),
      ),
    ).resolves.toEqual({ users: 2, connections: 1, enqueued: 5 });
    const jobs = createMany.mock.calls[0]?.[0].data as {
      kind: string;
      key: string;
      status: string;
      attempt: number;
    }[];
    expect(jobs).toHaveLength(5);
    expect(jobs.map((job) => job.kind)).toEqual([
      "daily_adaptation",
      "day_missed",
      "daily_adaptation",
      "day_missed",
      "import_sync",
    ]);
    expect(
      jobs.every((job) => job.status === "queued" && job.attempt === 0),
    ).toBe(true);
    expect(createMany.mock.calls[0]?.[0].skipDuplicates).toBe(true);
  });

  it("re-enqueues every incomplete purge ledger for recovery", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      user: { findMany: vi.fn().mockResolvedValue([]) },
      platformConnection: { findMany: vi.fn().mockResolvedValue([]) },
      accountPurgeLedger: {
        findMany: vi.fn().mockResolvedValue([{ token: "opaque" }]),
      },
      jobRun: { createMany },
    };

    await expect(
      enqueueDailyWork(db as never, fixedClock(1000)),
    ).resolves.toEqual({ users: 0, connections: 0, enqueued: 1 });
    expect(createMany.mock.calls[0]?.[0].data).toEqual([
      expect.objectContaining({
        kind: "account_purge",
        key: "account_purge:opaque",
        status: "queued",
        attempt: 0,
      }),
    ]);
  });

  it("dispatches a queued account purge through retry recovery", async () => {
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint",
      { code: "P2002", clientVersion: "test" },
    );
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      accountPurgeLedger: { update: vi.fn().mockResolvedValue({}) },
    };
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "account_purge",
        key: "account_purge:opaque",
        status: "queued",
        lockedUntil: null,
      })
      .mockResolvedValueOnce({
        status: "queued",
        attempt: 0,
        lockedUntil: null,
      });
    const db = {
      jobRun: {
        findUnique,
        create: vi.fn().mockRejectedValue(uniqueConflict),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      accountPurgeLedger: {
        findUnique: vi.fn().mockResolvedValue({ completedAt: null }),
      },
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    };

    await expect(
      retryFailedJob(db as never, "job-id", fixedClock(5000)),
    ).resolves.toEqual({ state: "completed", kind: "account_purge" });
    expect(findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: "job-id" },
      select: {
        kind: true,
        key: true,
        status: true,
        lockedUntil: true,
      },
    });
    expect(db.jobRun.deleteMany).toHaveBeenCalledWith({
      where: { key: "account_purge:opaque" },
    });
  });
});
