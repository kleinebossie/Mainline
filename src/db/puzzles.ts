// Typed query helpers for the puzzle catalog (BUILD.md §4: db/ holds query helpers,
// NO business logic). This is the M3 `selectPuzzles` contract — theme + rating
// selection over the ingested LichessPuzzle table.
//
// SCIENCE-FREE BY DESIGN (L1). The BUILD.md M3 contract sketches
// `selectPuzzles(theme, ratingTarget, n, cfg)`, but METHODOLOGY.md Seam 5 defines no
// puzzle-selection rating window: difficulty is governed by the servo's single
// `ratingTarget` (computed by `targetPuzzleRating`, Seam 5 — lands with the
// methodology layer in M4+). The `ratingWindow` here is therefore an INFRASTRUCTURE
// retrieval radius (how far around the target to look to find `count` matches),
// supplied by the caller — never a graded chess value. When the generator (M6) calls
// this, it passes the methodology-derived target; the window stays a retrieval knob.
// Ranking is deterministic (L2) so selection is golden-testable.

import type { LichessPuzzle, Prisma, PrismaClient } from "@prisma/client";

export interface PuzzleSelectionCriteria {
  /** A Lichess theme tag, e.g. "fork" (see integrations/puzzles/themes). */
  theme: string;
  /** Target puzzle rating (from Seam 5 once methodology lands; infra-supplied for now). */
  ratingTarget: number;
  /** Retrieval radius in Elo: candidates must fall in [target − window, target + window]. */
  ratingWindow: number;
  /** How many puzzles to return. */
  count: number;
  /** Puzzles already shown/solved, excluded from the result. */
  excludePuzzleIds?: string[];
  /** Optional popularity floor (quality filter). */
  minPopularity?: number;
  /** Candidate over-fetch factor before proximity ranking (infra; default 10). */
  poolMultiplier?: number;
}

export interface PuzzleQuery {
  where: Prisma.LichessPuzzleWhereInput;
  orderBy: Prisma.LichessPuzzleOrderByWithRelationInput[];
  take: number;
}

/**
 * Build the Prisma query for a selection: theme match (GIN index), rating window
 * (btree index), optional popularity floor and exclusions. We over-fetch the most
 * popular in-window candidates, then re-rank by proximity to the target in JS
 * (Postgres cannot order by |rating − target| against an index).
 */
export function buildPuzzleQuery(c: PuzzleSelectionCriteria): PuzzleQuery {
  const where: Prisma.LichessPuzzleWhereInput = {
    rating: {
      gte: c.ratingTarget - c.ratingWindow,
      lte: c.ratingTarget + c.ratingWindow,
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
    // Deterministic candidate order so the pool (and thus the result) is stable.
    orderBy: [{ popularity: "desc" }, { puzzleId: "asc" }],
    take: Math.max(c.count, c.count * poolMultiplier),
  };
}

/**
 * Deterministically rank a candidate pool by closeness to the target rating, then by
 * popularity (desc), then by id (asc) as a stable tiebreak; return the top `count`.
 */
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

/**
 * Select up to `count` puzzles matching `theme` within the rating window, ranked by
 * proximity to `ratingTarget`. `db` is the Prisma client (any object exposing
 * `lichessPuzzle.findMany`); tests pass a fake.
 */
export async function selectPuzzles(
  db: Pick<PrismaClient, "lichessPuzzle">,
  criteria: PuzzleSelectionCriteria,
): Promise<LichessPuzzle[]> {
  const pool = await db.lichessPuzzle.findMany(buildPuzzleQuery(criteria));
  return rankPuzzlesByProximity(pool, criteria.ratingTarget, criteria.count);
}
