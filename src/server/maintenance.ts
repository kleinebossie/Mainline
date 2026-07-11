import type { PrismaClient } from "@prisma/client";

import { DAY_MS, systemClock, type Clock } from "@/lib/clock";
import { recordEngagementForMissedDay } from "@/server/engagement";
import { importConnection } from "@/server/import";
import { runJob } from "@/server/jobs";
import { runDailyAdaptation } from "@/server/tracker";

export interface DailyQueueSummary {
  users: number;
  connections: number;
  enqueued: number;
}

export interface MaintenanceSummary {
  users: number;
  adaptationRuns: number;
  missedDayEvents: number;
  prunedBudgetBuckets: number;
  prunedJobRuns: number;
  errors: number;
}

export interface RetryJobResult {
  state: "completed" | "skipped";
  kind?: "daily_adaptation" | "day_missed" | "import_sync";
  imported?: number;
  missedDayEvent?: boolean;
}

function utcDayStart(epoch: number): number {
  const date = new Date(epoch);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/** Persist the full daily workload before any slow external request starts. */
export async function enqueueDailyWork(
  db: PrismaClient,
  clock: Clock = systemClock,
): Promise<DailyQueueSummary> {
  const today = utcDayStart(clock.now());
  const yesterday = today - DAY_MS;
  const dayKey = new Date(today).toISOString().slice(0, 10);
  const missedKey = new Date(yesterday).toISOString().slice(0, 10);
  const [users, connections] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null },
      select: { id: true },
    }),
    db.platformConnection.findMany({
      where: { status: { not: "revoked" }, user: { deletedAt: null } },
      select: { id: true },
    }),
  ]);

  const jobs = [
    ...users.flatMap((user) => [
      {
        kind: "daily_adaptation",
        key: `daily_adaptation:${dayKey}:${user.id}`,
      },
      { kind: "day_missed", key: `day_missed:${missedKey}:${user.id}` },
    ]),
    ...connections.map((connection) => ({
      kind: "import_sync",
      key: `import_sync:daily:${dayKey}:${connection.id}`,
    })),
  ];
  const created = jobs.length
    ? await db.jobRun.createMany({
        data: jobs.map((job) => ({
          ...job,
          status: "queued",
          attempt: 0,
          lockedUntil: null,
        })),
        skipDuplicates: true,
      })
    : { count: 0 };

  return {
    users: users.length,
    connections: connections.length,
    enqueued: created.count,
  };
}

/** Bounded pruning only. Daily jobs are enqueued and drained separately. */
export async function pruneOperationalRows(
  db: PrismaClient,
  clock: Clock = systemClock,
): Promise<Pick<MaintenanceSummary, "prunedBudgetBuckets" | "prunedJobRuns">> {
  const today = utcDayStart(clock.now());
  const [budgets, jobs] = await Promise.all([
    db.apiCallBudget.deleteMany({
      where: { windowStart: { lt: new Date(today - 7 * DAY_MS) } },
    }),
    db.jobRun.deleteMany({
      where: {
        status: "success",
        finishedAt: { lt: new Date(today - 30 * DAY_MS) },
      },
    }),
  ]);
  return {
    prunedBudgetBuckets: budgets.count,
    prunedJobRuns: jobs.count,
  };
}

/** Run one known queued, failed, or stale job through the fenced job runner. */
export async function retryFailedJob(
  db: PrismaClient,
  jobId: string,
  clock: Clock = systemClock,
): Promise<RetryJobResult> {
  const job = await db.jobRun.findUnique({
    where: { id: jobId },
    select: {
      kind: true,
      key: true,
      status: true,
      lockedUntil: true,
    },
  });
  const retryable =
    job &&
    (job.status === "queued" ||
      job.status === "error" ||
      (job.status === "running" &&
        job.lockedUntil !== null &&
        job.lockedUntil <= new Date(clock.now())));
  if (!job || !retryable) return { state: "skipped" };

  const parts = job.key.split(":");
  if (job.kind === "daily_adaptation") {
    const userId = parts.at(-1);
    if (!userId) return { state: "skipped" };
    const result = await runJob(db, {
      kind: job.kind,
      key: job.key,
      clock,
      run: () => runDailyAdaptation(db, userId, clock),
    });
    return {
      state: result.state === "completed" ? "completed" : "skipped",
      kind: "daily_adaptation",
    };
  }

  if (job.kind === "day_missed") {
    const userId = parts.at(-1);
    const date = parts.at(-2);
    const missedAt = date ? Date.parse(`${date}T00:00:00.000Z`) : Number.NaN;
    if (!userId || !Number.isFinite(missedAt)) return { state: "skipped" };
    const result = await runJob(db, {
      kind: job.kind,
      key: job.key,
      clock,
      run: () => recordEngagementForMissedDay(db, userId, missedAt),
    });
    return {
      state: result.state === "completed" ? "completed" : "skipped",
      kind: "day_missed",
      missedDayEvent:
        result.state === "completed" ? result.value.recorded : false,
    };
  }

  if (job.kind === "import_sync") {
    const connectionId = parts.at(-1);
    if (!connectionId) return { state: "skipped" };
    const connection = await db.platformConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) return { state: "skipped" };
    const result = await runJob(db, {
      kind: job.kind,
      key: job.key,
      clock,
      run: () => importConnection(db, connection),
    });
    return {
      state: result.state === "completed" ? "completed" : "skipped",
      kind: "import_sync",
      imported: result.state === "completed" ? result.value.imported : 0,
    };
  }

  return { state: "skipped" };
}
