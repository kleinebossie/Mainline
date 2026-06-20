// Pure idempotency helper for import (BUILD.md §5.2, M2). The DB unique
// (userId, dedupeKey) makes re-import a no-op across runs; this collapses duplicates
// WITHIN a single fetched batch (the two providers can both return overlapping
// pages) so the persisted set is exactly the distinct games. First occurrence wins.

import type { ImportedGameInput } from "@/integrations/adapter";

export function dedupeImportedGames(
  games: ImportedGameInput[],
): ImportedGameInput[] {
  const seen = new Set<string>();
  const out: ImportedGameInput[] = [];
  for (const g of games) {
    if (seen.has(g.dedupeKey)) continue;
    seen.add(g.dedupeKey);
    out.push(g);
  }
  return out;
}
