import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { fixedClock } from "@/lib/clock";
import { withJobRun } from "@/server/import";

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

function fakeDb(initial?: Partial<JobRow>) {
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
        if (where.attempt !== undefined && where.attempt !== row.attempt) {
          return { count: 0 };
        }
        const retryable =
          row.status === "error" ||
          (row.status === "running" &&
            row.lockedUntil !== null &&
            row.lockedUntil <= new Date(NOW));
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
});
