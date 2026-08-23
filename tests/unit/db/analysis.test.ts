import { describe, expect, it, vi } from "vitest";

import {
  analysisCounts,
  gamesNeedingAnalysis,
  gamesNeedingAnalysisInWindow,
  reviewedGameIds,
  saveAnalysisResult,
  unreviewedGames,
  userOwnsGame,
} from "@/db/analysis";
import type { RawGameFeatures } from "@/lib/raw-features";
import { GAME_ANALYSED_ACTIVITY_EVENT_TYPE } from "@/lib/tracker";

const mockRawFeatures: RawGameFeatures = {
  acplOverall: 25.5,
  acplByPhase: { opening: 20, middlegame: 30, endgame: 15 },
  phaseBoundaries: { openingEndsPly: 20, endgameStartsPly: 40 },
  moveEvals: [],
  blunders: [],
  errorCounts: { inaccuracies: 1, mistakes: 0, blunders: 0, grossBlunders: 0 },
  conversion: {
    reachedWinningPlus: false,
    converted: false,
    reachedLosingMinus: false,
    saved: false,
  },
  openingDeviation: { firstDeviationPly: 10, earlyCpl: 20 },
};

describe("db/analysis query helpers", () => {
  it("queries games needing analysis with limit and platform filter", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: "g1", userId: "u1", platform: "lichess" }]);
    const db = { importedGame: { findMany } };

    const result = await gamesNeedingAnalysis(db as never, "u1", 10, "lichess");

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        analysis: { is: null },
        platform: "lichess",
      },
      orderBy: [
        { playedAt: { sort: "desc", nulls: "last" } },
        { importedAt: "desc" },
      ],
      take: 10,
    });
    expect(result).toHaveLength(1);
  });

  it("filters unanalysed games within a recent games window", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "g1", analysis: { id: "a1" } },
      { id: "g2", analysis: null },
      { id: "g3", analysis: null },
    ]);
    const db = { importedGame: { findMany } };

    const result = await gamesNeedingAnalysisInWindow(db as never, "u1", 5);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: [
        { playedAt: { sort: "desc", nulls: "last" } },
        { importedAt: "desc" },
      ],
      take: 5,
      include: { analysis: { select: { id: true } } },
    });
    expect(result.map((g) => g.id)).toEqual(["g2", "g3"]);
  });

  it("extracts reviewed game IDs from activity events", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { payload: { gameId: "g1", scheduledCount: 1 } },
      { payload: { gameId: "g2" } },
      { payload: {} },
      { payload: null },
    ]);
    const db = { activityEvent: { findMany } };

    const result = await reviewedGameIds(db as never, "u1");

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        type: GAME_ANALYSED_ACTIVITY_EVENT_TYPE,
      },
      select: { payload: true },
    });
    expect(result).toEqual(new Set(["g1", "g2"]));
  });

  it("queries unreviewed scanned games excluding already reviewed ones", async () => {
    const eventsFindMany = vi.fn().mockResolvedValue([
      { payload: { gameId: "g1" } },
    ]);
    const gamesFindMany = vi.fn().mockResolvedValue([
      { id: "g2", userId: "u1", playedAt: new Date(1_700_000_000_000) },
    ]);
    const db = {
      activityEvent: { findMany: eventsFindMany },
      importedGame: { findMany: gamesFindMany },
    };

    const result = await unreviewedGames(db as never, "u1", 10);

    expect(gamesFindMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        analysis: { isNot: null },
        id: { notIn: ["g1"] },
      },
      orderBy: [
        { playedAt: { sort: "desc", nulls: "last" } },
        { importedAt: "desc" },
      ],
      take: 10,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("g2");
  });

  it("queries unreviewed scanned games when no reviews exist", async () => {
    const eventsFindMany = vi.fn().mockResolvedValue([]);
    const gamesFindMany = vi.fn().mockResolvedValue([
      { id: "g1", userId: "u1", playedAt: new Date(1_700_000_000_000) },
    ]);
    const db = {
      activityEvent: { findMany: eventsFindMany },
      importedGame: { findMany: gamesFindMany },
    };

    const result = await unreviewedGames(db as never, "u1", 5);

    expect(gamesFindMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        analysis: { isNot: null },
      },
      orderBy: [
        { playedAt: { sort: "desc", nulls: "last" } },
        { importedAt: "desc" },
      ],
      take: 5,
    });
    expect(result).toHaveLength(1);
  });

  it("checks game ownership correctly", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: "g1" })
      .mockResolvedValueOnce(null);
    const db = { importedGame: { findFirst } };

    const owns = await userOwnsGame(db as never, "u1", "g1");
    const doesNotOwn = await userOwnsGame(db as never, "u1", "g2");

    expect(owns).toBe(true);
    expect(doesNotOwn).toBe(false);
  });

  it("upserts analysis result idempotently on gameId", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "res1" });
    const db = { analysisResult: { upsert } };

    await saveAnalysisResult(db as never, {
      gameId: "g1",
      engineVersion: "stockfish-16",
      depth: 14,
      rawFeatures: mockRawFeatures,
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { gameId: "g1" },
      create: {
        gameId: "g1",
        engineVersion: "stockfish-16",
        depth: 14,
        rawFeatures: mockRawFeatures,
      },
      update: {
        engineVersion: "stockfish-16",
        depth: 14,
        rawFeatures: mockRawFeatures,
        analyzedAt: expect.any(Date),
      },
    });
  });

  it("returns analysis counts for user games", async () => {
    const db = {
      analysisResult: { count: vi.fn().mockResolvedValue(15) },
      importedGame: { count: vi.fn().mockResolvedValue(20) },
    };

    const counts = await analysisCounts(db as never, "u1");
    expect(counts).toEqual({
      analysed: 15,
      total: 20,
    });
  });
});
