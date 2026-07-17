// Deterministic puzzle-catalog queries. Methodology supplies the rating target;
// The rating window is only a retrieval radius.

import type { LichessPuzzle, Prisma, PrismaClient } from "@prisma/client";

export interface PuzzleSelectionCriteria {
  theme: string;
  ratingTarget: number;
  ratingWindow?: number;
  count: number;
  excludePuzzleIds?: string[];
  minPopularity?: number;
  poolMultiplier?: number;
}

/** Shared retrieval radius. Puzzle difficulty itself comes from Methodology. */
export const DEFAULT_PUZZLE_RATING_WINDOW = 150;

export interface PuzzleQuery {
  where: Prisma.LichessPuzzleWhereInput;
  orderBy: Prisma.LichessPuzzleOrderByWithRelationInput[];
  take: number;
}

/** Over-fetch an indexed candidate pool before proximity ranking in memory. */
export function buildPuzzleQuery(c: PuzzleSelectionCriteria): PuzzleQuery {
  const ratingWindow = c.ratingWindow ?? DEFAULT_PUZZLE_RATING_WINDOW;
  const where: Prisma.LichessPuzzleWhereInput = {
    rating: {
      gte: c.ratingTarget - ratingWindow,
      lte: c.ratingTarget + ratingWindow,
    },
  };
  if (c.theme !== "mix") {
    if (c.theme === "calculation") {
      where.themes = {
        hasSome: ["long", "veryLong", "mateIn3", "mateIn4", "mateIn5"],
      };
    } else {
      where.themes = { has: c.theme };
    }
  }
  if (c.minPopularity != null) where.popularity = { gte: c.minPopularity };
  if (c.excludePuzzleIds && c.excludePuzzleIds.length > 0) {
    where.puzzleId = { notIn: c.excludePuzzleIds };
  }
  const poolMultiplier = c.poolMultiplier ?? 10;
  return {
    where,
    // Stable ordering keeps the over-fetched pool reproducible.
    orderBy: [{ popularity: "desc" }, { puzzleId: "asc" }],
    take: Math.max(c.count, c.count * poolMultiplier),
  };
}

/** Rank by proximity, popularity, then stable id. */
export function rankPuzzlesByProximity(
  rows: readonly LichessPuzzle[],
  ratingTarget: number,
  count: number,
): LichessPuzzle[] {
  return [...rows]
    .sort((a, b) => {
      const da = Math.abs(a.rating - ratingTarget);
      const db = Math.abs(b.rating - ratingTarget);
      if (da !== db) return da - db;
      if (a.popularity !== b.popularity) return b.popularity - a.popularity;
      return a.puzzleId < b.puzzleId ? -1 : a.puzzleId > b.puzzleId ? 1 : 0;
    })
    .slice(0, count);
}

export async function selectPuzzles(
  db: Pick<PrismaClient, "lichessPuzzle">,
  criteria: PuzzleSelectionCriteria,
): Promise<LichessPuzzle[]> {
  const pool = await db.lichessPuzzle.findMany(buildPuzzleQuery(criteria));
  return rankPuzzlesByProximity(pool, criteria.ratingTarget, criteria.count);
}
