import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";

/** Serialize program replacement and outcome capture for one user inside a transaction. */
export async function lockUserProgramMutation(
  db: Partial<Prisma.TransactionClient>,
  userId: string,
): Promise<void> {
  if (typeof db.$queryRaw !== "function") return;
  await db.$queryRaw(
    PrismaRuntime.sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))::text AS lock`,
  );
}
