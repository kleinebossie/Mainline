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
});
