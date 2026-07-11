import type { PrismaClient } from "@prisma/client";

import { DAY_MS, systemClock, type Clock } from "@/lib/clock";
import { recordEngagementForMissedDay } from "@/server/engagement";
import { importConnection } from "@/server/import";
import { runJob } from "@/server/jobs";
import { runDailyAdaptation } from "@/server/tracker";

export interface MaintenanceSummary {
  users: number;
  adaptationRuns: number;
  missedDayEvents: number;
  prunedBudgetBuckets: number;
  prunedJobRuns: number;
  errors: number;
}

function utcDayStart(epoch: number): number {
  const date = new Date(epoch);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

export async function runScheduledMaintenance(
  db: PrismaClient,
  clock: Clock = systemClock,
): Promise<MaintenanceSummary> {
  const now = clock.now();
  const today = utcDayStart(now);
  const yesterday = today - DAY_MS;
  const dayKey = new Date(today).toISOString().slice(0, 10);
  const missedKey = new Date(yesterday).toISOString().slice(0, 10);
  const users = await db.user.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  const summary: MaintenanceSummary = {
    users: users.length,
    adaptationRuns: 0,
    missedDayEvents: 0,
    prunedBudgetBuckets: 0,
    prunedJobRuns: 0,
    errors: 0,
  };

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
  summary.prunedBudgetBuckets = budgets.count;
  summary.prunedJobRuns = jobs.count;

  for (const user of users) {
    try {
      const result = await runJob(db, {
        kind: "daily_adaptation",
        key: `daily_adaptation:${dayKey}:${user.id}`,
        clock,
        run: () => runDailyAdaptation(db, user.id, clock),
      });
      if (result.state === "completed") summary.adaptationRuns += 1;
    } catch {
      summary.errors += 1;
    }

    try {
      const result = await runJob(db, {
        kind: "day_missed",
        key: `day_missed:${missedKey}:${user.id}`,
        clock,
        run: () => recordEngagementForMissedDay(db, user.id, yesterday),
      });
      if (result.state === "completed" && result.value.recorded) {
        summary.missedDayEvents += 1;
      }
    } catch {
      summary.errors += 1;
    }
  }

  return summary;
}

export async function retryFailedJob(
  db: PrismaClient,
  jobId: string,
  clock: Clock = systemClock,
): Promise<{ state: "completed" | "skipped" }> {
  const job = await db.jobRun.findUnique({
    where: { id: jobId },
    select: { kind: true, key: true, status: true },
  });
  if (!job || job.status !== "error") return { state: "skipped" };

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
    return { state: result.state === "completed" ? "completed" : "skipped" };
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
    return { state: result.state === "completed" ? "completed" : "skipped" };
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
    return { state: result.state === "completed" ? "completed" : "skipped" };
  }

  return { state: "skipped" };
}
