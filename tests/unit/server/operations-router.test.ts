import { beforeEach, describe, expect, it, vi } from "vitest";

const maintenance = vi.hoisted(() => ({
  RETRYABLE_JOB_KINDS: [
    "account_purge",
    "daily_adaptation",
    "day_missed",
    "import_sync",
  ],
  retryFailedJob: vi.fn(),
}));

vi.mock("@/server/maintenance", () => maintenance);

import { operationsRouter } from "@/server/routers/operations";

const STARTED_AT = new Date("2026-07-18T08:00:00.000Z");

function caller(role: "admin" | "user" = "admin") {
  const findMany = vi
    .fn()
    .mockResolvedValueOnce([
      {
        id: "stale",
        kind: "daily_adaptation",
        status: "running",
        attempt: 2,
        startedAt: STARTED_AT,
        finishedAt: null,
        lockedUntil: new Date("2026-07-18T08:00:01.000Z"),
        errorCode: null,
      },
    ])
    .mockResolvedValueOnce([
      {
        id: "success",
        kind: "import_sync",
        status: "success",
        attempt: 1,
        startedAt: STARTED_AT,
        finishedAt: STARTED_AT,
        lockedUntil: null,
        errorCode: null,
      },
    ]);
  const context = {
    session: { user: { id: "operator" }, expires: "2099-01-01" },
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          role,
          deletedAt: null,
          betaAccessGrantedAt: STARTED_AT,
        }),
      },
      jobRun: { findMany },
    },
  };
  return {
    api: operationsRouter.createCaller(context as never),
    findMany,
  };
}

describe("operations router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maintenance.retryFailedJob.mockResolvedValue({
      state: "completed",
      kind: "daily_adaptation",
    });
  });

  it("keeps actionable work visible ahead of recent successes", async () => {
    const { api, findMany } = caller();

    const jobs = await api.recentJobs();
    expect(jobs).toEqual([
      expect.objectContaining({ id: "stale", retryable: true }),
      expect.objectContaining({ id: "success", retryable: false }),
    ]);
    expect(Object.keys(jobs[0]!).sort()).toEqual(
      [
        "attempt",
        "errorCode",
        "finishedAt",
        "id",
        "kind",
        "lockedUntil",
        "retryable",
        "startedAt",
        "status",
      ].sort(),
    );
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      take: 50,
      where: {
        kind: {
          in: [
            "account_purge",
            "daily_adaptation",
            "day_missed",
            "import_sync",
          ],
        },
        OR: [
          { status: { in: ["queued", "error"] } },
          { status: "running", lockedUntil: { lte: expect.any(Date) } },
        ],
      },
    });
    expect(findMany.mock.calls[0]?.[0].select).toEqual({
      id: true,
      kind: true,
      status: true,
      attempt: true,
      startedAt: true,
      finishedAt: true,
      lockedUntil: true,
      errorCode: true,
    });
    expect(findMany.mock.calls[1]?.[0]).toMatchObject({
      take: 49,
      where: { id: { notIn: ["stale"] } },
    });
  });

  it("retries a selected stale job through the recovery service", async () => {
    const { api } = caller();

    await expect(api.retryJob({ id: "stale" })).resolves.toEqual({
      state: "completed",
      kind: "daily_adaptation",
    });
    expect(maintenance.retryFailedJob).toHaveBeenCalledWith(
      expect.anything(),
      "stale",
    );
  });

  it("denies status and retry controls to non-administrators", async () => {
    const { api } = caller("user");

    await expect(api.recentJobs()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.retryJob({ id: "stale" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(maintenance.retryFailedJob).not.toHaveBeenCalled();
  });
});
