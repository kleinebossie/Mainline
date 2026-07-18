import { Prisma, type PrismaClient } from "@prisma/client";

import { lockUserProgramMutation } from "@/db/user-mutation-lock";
import { systemClock, type Clock } from "@/lib/clock";
import { captureOperationalEvent } from "@/server/observability";

type JobDb = Pick<PrismaClient, "jobRun">;

const DEFAULT_LEASE_MS = 55_000;

export type JobResult<T> =
  | { state: "completed"; value: T; attempt: number }
  | { state: "skipped"; reason: "complete" | "active" | "superseded" };

export interface JobClaim {
  key: string;
  attempt: number;
}

export interface JobOwner {
  userId: string;
  connectionId?: string;
}

type ClaimResult =
  | { attempt: number }
  | { state: "skipped"; reason: "complete" | "active" | "superseded" };

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function safeJobErrorCode(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `prisma_${error.code.toLowerCase()}`;
  }
  if (error instanceof Error) {
    return error.name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase() || "error";
  }
  return "unknown_error";
}

async function claimJob(
  db: JobDb,
  input: { kind: string; key: string },
  startedAt: Date,
  lockedUntil: Date,
): Promise<ClaimResult> {
  try {
    await db.jobRun.create({
      data: {
        kind: input.kind,
        key: input.key,
        status: "running",
        attempt: 1,
        startedAt,
        lockedUntil,
      },
    });
    return { attempt: 1 };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;

    const current = await db.jobRun.findUnique({
      where: { key: input.key },
      select: { status: true, attempt: true, lockedUntil: true },
    });
    if (!current) return { state: "skipped", reason: "superseded" };
    return reclaimJob(db, input, current, startedAt, lockedUntil);
  }
}

async function reclaimJob(
  db: JobDb,
  input: { key: string },
  current: { status: string; attempt: number; lockedUntil: Date | null },
  startedAt: Date,
  lockedUntil: Date,
): Promise<ClaimResult> {
  if (current.status === "success") {
    return { state: "skipped", reason: "complete" };
  }
  if (
    current.status === "running" &&
    current.lockedUntil &&
    current.lockedUntil > startedAt
  ) {
    return { state: "skipped", reason: "active" };
  }

  const attempt = current.attempt + 1;
  const claimed = await db.jobRun.updateMany({
    where: {
      key: input.key,
      attempt: current.attempt,
      OR: [
        { status: "queued" },
        { status: "error" },
        { status: "running", lockedUntil: { lte: startedAt } },
      ],
    },
    data: {
      status: "running",
      attempt,
      startedAt,
      finishedAt: null,
      lockedUntil,
      error: null,
      errorCode: null,
    },
  });
  return claimed.count === 1
    ? { attempt }
    : { state: "skipped", reason: "active" };
}

async function claimOwnerJob(
  db: JobDb,
  input: { kind: string; key: string },
  startedAt: Date,
  lockedUntil: Date,
): Promise<ClaimResult> {
  const current = await db.jobRun.findUnique({
    where: { key: input.key },
    select: { status: true, attempt: true, lockedUntil: true },
  });
  if (current) {
    return reclaimJob(db, input, current, startedAt, lockedUntil);
  }
  await db.jobRun.create({
    data: {
      kind: input.kind,
      key: input.key,
      status: "running",
      attempt: 1,
      startedAt,
      lockedUntil,
    },
  });
  return { attempt: 1 };
}

/** Lock and verify the current attempt inside the transaction that writes job effects. */
export async function assertActiveJobClaim(
  db: Partial<Pick<Prisma.TransactionClient, "$queryRaw">>,
  claim: JobClaim,
): Promise<void> {
  if (typeof db.$queryRaw !== "function") return;
  const rows = await db.$queryRaw<Array<{ attempt: number; status: string }>>(
    Prisma.sql`
      SELECT "attempt", "status"
      FROM "JobRun"
      WHERE "key" = ${claim.key}
      FOR UPDATE
    `,
  );
  const row = rows[0];
  if (!row || row.attempt !== claim.attempt || row.status !== "running") {
    throw new Error("This job attempt was superseded.");
  }
}

/**
 * Claim and run one job. A successful key is immutable while its owner exists,
 * concurrent live claims skip, and failed or stale claims increment the attempt.
 * Owner deletion may erase correlatable keys as a privacy lifecycle exception.
 */
export async function runJob<T>(
  db: PrismaClient,
  input: {
    kind: string;
    key: string;
    run: (claim: JobClaim) => Promise<T>;
    clock?: Clock;
    leaseMs?: number;
    owner?: JobOwner;
  },
): Promise<JobResult<T>> {
  const clock = input.clock ?? systemClock;
  const startedAt = new Date(clock.now());
  const lockedUntil = new Date(
    startedAt.getTime() + (input.leaseMs ?? DEFAULT_LEASE_MS),
  );
  const owner = input.owner;
  const claimed = owner
    ? await db.$transaction(async (tx) => {
        await lockUserProgramMutation(tx, owner.userId);
        const user = await tx.user.findFirst({
          where: { id: owner.userId, deletedAt: null },
          select: { id: true },
        });
        const connection = owner.connectionId
          ? await tx.platformConnection.findFirst({
              where: {
                id: owner.connectionId,
                userId: owner.userId,
              },
              select: { id: true },
            })
          : { id: "not-required" };
        if (!user || !connection) {
          await tx.jobRun.deleteMany({ where: { key: input.key } });
          return { state: "skipped", reason: "superseded" } as const;
        }
        // The owner advisory lock serializes this read-before-create path with
        // enqueue, disconnect, and deletion. Avoid recovering from P2002 inside
        // an interactive PostgreSQL transaction because it aborts that transaction.
        return claimOwnerJob(tx, input, startedAt, lockedUntil);
      })
    : await claimJob(db, input, startedAt, lockedUntil);
  if ("state" in claimed) return claimed;
  const attempt = claimed.attempt;

  const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
  const heartbeatIntervalMs = Math.max(1_000, Math.floor(leaseMs / 3));
  let heartbeatInFlight = false;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    const renewedUntil = new Date(clock.now() + leaseMs);
    void db.jobRun
      .updateMany({
        where: { key: input.key, attempt, status: "running" },
        data: { lockedUntil: renewedUntil },
      })
      .catch(() => undefined)
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, heartbeatIntervalMs);
  heartbeat.unref?.();

  try {
    const value = await input.run({ key: input.key, attempt });
    const finishedAt = new Date(clock.now());
    clearInterval(heartbeat);
    const finalized = await db.jobRun.updateMany({
      where: { key: input.key, attempt, status: "running" },
      data: {
        status: "success",
        finishedAt,
        lockedUntil: null,
        error: null,
        errorCode: null,
      },
    });
    if (finalized.count === 0) {
      return { state: "skipped", reason: "superseded" };
    }
    captureOperationalEvent({
      operation: "job",
      status: "success",
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      jobKind: input.kind,
    });
    return { state: "completed", value, attempt };
  } catch (error) {
    clearInterval(heartbeat);
    const finishedAt = new Date(clock.now());
    const errorCode = safeJobErrorCode(error);
    const finalized = await db.jobRun.updateMany({
      where: { key: input.key, attempt, status: "running" },
      data: {
        status: "error",
        finishedAt,
        lockedUntil: null,
        error: "Job failed. Retry is safe.",
        errorCode,
      },
    });
    if (finalized.count === 0) {
      return { state: "skipped", reason: "superseded" };
    }
    captureOperationalEvent({
      operation: "job",
      status: "error",
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      jobKind: input.kind,
    });
    throw error;
  }
}
