import type { PrismaClient } from "@prisma/client";

import { systemClock, type Clock } from "@/lib/clock";
import { runImportForUser } from "@/server/import";
import {
  runScheduledMaintenance,
  type MaintenanceSummary,
} from "@/server/maintenance";

export interface DailyOperationsSummary {
  import: { users: number; imported: number; errors: number };
  maintenance: MaintenanceSummary;
}

export async function runDailyOperations(
  db: PrismaClient,
  clock: Clock = systemClock,
): Promise<DailyOperationsSummary> {
  const day = new Date(clock.now()).toISOString().slice(0, 10);
  const userIds = (
    await db.platformConnection.findMany({
      where: { status: { not: "revoked" }, user: { deletedAt: null } },
      distinct: ["userId"],
      select: { userId: true },
    })
  ).map((row) => row.userId);

  let imported = 0;
  let importErrors = 0;
  for (const userId of userIds) {
    const summary = await runImportForUser(db, userId, `cron:${day}:${userId}`);
    imported += summary.results.reduce((count, row) => count + row.imported, 0);
    importErrors += summary.errors.length;
  }

  return {
    import: { users: userIds.length, imported, errors: importErrors },
    maintenance: await runScheduledMaintenance(db, clock),
  };
}
