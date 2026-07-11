import type { PrismaClient } from "@prisma/client";

type BetaAccessDb = Pick<
  PrismaClient,
  "allowlistEntry" | "user" | "$transaction"
>;

export const BETA_INVITE_COOKIE = "mainline_beta_invite";

function normalizedEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

export function ownerEmailsFromEnv(
  value = process.env.BETA_OWNER_EMAILS,
): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => normalizedEmail(email))
      .filter((email): email is string => email !== null),
  );
}

export interface BetaAccessRequest {
  userId?: string | null;
  email?: string | null;
  inviteCode?: string | null;
  now: Date;
  ownerEmails?: ReadonlySet<string>;
}

/**
 * Decide and record closed-beta admission. Owner emails and an existing admin row
 * are explicit break-glass paths. All other users need a current email entry or a
 * current invite code. Claiming is conditional, so one code cannot admit two users.
 */
export async function admitBetaUser(
  db: BetaAccessDb,
  request: BetaAccessRequest,
): Promise<boolean> {
  const email = normalizedEmail(request.email);
  const userId = request.userId ?? null;
  const ownerEmails = request.ownerEmails ?? ownerEmailsFromEnv();

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

  const privileged =
    (email !== null && ownerEmails.has(email)) ||
    existingUser?.role === "admin";
  if (privileged) {
    if (existingUser && userId) {
      await db.user.update({
        where: { id: userId },
        data: { betaAccessGrantedAt: request.now },
      });
    }
    return true;
  }

  const inviteCode = request.inviteCode?.trim() || null;
  if (!email && !inviteCode) return false;

  const entry = await db.allowlistEntry.findFirst({
    where: {
      AND: [
        {
          OR: [
            ...(email
              ? [{ email: { equals: email, mode: "insensitive" as const } }]
              : []),
            ...(inviteCode ? [{ inviteCode }] : []),
          ],
        },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: request.now } }] },
        {
          OR: [
            { usedByUserId: null },
            ...(userId ? [{ usedByUserId: userId }] : []),
          ],
        },
      ],
    },
    select: { id: true, email: true, usedByUserId: true },
  });
  if (!entry) return false;
  // A first OAuth callback carries the provider profile id before Auth.js creates
  // the database user. Validate now, then claim from the createUser event.
  if (!existingUser || !userId) return true;
  if (entry.usedByUserId === userId) {
    await db.user.update({
      where: { id: userId },
      data: { betaAccessGrantedAt: request.now },
    });
    return true;
  }

  return db.$transaction(async (tx) => {
    const claimed = await tx.allowlistEntry.updateMany({
      where: { id: entry.id, usedByUserId: null },
      data: { usedByUserId: userId },
    });
    if (claimed.count !== 1) return false;
    await tx.user.update({
      where: { id: userId },
      data: { betaAccessGrantedAt: request.now },
    });
    return true;
  });
}
