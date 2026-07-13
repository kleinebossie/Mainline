import { Prisma, type PrismaClient } from "@prisma/client";

import { systemClock, type Clock } from "@/lib/clock";
import { captureOperationalEvent } from "@/server/observability";

type JobDb = Pick<PrismaClient, "jobRun">;

const DEFAULT_LEASE_MS = 55_000;

export type JobResult<T> =
  | { state: "completed"; value: T; attempt: number }
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

/**
 * Claim and run one job. A successful key is immutable, concurrent live claims skip,
 * and failed or stale claims can be retried with an incremented attempt number.
 */
export async function runJob<T>(
  db: JobDb,
  input: {
    kind: string;
    key: string;
    run: () => Promise<T>;
    clock?: Clock;
    leaseMs?: number;
  },
): Promise<JobResult<T>> {
  const clock = input.clock ?? systemClock;
  const startedAt = new Date(clock.now());
  const lockedUntil = new Date(
    startedAt.getTime() + (input.leaseMs ?? DEFAULT_LEASE_MS),
  );
  let attempt = 1;

  try {
    await db.jobRun.create({
      data: {
        kind: input.kind,
        key: input.key,
        status: "running",
        attempt,
        startedAt,
        lockedUntil,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;

    const current = await db.jobRun.findUnique({
      where: { key: input.key },
      select: { status: true, attempt: true, lockedUntil: true },
    });
    if (!current || current.status === "success") {
      return { state: "skipped", reason: "complete" };
    }
    if (
      current.status === "running" &&
      current.lockedUntil &&
      current.lockedUntil > startedAt
    ) {
      return { state: "skipped", reason: "active" };
    }

    attempt = current.attempt + 1;
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
    if (claimed.count === 0) return { state: "skipped", reason: "active" };
  }

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
    const value = await input.run();
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
    await db.jobRun.updateMany({
      where: { key: input.key, attempt, status: "running" },
      data: {
        status: "error",
        finishedAt,
        lockedUntil: null,
        error: "Job failed. Retry is safe.",
        errorCode,
      },
    });
    captureOperationalEvent({
      operation: "job",
      status: "error",
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      jobKind: input.kind,
    });
    throw error;
  }
}
