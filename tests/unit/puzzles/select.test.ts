import { describe, expect, it } from "vitest";
import type { LichessPuzzle, PrismaClient } from "@prisma/client";

import {
  buildPuzzleQuery,
  rankPuzzlesByProximity,
  selectPuzzles,
} from "@/db/puzzles";

function row(
  puzzleId: string,
  rating: number,
  popularity = 90,
  themes = ["fork"],
): LichessPuzzle {
  return {
    puzzleId,
    fen: "f",
    moves: "m",
    rating,
    ratingDeviation: 50,
    popularity,
    nbPlays: 100,
    themes,
    gameUrl: null,
    openingTags: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

describe("buildPuzzleQuery", () => {
  it("filters by theme and a target ± window rating range", () => {
    const q = buildPuzzleQuery({
      theme: "fork",
      ratingTarget: 1500,
      count: 5,
    });
    expect(q.where).toEqual({
      themes: { has: "fork" },
      rating: { gte: 1350, lte: 1650 },
    });
    expect(q.orderBy).toEqual([{ popularity: "desc" }, { puzzleId: "asc" }]);
    expect(q.take).toBe(50); // count * default poolMultiplier (10)
  });

  it("adds a popularity floor and exclusions when given", () => {
    const q = buildPuzzleQuery({
      theme: "pin",
      ratingTarget: 1000,
      ratingWindow: 100,
      count: 3,
      minPopularity: 50,
      excludePuzzleIds: ["x", "y"],
      poolMultiplier: 4,
    });
    expect(q.where.popularity).toEqual({ gte: 50 });
    expect(q.where.puzzleId).toEqual({ notIn: ["x", "y"] });
    expect(q.take).toBe(12);
  });
});

describe("rankPuzzlesByProximity", () => {
  it("orders by closeness to target, then popularity, then id; respects count", () => {
    const rows = [
      row("d", 1700, 99),
      row("b", 1490, 99),
      row("a", 1500, 50),
      row("c", 1510, 99),
    ];
    // distances to 1500: a=0, b=10, c=10, d=200; a first, then b before c (id tiebreak).
    expect(
      rankPuzzlesByProximity(rows, 1500, 3).map((r) => r.puzzleId),
    ).toEqual(["a", "b", "c"]);
    expect(
      rankPuzzlesByProximity(rows, 1500, 2).map((r) => r.puzzleId),
    ).toEqual(["a", "b"]);
  });
});

describe("selectPuzzles", () => {
  it("fetches a pool via the built query, then returns the proximity-ranked top N", async () => {
    const fixture = [
      row("a", 1500, 50),
      row("b", 1490, 99),
      row("c", 1510, 99),
      row("d", 1700, 99),
    ];
    let received: unknown;
    const fakeDb = {
      lichessPuzzle: {
        findMany: async (args: unknown) => {
          received = args;
          return fixture;
        },
      },
    } as unknown as Pick<PrismaClient, "lichessPuzzle">;

    const out = await selectPuzzles(fakeDb, {
      theme: "fork",
      ratingTarget: 1500,
      count: 2,
    });
    expect(out.map((r) => r.puzzleId)).toEqual(["a", "b"]);
    expect(received).toMatchObject({
      where: { themes: { has: "fork" }, rating: { gte: 1350, lte: 1650 } },
      take: 20,
    });
  });
});
