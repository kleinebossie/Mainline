import type { PrismaClient } from "@prisma/client";

import { systemClock, type Clock } from "@/lib/clock";
import {
  enqueueDailyWork,
  pruneOperationalRows,
  RETRYABLE_JOB_KINDS,
  retryFailedJob,
  type MaintenanceSummary,
} from "@/server/maintenance";

const DEFAULT_RUN_WINDOW_MS = 50_000;
const MIN_JOB_START_BUDGET_MS = 35_000;
const DAILY_JOB_PRIORITY = RETRYABLE_JOB_KINDS;

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

interface DailyOperationsDependencies {
  enqueue: typeof enqueueDailyWork;
  prune: typeof pruneOperationalRows;
  retry: typeof retryFailedJob;
}

const DEFAULT_DEPENDENCIES: DailyOperationsDependencies = {
  enqueue: enqueueDailyWork,
  prune: pruneOperationalRows,
  retry: retryFailedJob,
};

export async function runDailyOperations(
  db: PrismaClient,
  clock: Clock = systemClock,
  deadlineAt = clock.now() + DEFAULT_RUN_WINDOW_MS,
  dependencies: DailyOperationsDependencies = DEFAULT_DEPENDENCIES,
): Promise<DailyOperationsSummary> {
  const pruned = await dependencies.prune(db, clock);
  // Prune first so an old failed account purge cannot block its ledger-backed
  // replacement through createMany(skipDuplicates), then disappear afterward.
  const queue = await dependencies.enqueue(db, clock);
  const now = new Date(clock.now());
  const candidates: { id: string; kind: string; key: string }[] = [];
  for (const kind of DAILY_JOB_PRIORITY) {
    const remainingCapacity = 500 - candidates.length;
    if (remainingCapacity === 0) break;
    const rows = await db.jobRun.findMany({
      where: {
        kind,
        OR: [
          { status: { in: ["queued", "error"] } },
          { status: "running", lockedUntil: { lte: now } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { key: "asc" }],
      take: remainingCapacity,
      select: { id: true, kind: true, key: true },
    });
    candidates.push(...rows);
  }

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
      const result = await dependencies.retry(db, candidate.id, clock);
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
      kind: { in: [...DAILY_JOB_PRIORITY] },
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
