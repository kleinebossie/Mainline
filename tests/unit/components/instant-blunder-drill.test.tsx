import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/react", () => ({
  trpc: {
    analysis: {
      pending: {
        useQuery: () => ({
          isLoading: false,
          error: null,
          data: [],
        }),
      },
      library: {
        useQuery: () => ({
          isLoading: false,
          error: null,
          data: {
            primaryPlatform: null,
            effectivePlatform: null,
            platforms: [],
            games: [],
          },
        }),
      },
    },
    useUtils: () => ({}),
  },
}));

import {
  InstantBlunderDrill,
  STARTER_BLUNDER_DRILL,
  type BlunderDrillData,
} from "@/app/onboarding/instant-blunder-drill";
import { deriveBlunderDrills } from "@/engine/interactive/blunder-drill";
import { stepSolve } from "@/engine/interactive/session";

describe("InstantBlunderDrill component", () => {
  it("renders the starter blunder drill with instructional copy", () => {
    const html = renderToStaticMarkup(
      <InstantBlunderDrill initialDrill={STARTER_BLUNDER_DRILL} />,
    );

    expect(html).toContain("Punish the back-rank mistake");
    expect(html).toContain("Starter drill");
    expect(html).toContain("White to move");
    expect(html).toContain("Make the best move on the board");
  });

  it("renders a real game blunder drill when provided", () => {
    const gameDrill: BlunderDrillData = {
      fen: "r1b2rk1/pp3ppp/2n5/8/1q6/2B2N2/PP3PPP/R2Q1RK1 w - - 0 1",
      solutionLine: ["c3b4"],
      source: "game",
      title: "Real game blunder drill",
      description:
        "From your game in the Sicilian Defence. Find the winning move.",
      gameInfo: "Sicilian Defence",
    };

    const html = renderToStaticMarkup(
      <InstantBlunderDrill initialDrill={gameDrill} />,
    );

    expect(html).toContain("Real game blunder drill");
    expect(html).toContain("Your game");
    expect(html).toContain("Sicilian Defence");
    expect(html).toContain("White to move");
  });

  it("renders a black-to-move blunder drill with black perspective", () => {
    const blackDrill: BlunderDrillData = {
      fen: "r4rk1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1",
      solutionLine: ["f8d8"],
      source: "game",
      title: "Black turning point",
      gameInfo: "French Defence",
    };

    const html = renderToStaticMarkup(
      <InstantBlunderDrill initialDrill={blackDrill} />,
    );

    expect(html).toContain("Black turning point");
    expect(html).toContain("Black to move");
    expect(html).toContain("French Defence");
  });

  it("derives and solves a blunder drill using engine contracts", () => {
    const blunders = [
      {
        ply: 24,
        fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
        cpLoss: 900,
      },
    ];
    const bestMoveByPly = { 24: "d1d8" };

    const drafts = deriveBlunderDrills(
      { gameId: "game-123", blunders, bestMoveByPly },
      { minCpLoss: 150 },
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.sourceRef).toBe("blunder:game-123:24");
    expect(drafts[0]?.solutionLine).toEqual(["d1d8"]);

    const solveResult = stepSolve(
      {
        position: drafts[0]!.fen,
        solutionLine: drafts[0]!.solutionLine,
        cursor: 0,
        startedMs: 1000,
        attempts: 0,
      },
      { san: "Rxd8#", atMs: 2500 },
    );

    expect(solveResult.step).toBe("solved");
    expect(solveResult.solveMs).toBe(1500);
  });
});
