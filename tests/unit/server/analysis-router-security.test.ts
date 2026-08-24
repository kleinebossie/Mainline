import { describe, expect, it, vi } from "vitest";

import { analysisRouter } from "@/server/routers/analysis";

const REQUEST_ID = "2c164f2f-8494-4b7e-8243-0a11c35e2038";

function authorizedContext(prisma: Record<string, unknown>) {
  return {
    session: { user: { id: "user-1" }, expires: "2099-01-01" },
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          deletedAt: null,
          betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
        }),
      },
      ...prisma,
    },
  } as never;
}

describe("analysis session security boundaries", () => {
  it("scopes the browser analysis queue to manual PGN imports", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const context = authorizedContext({
      importedGame: { findMany },
    });

    await expect(
      analysisRouter.createCaller(context).pending({ platform: "manual" }),
    ).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          platform: "manual",
          analysis: { is: null },
        }),
      }),
    );
  });

  it("returns the stored result without replaying a repeated request", async () => {
    const importedGame = {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    };
    const context = authorizedContext({
      activityEvent: {
        findUnique: vi.fn().mockResolvedValue({
          payload: { gameId: "game-1", scheduledCount: 2 },
        }),
      },
      importedGame,
    });

    await expect(
      analysisRouter.createCaller(context).saveSession({
        gameId: "game-1",
        requestId: REQUEST_ID,
        reflectionNote: "I moved too quickly.",
        outcomes: [],
      }),
    ).resolves.toEqual({ success: true, scheduledCount: 2 });
    expect(importedGame.findFirst).not.toHaveBeenCalled();
    expect(importedGame.findUnique).not.toHaveBeenCalled();
  });

  it("rejects outcomes for plies absent from the saved analysis", async () => {
    const transaction = vi.fn();
    const context = authorizedContext({
      activityEvent: { findUnique: vi.fn().mockResolvedValue(null) },
      importedGame: {
        findFirst: vi.fn().mockResolvedValue({ id: "game-1" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "game-1",
          analysis: {
            rawFeatures: {
              acplOverall: 0,
              acplByPhase: { opening: 0, middlegame: 0, endgame: 0 },
              phaseBoundaries: {
                openingEndsPly: 20,
                endgameStartsPly: 60,
              },
              moveEvals: [{ ply: 4, cpBefore: 20, cpAfter: -50, cpLoss: 70 }],
              blunders: [],
              errorCounts: {
                inaccuracies: 1,
                mistakes: 0,
                blunders: 0,
                grossBlunders: 0,
              },
            },
          },
        }),
      },
      $transaction: transaction,
    });

    await expect(
      analysisRouter.createCaller(context).saveSession({
        gameId: "game-1",
        requestId: REQUEST_ID,
        reflectionNote: "I moved too quickly.",
        outcomes: [{ ply: 99, correct: false }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("persists durationSeconds into the activity event payload", async () => {
    const createEvent = vi.fn().mockResolvedValue({ id: "ev-1" });
    const context = authorizedContext({
      activityEvent: { findUnique: vi.fn().mockResolvedValue(null) },
      importedGame: {
        findFirst: vi.fn().mockResolvedValue({ id: "game-1" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "game-1",
          analysis: {
            rawFeatures: {
              acplOverall: 0,
              acplByPhase: { opening: 0, middlegame: 0, endgame: 0 },
              phaseBoundaries: {
                openingEndsPly: 20,
                endgameStartsPly: 60,
              },
              moveEvals: [{ ply: 4, cpBefore: 20, cpAfter: -50, cpLoss: 70 }],
              blunders: [],
              errorCounts: {
                inaccuracies: 1,
                mistakes: 0,
                blunders: 0,
                grossBlunders: 0,
              },
            },
          },
        }),
      },
      $transaction: vi.fn(async (cb) =>
        cb({
          activityEvent: { create: createEvent },
        }),
      ),
    });

    await expect(
      analysisRouter.createCaller(context).saveSession({
        gameId: "game-1",
        requestId: REQUEST_ID,
        reflectionNote: "Reflected well.",
        outcomes: [{ ply: 4, correct: true }],
        durationSeconds: 450,
      }),
    ).resolves.toEqual({ success: true, scheduledCount: 0 });

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          payload: expect.objectContaining({
            gameId: "game-1",
            reflectionNote: "Reflected well.",
            durationSeconds: 450,
          }),
        }),
      }),
    );
  });
});

describe("guided review queue authorization (queueGames)", () => {
  const ITEM_DATE = new Date("2026-08-24T00:00:00Z");

  function queueContext(
    prisma: Record<string, unknown>,
  ): ReturnType<typeof authorizedContext> {
    return authorizedContext({
      chessProfileSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
      assessment: { findUnique: vi.fn().mockResolvedValue(null) },
      activityEvent: { findMany: vi.fn().mockResolvedValue([]) },
      importedGame: { findMany: vi.fn().mockResolvedValue([]) },
      ...prisma,
    });
  }

  it("rejects a queue request for an item outside the caller's programs", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const context = queueContext({
      programItem: { findFirst },
    });

    await expect(
      analysisRouter
        .createCaller(context)
        .queueGames({ programItemId: "item-1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1", program: { userId: "user-1" } },
      }),
    );
  });

  it("rejects a queue request for a non-analyse item", async () => {
    const context = queueContext({
      programItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: "item-2",
          activityType: "puzzle_theme",
          params: {},
          date: ITEM_DATE,
        }),
      },
    });

    await expect(
      analysisRouter
        .createCaller(context)
        .queueGames({ programItemId: "item-2" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns the ordered queue plus the block's budget state for its own item", async () => {
    const findEvents = vi.fn().mockResolvedValue([]);
    const context = queueContext({
      activityEvent: { findMany: findEvents },
      programItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: "item-3",
          activityType: "analyse",
          params: { budgetMinutes: 30 },
          date: ITEM_DATE,
        }),
      },
      importedGame: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "game-new",
            platform: "lichess",
            externalGameId: "abc123",
            pgn: '[White "Me"]\n[Black "Rival"]\n',
            color: "w",
            result: "win",
            playedAt: new Date(ITEM_DATE.getTime() - 3_600_000),
            timeControl: "rapid",
            opening: "Italian",
            opponentRating: 1502,
          },
        ]),
      },
    });

    const result = await analysisRouter
      .createCaller(context)
      .queueGames({ programItemId: "item-3" });

    expect(result.budgetMinutes).toBe(30);
    expect(result.targetCount).toBe(2);
    expect(result.completedReviews).toBe(0);
    expect(result.games).toHaveLength(1);
    const game = result.games[0]!;
    expect(game.id).toBe("game-new");
    expect(game.opponent).toBe("Rival");
    expect(game.promptRung).toBe("fresh");
    expect(game.externalUrl).toBe("https://lichess.org/abc123");
    // Budget accounting counts only this caller's reviews recorded today or later.
    expect(findEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          type: "game_analysed",
          occurredAt: { gte: ITEM_DATE },
        }),
      }),
    );
  });

  it("offers the most recent unscanned game when the scanned queue is empty", async () => {
    const unscanned = {
      id: "game-unscanned",
      platform: "chesscom",
      externalGameId: "xyz789",
      pgn: '[White "Me"]\n[Black "Rival"]\n',
      color: "w",
      result: "loss",
      playedAt: new Date(ITEM_DATE.getTime() - 2 * 3_600_000),
    };
    const context = queueContext({
      programItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: "item-4",
          activityType: "analyse",
          params: {},
          date: ITEM_DATE,
        }),
      },
      // One fake serves both helpers: unreviewedGames asks for scanned rows
      // (analysis.isNot) while gamesNeedingAnalysis asks for unscanned ones.
      importedGame: {
        findMany: vi.fn(async ({
          where,
        }: {
          where: { analysis?: { isNot?: unknown; is?: unknown } };
        }) => {
          const analysis = where.analysis;
          if (analysis && "isNot" in analysis) return [];
          if (analysis && "is" in analysis) return [unscanned];
          throw new Error(
            "Unexpected importedGame.findMany shape: " + JSON.stringify(where),
          );
        }),
      },
    });

    const result = await analysisRouter
      .createCaller(context)
      .queueGames({ programItemId: "item-4" });

    expect(result.games).toHaveLength(0);
    expect(result.scanCandidate?.id).toBe("game-unscanned");
    expect(result.scanCandidate?.opponent).toBe("Rival");
  });

  it("reports fresh unreviewed games only inside the configured window", async () => {
    const hourAgo = new Date(Date.now() - 3_600_000);
    const weekAgo = new Date(Date.now() - 10 * 86_400_000);
    const makeContext = (playedAt: Date | null) =>
      queueContext({
        importedGame: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "g1",
              pgn: '[White "Me"]\n[Black "Rival"]\n',
              playedAt,
            },
          ]),
        },
      });

    await expect(
      analysisRouter.createCaller(makeContext(hourAgo)).freshness(),
    ).resolves.toEqual({ hasFreshUnreviewed: true });
    await expect(
      analysisRouter.createCaller(makeContext(weekAgo)).freshness(),
    ).resolves.toEqual({ hasFreshUnreviewed: false });
    await expect(
      analysisRouter.createCaller(makeContext(null)).freshness(),
    ).resolves.toEqual({ hasFreshUnreviewed: false });
  });
});
