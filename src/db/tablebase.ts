// TablebaseCache persistence (BUILD.md §5.3, §6.6, M13). Typed query helpers only — no
// business logic (§4: db/ holds no decisions). A tablebase result is immutable for a given
// FEN, so the cache is fetch-once / reuse-forever: the server lookup reads here first and
// only hits Lichess on a miss (respect the platform, §12).

import type { Prisma, PrismaClient } from "@prisma/client";

import { tablebaseResultSchema, type TablebaseResult } from "@/lib/tablebase";

/** The cached result for a FEN, or null if we have never probed it (defensively re-parsed —
 *  a corrupt cache row reads as a miss rather than crashing the surface). */
export async function getTablebaseCache(
  db: Pick<PrismaClient, "tablebaseCache">,
  fen: string,
): Promise<TablebaseResult | null> {
  const row = await db.tablebaseCache.findUnique({ where: { fen } });
  if (!row) return null;
  const parsed = tablebaseResultSchema.safeParse(row.result);
  return parsed.success ? parsed.data : null;
}

/** Persist a probe result for a FEN (idempotent — the result never changes for a position). */
export async function upsertTablebaseCache(
  db: Pick<PrismaClient, "tablebaseCache">,
  fen: string,
  result: TablebaseResult,
): Promise<void> {
  const data = result as unknown as Prisma.InputJsonValue;
  await db.tablebaseCache.upsert({
    where: { fen },
    create: { fen, result: data },
    update: { result: data },
  });
}
