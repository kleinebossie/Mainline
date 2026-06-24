// Tablebase lookup orchestration (BUILD.md §6.6, §12, M13). Cache-first: read the DB cache,
// and only on a miss probe Lichess (then cache the result). This is the "respect the
// platform" guarantee made concrete — a FEN is fetched from Lichess at most once, ever, and
// reused for every user thereafter. The endgame surface treats the tablebase as an OPTIONAL
// correctness oracle: an unavailable position (> 7 pieces, no entry, or a network/rate-limit
// failure) returns null and the caller falls back to engine-only judging (graceful).

import type { PrismaClient } from "@prisma/client";

import { fetchTablebase } from "@/integrations/lichess/tablebase";
import { getTablebaseCache, upsertTablebaseCache } from "@/db/tablebase";
import {
  fenPieceCount,
  TABLEBASE_MAX_PIECES,
  type TablebaseResult,
} from "@/lib/tablebase";

type Db = Pick<PrismaClient, "tablebaseCache">;

/**
 * Ground-truth tablebase result for a FEN, or null when unavailable. Reads the cache first
 * (no Lichess request on a hit), probes + caches on a miss, and swallows probe failures into
 * null so an endgame drill always renders (engine-only fallback). Positions beyond the
 * tablebase's reach are short-circuited before any cache/network work.
 */
export async function lookupTablebase(
  db: Db,
  fen: string,
): Promise<TablebaseResult | null> {
  if (fenPieceCount(fen) > TABLEBASE_MAX_PIECES) return null;

  const cached = await getTablebaseCache(db, fen);
  if (cached) return cached;

  let result: TablebaseResult | null = null;
  try {
    result = await fetchTablebase(fen);
  } catch {
    // Rate-limited / network failure — fall back to engine-only (the oracle is optional).
    return null;
  }
  if (result) await upsertTablebaseCache(db, fen, result);
  return result;
}
