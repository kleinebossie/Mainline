// Typed query helpers for the program engine (BUILD.md §4: db/ holds query helpers, NO
// business logic). The graded DECISIONS happen upstream in the pure generator
// (engine/generator.ts) + the methodology provider; this module only persists the result
// and reads it back. Self-contained input type (no engine import) keeps the boundary clean.

import type { Prisma, PrismaClient } from "@prisma/client";

/** One row to insert — the generator's draft flattened to ProgramItem columns (§5.5). */
export interface PersistableProgramItem {
  orderIndex: number;
  activityId: string;
  activityType: string;
  resourceRefId: string | null;
  params: Prisma.InputJsonValue;
  dimensionsTargeted: string[];
  rationaleKey: string;
  rationaleText: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  confidence: string;
  soften: boolean;
}

export interface SaveProgramInput {
  userId: string;
  methodologyVersion: string;
  generationInput: Prisma.InputJsonValue;
  /** The day these items belong to (start-of-day, derived from the injected Clock). */
  date: Date;
  items: readonly PersistableProgramItem[];
}

type WriteDb = Pick<PrismaClient, "program" | "$transaction">;

/**
 * Persist a freshly generated program: supersede any active program for the user, then
 * create the new active Program + its items, atomically. Returns the new program id.
 */
export async function saveProgram(
  db: WriteDb,
  input: SaveProgramInput,
): Promise<string> {
  return db.$transaction(async (tx) => {
    await tx.program.updateMany({
      where: { userId: input.userId, status: "active" },
      data: { status: "superseded" },
    });
    const program = await tx.program.create({
      data: {
        userId: input.userId,
        methodologyVersion: input.methodologyVersion,
        status: "active",
        generationInput: input.generationInput,
        items: {
          create: input.items.map((it) => ({
            date: input.date,
            orderIndex: it.orderIndex,
            activityId: it.activityId,
            activityType: it.activityType,
            resourceRefId: it.resourceRefId,
            params: it.params,
            dimensionsTargeted: it.dimensionsTargeted,
            rationaleKey: it.rationaleKey,
            rationaleText: it.rationaleText,
            evidenceGrade: it.evidenceGrade,
            evidenceTier: it.evidenceTier,
            citationKey: it.citationKey,
            confidence: it.confidence,
            soften: it.soften,
          })),
        },
      },
      select: { id: true },
    });
    return program.id;
  });
}

type ReadDb = Pick<PrismaClient, "program">;

/** The user's active program with its items (ordered) + each item's resource ref, or null. */
export async function getActiveProgram(db: ReadDb, userId: string) {
  return db.program.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { orderIndex: "asc" },
        include: { resourceRef: true },
      },
    },
  });
}

export type ActiveProgram = NonNullable<
  Awaited<ReturnType<typeof getActiveProgram>>
>;
