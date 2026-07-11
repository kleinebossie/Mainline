import type { PrismaClient } from "@prisma/client";

import { systemClock, type Clock } from "@/lib/clock";
import {
  enqueueDailyWork,
  pruneOperationalRows,
  retryFailedJob,
  type MaintenanceSummary,
} from "@/server/maintenance";

const DEFAULT_RUN_WINDOW_MS = 50_000;
const MIN_JOB_START_BUDGET_MS = 35_000;
const DAILY_JOB_KINDS = [
  "daily_adaptation",
  "day_missed",
  "import_sync",
] as const;

export interface DailyOperationsSummary {
  import: { users: number; imported: number; errors: number };
  maintenance: MaintenanceSummary;
  queue: {
    enqueued: number;
    processed: number;
    remaining: number;
    deadlineReached: boolean;
  };
}

const JOB_PRIORITY: Record<(typeof DAILY_JOB_KINDS)[number], number> = {
  daily_adaptation: 0,
  day_missed: 1,
  import_sync: 2,
};

function isDailyJobKind(
  kind: string,
): kind is (typeof DAILY_JOB_KINDS)[number] {
  return DAILY_JOB_KINDS.includes(kind as (typeof DAILY_JOB_KINDS)[number]);
}

export async function runDailyOperations(
  db: PrismaClient,
  clock: Clock = systemClock,
  deadlineAt = clock.now() + DEFAULT_RUN_WINDOW_MS,
): Promise<DailyOperationsSummary> {
  const queue = await enqueueDailyWork(db, clock);
  const pruned = await pruneOperationalRows(db, clock);
  const now = new Date(clock.now());
  const candidates = await db.jobRun.findMany({
    where: {
      kind: { in: [...DAILY_JOB_KINDS] },
      OR: [
        { status: { in: ["queued", "error"] } },
        { status: "running", lockedUntil: { lte: now } },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { key: "asc" }],
    take: 500,
    select: { id: true, kind: true, key: true },
  });
  candidates.sort((left, right) => {
    const leftPriority = isDailyJobKind(left.kind)
      ? JOB_PRIORITY[left.kind]
      : Number.MAX_SAFE_INTEGER;
    const rightPriority = isDailyJobKind(right.kind)
      ? JOB_PRIORITY[right.kind]
      : Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority || left.key.localeCompare(right.key);
  });

  const maintenance: MaintenanceSummary = {
    users: queue.users,
    adaptationRuns: 0,
    missedDayEvents: 0,
    prunedBudgetBuckets: pruned.prunedBudgetBuckets,
    prunedJobRuns: pruned.prunedJobRuns,
    errors: 0,
  };
  let imported = 0;
  let importErrors = 0;
  let processed = 0;
  let deadlineReached = false;

  for (const candidate of candidates) {
    if (clock.now() + MIN_JOB_START_BUDGET_MS > deadlineAt) {
      deadlineReached = true;
      break;
    }
    try {
      const result = await retryFailedJob(db, candidate.id, clock);
      if (result.state !== "completed") continue;
      processed += 1;
      if (result.kind === "import_sync") {
        imported += result.imported ?? 0;
      } else if (result.kind === "daily_adaptation") {
        maintenance.adaptationRuns += 1;
      } else if (result.kind === "day_missed" && result.missedDayEvent) {
        maintenance.missedDayEvents += 1;
      }
    } catch {
      if (candidate.kind === "import_sync") importErrors += 1;
      else maintenance.errors += 1;
    }
  }

  const remaining = await db.jobRun.count({
    where: {
      kind: { in: [...DAILY_JOB_KINDS] },
      OR: [
        { status: { in: ["queued", "error"] } },
        { status: "running", lockedUntil: { lte: new Date(clock.now()) } },
      ],
    },
  });

  return {
    import: { users: queue.connections, imported, errors: importErrors },
    maintenance,
    queue: {
      enqueued: queue.enqueued,
      processed,
      remaining,
      deadlineReached,
    },
  };
}
