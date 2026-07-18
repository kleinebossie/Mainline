import type { PrismaClient } from "@prisma/client";

import { DAY_MS, systemClock, type Clock } from "@/lib/clock";
import { recordEngagementForMissedDay } from "@/server/engagement";
import { importClaimedConnection } from "@/server/import";
import { runJob } from "@/server/jobs";
import { ACCOUNT_PURGE_JOB_KIND, runAccountPurge } from "@/server/account";
import { runDailyAdaptation } from "@/server/tracker";
import { lockUserProgramMutation } from "@/db/user-mutation-lock";

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

export const RETRYABLE_JOB_KINDS = [
  ACCOUNT_PURGE_JOB_KIND,
  "daily_adaptation",
  "day_missed",
  "import_sync",
] as const;

export interface RetryJobResult {
  state: "completed" | "skipped";
  kind?: (typeof RETRYABLE_JOB_KINDS)[number];
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
  return db.$transaction(async (tx) => {
    const [userCandidates, connectionCandidates] = await Promise.all([
      tx.user.findMany({
        where: { deletedAt: null },
        select: { id: true },
      }),
      tx.platformConnection.findMany({
        where: { status: { not: "revoked" }, user: { deletedAt: null } },
        select: { id: true, userId: true },
      }),
    ]);
    const userIds = [
      ...new Set([
        ...userCandidates.map((user) => user.id),
        ...connectionCandidates.map((connection) => connection.userId),
      ]),
    ].sort();
    for (const userId of userIds) {
      await lockUserProgramMutation(tx, userId);
    }

    const [users, connections, purges] = await Promise.all([
      tx.user.findMany({
        where: { id: { in: userIds }, deletedAt: null },
        select: { id: true },
      }),
      tx.platformConnection.findMany({
        where: {
          id: { in: connectionCandidates.map((connection) => connection.id) },
          status: { not: "revoked" },
          user: { deletedAt: null },
        },
        select: { id: true },
      }),
      tx.accountPurgeLedger.findMany({
        where: { completedAt: null },
        select: { token: true },
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
      ...purges.map((purge) => ({
        kind: ACCOUNT_PURGE_JOB_KIND,
        key: `account_purge:${purge.token}`,
      })),
    ];
    const created = jobs.length
      ? await tx.jobRun.createMany({
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
  });
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
        status: { in: ["success", "error"] },
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
      attempt: true,
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

  const removeOrphanedUserJob = async (userId: string): Promise<boolean> => {
    const user = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (user) return false;
    const removed = await db.jobRun.deleteMany({
      where: {
        id: jobId,
        key: job.key,
        attempt: job.attempt,
        OR: [
          { status: { in: ["queued", "error"] } },
          { status: "running", lockedUntil: { lte: new Date(clock.now()) } },
        ],
      },
    });
    return removed.count === 1;
  };

  const parts = job.key.split(":");
  if (job.kind === "daily_adaptation") {
    const userId = parts.at(-1);
    if (!userId) return { state: "skipped" };
    if (await removeOrphanedUserJob(userId)) return { state: "completed" };
    const result = await runJob(db, {
      kind: job.kind,
      key: job.key,
      clock,
      owner: { userId },
      run: (claim) => runDailyAdaptation(db, userId, clock, claim),
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
    if (await removeOrphanedUserJob(userId)) return { state: "completed" };
    const result = await runJob(db, {
      kind: job.kind,
      key: job.key,
      clock,
      owner: { userId },
      run: (claim) => recordEngagementForMissedDay(db, userId, missedAt, claim),
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
    if (!connection) {
      const removed = await db.jobRun.deleteMany({
        where: {
          id: jobId,
          key: job.key,
          attempt: job.attempt,
          OR: [
            { status: { in: ["queued", "error"] } },
            { status: "running", lockedUntil: { lte: new Date(clock.now()) } },
          ],
        },
      });
      return removed.count === 1
        ? { state: "completed", kind: "import_sync", imported: 0 }
        : { state: "skipped" };
    }
    const result = await runJob(db, {
      kind: job.kind,
      key: job.key,
      clock,
      owner: { userId: connection.userId, connectionId: connection.id },
      run: (claim) =>
        importClaimedConnection(
          db,
          connection.userId,
          connection.id,
          claim,
          clock,
        ),
    });
    return {
      state: result.state === "completed" ? "completed" : "skipped",
      kind: "import_sync",
      imported:
        result.state === "completed" ? (result.value?.imported ?? 0) : 0,
    };
  }

  if (job.kind === ACCOUNT_PURGE_JOB_KIND) {
    const token = parts.at(-1);
    if (!token) return { state: "skipped" };
    const result = await runAccountPurge(db, token, clock);
    return {
      state: result.state === "completed" ? "completed" : "skipped",
      kind: "account_purge",
    };
  }

  return { state: "skipped" };
}
