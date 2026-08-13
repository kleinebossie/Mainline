import type { PrismaClient } from "@prisma/client";

type BetaAccessDb = Pick<PrismaClient, "user">;

export interface BetaAccessRequest {
  userId?: string | null;
  now: Date;
}

/**
 * Decide and record open-beta admission. Any non-deleted user is admitted.
 */
export async function admitBetaUser(
  db: BetaAccessDb,
  request: BetaAccessRequest,
): Promise<boolean> {
  const userId = request.userId ?? null;

  const existingUser = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          deletedAt: true,
          betaAccessGrantedAt: true,
        },
      })
    : null;
  if (existingUser?.deletedAt) return false;
  if (existingUser?.betaAccessGrantedAt) return true;

  if (existingUser && userId) {
    await db.user.update({
      where: { id: userId },
      data: { betaAccessGrantedAt: request.now },
    });
  }
  return true;
}
