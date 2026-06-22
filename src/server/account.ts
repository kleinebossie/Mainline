// Account data service (VISION §7 — GDPR-aligned export & erase). Plain DB gathering and a
// soft-delete; no business logic decisions. Export returns the user's own data as a
// JSON-serialisable object; erase sets the soft-delete marker (a later purge cron does the
// hard delete). OAuth credentials (access/refresh tokens) are deliberately excluded from the
// export — they are credentials, not user data, and must not land in a downloaded file.

import type { PrismaClient } from "@prisma/client";

type Db = Pick<
  PrismaClient,
  | "user"
  | "platformConnection"
  | "chessProfileSnapshot"
  | "importedGame"
  | "assessment"
  | "constraintSet"
  | "program"
  | "skillState"
  | "scheduleState"
  | "adaptationLog"
  | "activityEvent"
  | "rewardEvent"
  | "notificationPref"
>;

/** The user's own data, shaped for a portable JSON download (no credentials). */
export async function exportUserData(
  db: Db,
  userId: string,
): Promise<Record<string, unknown>> {
  const [
    user,
    connections,
    snapshots,
    games,
    assessment,
    constraintSets,
    programs,
    skillStates,
    scheduleStates,
    adaptationLogs,
    activityEvents,
    rewardEvents,
    notificationPref,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        locale: true,
        role: true,
        patronStatus: true,
        createdAt: true,
      },
    }),
    db.platformConnection.findMany({
      where: { userId },
      // No tokens: select only non-credential fields.
      select: {
        platform: true,
        externalUsername: true,
        status: true,
        connectedAt: true,
        lastSyncedAt: true,
      },
    }),
    db.chessProfileSnapshot.findMany({ where: { userId } }),
    db.importedGame.findMany({ where: { userId } }),
    db.assessment.findUnique({ where: { userId } }),
    db.constraintSet.findMany({ where: { userId } }),
    db.program.findMany({ where: { userId }, include: { items: true } }),
    db.skillState.findMany({ where: { userId } }),
    db.scheduleState.findMany({ where: { userId } }),
    db.adaptationLog.findMany({ where: { userId } }),
    db.activityEvent.findMany({ where: { userId } }),
    db.rewardEvent.findMany({ where: { userId } }),
    db.notificationPref.findUnique({ where: { userId } }),
  ]);

  return {
    exportFormat: "mainline-user-export/v1",
    user,
    connections,
    chessProfileSnapshots: snapshots,
    importedGames: games,
    assessment,
    constraintSets,
    programs,
    skillStates,
    scheduleStates,
    adaptationLogs,
    activityEvents,
    rewardEvents,
    notificationPref,
  };
}

/** Mark the account for erasure (soft-delete). Returns nothing; the caller signs the user
 *  out. A later purge job performs the hard delete (cascades to all user-owned rows). */
export async function softDeleteUser(
  db: Pick<PrismaClient, "user">,
  userId: string,
  deletedAt: Date,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { deletedAt },
  });
}
