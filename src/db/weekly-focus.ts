import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "weeklyFocus" | "$transaction">;

export const WEEKLY_FOCUS_CHANGED =
  "Weekly focus changed; refresh and try again";

export async function findActiveWeeklyFocus(db: Db, userId: string) {
  return db.weeklyFocus.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdAt: "desc" },
  });
}

export async function replaceWeeklyFocus(
  db: Db,
  input: {
    userId: string;
    weekStart: Date;
    focusAreas: string[];
    supportingSignals: Prisma.InputJsonValue;
    confidence: string;
    methodologyVersion: string;
    inputSnapshot: Prisma.InputJsonValue;
    rationaleSnapshots: Prisma.InputJsonValue;
    alternatives: Prisma.InputJsonValue;
    selectedAlternative: string | null;
    revisionTrigger: string | null;
    expectedActiveId: string | null;
  },
) {
  try {
    return await db.$transaction(async (tx) => {
      if (input.expectedActiveId) {
        const superseded = await tx.weeklyFocus.updateMany({
          where: {
            id: input.expectedActiveId,
            userId: input.userId,
            status: "active",
          },
          data: { status: "superseded" },
        });
        if (superseded.count !== 1) throw new Error(WEEKLY_FOCUS_CHANGED);
      }
      const { expectedActiveId: _expectedActiveId, ...data } = input;
      void _expectedActiveId;
      return tx.weeklyFocus.create({ data });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === WEEKLY_FOCUS_CHANGED ||
        ("code" in error && error.code === "P2002"))
    ) {
      throw new Error(WEEKLY_FOCUS_CHANGED);
    }
    throw error;
  }
}
