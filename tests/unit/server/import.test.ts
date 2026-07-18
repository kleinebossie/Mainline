import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { fixedClock } from "@/lib/clock";
import { withJobRun } from "@/server/import";
import { runJob } from "@/server/jobs";

const NOW = 1_700_000_000_000;

interface JobRow {
  id: string;
  kind: string;
  key: string;
  status: string;
  attempt: number;
  startedAt: Date;
  finishedAt: Date | null;
  lockedUntil: Date | null;
  error: string | null;
  errorCode: string | null;
}

function uniqueConflict() {
  return new Prisma.PrismaClientKnownRequestError("unique", {
    code: "P2002",
    clientVersion: "test",
  });
}

function fakeDb(initial?: Partial<JobRow>, currentNow = () => NOW) {
  let row: JobRow | null = initial
    ? {
        id: "job-1",
        kind: "import_sync",
        key: "k1",
        status: "running",
        attempt: 1,
        startedAt: new Date(NOW),
        finishedAt: null,
        lockedUntil: null,
        error: null,
        errorCode: null,
        ...initial,
      }
    : null;

  const jobRun = {
    createMany: vi.fn(),
    create: vi.fn(async ({ data }: { data: Partial<JobRow> }) => {
      if (row) throw uniqueConflict();
      row = {
        id: "job-1",
        kind: data.kind ?? "import_sync",
        key: data.key ?? "k1",
        status: data.status ?? "running",
        attempt: data.attempt ?? 1,
        startedAt: data.startedAt ?? new Date(NOW),
        finishedAt: data.finishedAt ?? null,
        lockedUntil: data.lockedUntil ?? null,
        error: data.error ?? null,
        errorCode: data.errorCode ?? null,
      };
      return row;
    }),
    findUnique: vi.fn(async () => row),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: object;
      }) => {
        if (!row) return { count: 0 };
        if (where.key !== undefined && where.key !== row.key) {
          return { count: 0 };
        }
        if (where.attempt !== undefined && where.attempt !== row.attempt) {
          return { count: 0 };
        }
        if (typeof where.status === "string" && where.status !== row.status) {
          return { count: 0 };
        }
        const retryable =
          row.status === "queued" ||
          row.status === "error" ||
          (row.status === "running" &&
            row.lockedUntil !== null &&
            row.lockedUntil <= new Date(currentNow()));
        if (where.OR && !retryable) return { count: 0 };
        row = { ...row, ...data };
        return { count: 1 };
      },
    ),
    update: vi.fn(async ({ data }: { data: object }) => {
      if (!row) throw new Error("missing job");
      row = { ...row, ...data };
      return row;
    }),
  };
  return {
    db: { jobRun } as unknown as PrismaClient,
    jobRun,
    current: () => row,
  };
}

describe("withJobRun", () => {
  it("runs the body once and marks the key successful", async () => {
    const { db, current } = fakeDb();
    const fn = vi.fn().mockResolvedValue("ok");

    await expect(
      withJobRun(db, "import_sync", "k1", fn, fixedClock(NOW)),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
    expect(current()).toMatchObject({ status: "success", attempt: 1 });
  });

  it("skips a key that already completed", async () => {
    const { db } = fakeDb({ status: "success" });
    const fn = vi.fn();

    await expect(
      withJobRun(db, "import_sync", "k1", fn, fixedClock(NOW)),
    ).resolves.toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it("does not steal a live concurrent claim", async () => {
    const { db } = fakeDb({
      status: "running",
      lockedUntil: new Date(NOW + 1_000),
    });
    const fn = vi.fn();

    await expect(
      withJobRun(db, "import_sync", "k1", fn, fixedClock(NOW)),
    ).resolves.toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it("retries an errored claim and increments its attempt", async () => {
    const { db, current } = fakeDb({ status: "error", errorCode: "error" });

    await expect(
      withJobRun(
        db,
        "import_sync",
        "k1",
        () => Promise.resolve("retried"),
        fixedClock(NOW),
      ),
    ).resolves.toBe("retried");
    expect(current()).toMatchObject({ status: "success", attempt: 2 });
  });

  it("claims a queued job as its first attempt", async () => {
    const { db, current } = fakeDb({ status: "queued", attempt: 0 });

    await expect(
      withJobRun(
        db,
        "import_sync",
        "k1",
        () => Promise.resolve("queued"),
        fixedClock(NOW),
      ),
    ).resolves.toBe("queued");
    expect(current()).toMatchObject({ status: "success", attempt: 1 });
  });

  it("reclaims a stale running lease", async () => {
    const { db, current } = fakeDb({
      status: "running",
      lockedUntil: new Date(NOW - 1),
    });

    await withJobRun(
      db,
      "import_sync",
      "k1",
      () => Promise.resolve("recovered"),
      fixedClock(NOW),
    );
    expect(current()).toMatchObject({ status: "success", attempt: 2 });
  });

  it("records only a sanitized error code before rethrowing", async () => {
    const { db, current } = fakeDb();

    await expect(
      withJobRun(
        db,
        "import_sync",
        "k1",
        () => Promise.reject(new TypeError("PGN and token must not persist")),
        fixedClock(NOW),
      ),
    ).rejects.toThrow("PGN and token");
    expect(current()).toMatchObject({
      status: "error",
      errorCode: "typeerror",
      error: "Job failed. Retry is safe.",
    });
  });

  it("prevents an expired worker from overwriting a reclaimed attempt", async () => {
    let now = NOW;
    const { db, current } = fakeDb(undefined, () => now);
    let finishFirst: ((value: string) => void) | undefined;
    const firstBody = new Promise<string>((resolve) => {
      finishFirst = resolve;
    });
    const first = runJob(db, {
      kind: "import_sync",
      key: "k1",
      run: () => firstBody,
      clock: { now: () => now },
      leaseMs: 3_000,
    });
    await vi.waitFor(() =>
      expect(current()).toMatchObject({ status: "running", attempt: 1 }),
    );

    now += 3_001;
    await expect(
      runJob(db, {
        kind: "import_sync",
        key: "k1",
        run: () => Promise.resolve("second"),
        clock: { now: () => now },
        leaseMs: 3_000,
      }),
    ).resolves.toMatchObject({ state: "completed", attempt: 2 });

    finishFirst?.("first");
    await expect(first).resolves.toEqual({
      state: "skipped",
      reason: "superseded",
    });
    expect(current()).toMatchObject({ status: "success", attempt: 2 });
  });

  it("does not surface an expired worker error after a newer attempt succeeds", async () => {
    let now = NOW;
    const { db, current } = fakeDb(undefined, () => now);
    let failFirst: ((error: Error) => void) | undefined;
    const firstBody = new Promise<string>((_resolve, reject) => {
      failFirst = reject;
    });
    const first = runJob(db, {
      kind: "import_sync",
      key: "k1",
      run: () => firstBody,
      clock: { now: () => now },
      leaseMs: 3_000,
    });
    await vi.waitFor(() =>
      expect(current()).toMatchObject({ status: "running", attempt: 1 }),
    );

    now += 3_001;
    await expect(
      runJob(db, {
        kind: "import_sync",
        key: "k1",
        run: () => Promise.resolve("second"),
        clock: { now: () => now },
        leaseMs: 3_000,
      }),
    ).resolves.toMatchObject({ state: "completed", attempt: 2 });

    failFirst?.(new Error("old worker secret detail"));
    await expect(first).resolves.toEqual({
      state: "skipped",
      reason: "superseded",
    });
    expect(current()).toMatchObject({
      status: "success",
      attempt: 2,
      error: null,
      errorCode: null,
    });
  });
});
