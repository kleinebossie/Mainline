// PracticeItem persistence (BUILD.md §5.3, M12). Typed query helpers only — no business
// logic (§4: db/ holds no decisions). The in-app practice position (a blunder drill's FEN +
// its known solution line) and lookups by id for the solving surface.

import type { PrismaClient } from "@prisma/client";

export interface PracticeItemUpsert {
  userId: string;
  kind: string;
  fen: string;
  solutionLine: string[];
  /** Idempotency key, e.g. "blunder:<gameId>:<ply>". Re-deriving the same blunder is a no-op. */
  sourceRef: string;
  methodologyKey?: string | null;
}

/** Create the practice position if new, else return the existing one (idempotent by
 *  (userId, sourceRef)). The position + solution never change for a given sourceRef, so an
 *  existing row is returned untouched. */
export async function upsertPracticeItem(
  db: Pick<PrismaClient, "practiceItem">,
  input: PracticeItemUpsert,
) {
  return db.practiceItem.upsert({
    where: {
      userId_sourceRef: { userId: input.userId, sourceRef: input.sourceRef },
    },
    create: {
      userId: input.userId,
      kind: input.kind,
      fen: input.fen,
      solutionLine: input.solutionLine,
      sourceRef: input.sourceRef,
      methodologyKey: input.methodologyKey ?? null,
    },
    update: {},
  });
}

/** The practice positions for the given ids, scoped to the owner. Used by the solving
 *  surface to resolve a blunder_drill ProgramItem's due refs into renderable positions. */
export async function findPracticeItemsByIds(
  db: Pick<PrismaClient, "practiceItem">,
  userId: string,
  ids: readonly string[],
) {
  if (ids.length === 0) return [];
  return db.practiceItem.findMany({
    where: { userId, id: { in: [...ids] } },
    select: { id: true, kind: true, fen: true, solutionLine: true },
  });
}
