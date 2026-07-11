import { describe, expect, it, vi } from "vitest";

import { fixedClock } from "@/lib/clock";
import { enqueueDailyWork } from "@/server/maintenance";

describe("daily job queue", () => {
  it("persists every user's local jobs and every connection import in one batch", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 5 });
    const db = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: "u1" }, { id: "u2" }]),
      },
      platformConnection: {
        findMany: vi.fn().mockResolvedValue([{ id: "c1" }]),
      },
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
});
