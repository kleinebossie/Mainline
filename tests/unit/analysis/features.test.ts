import { describe, it, expect } from "vitest";
import { extractFeatures, type PositionEval } from "@/analysis/features";

describe("extractFeatures", () => {
  const pgn = "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0";
  const evals: PositionEval[] = [
    { cp: 20, mate: null }, // p0 (start, W to move)
    { cp: -20, mate: null }, // p1 (after e4, B to move)
    { cp: 20, mate: null }, // p2 (after e5, W to move)
    { cp: 30, mate: null }, // p3 (after Qh5, B to move)
    { cp: 40, mate: null }, // p4 (after Nc6, W to move)
    { cp: -40, mate: null }, // p5 (after Bc4, B to move)
    { cp: null, mate: 1 }, // p6 (after Nf6, W to move, M1)
    { cp: null, mate: -0 }, // p7 (after Qxf7#, B to move, mated)
  ];

  it("extracts exact raw features for Black (the loser who blunders)", () => {
    const res = extractFeatures({ pgn, evals, userColor: "b" });

    expect(res.moveEvals).toHaveLength(7);
    // cp fields are the clamped measurement; the win-prob companion (mover POV, from the
    // UNclamped eval) saturates so the mate at ply 6/7 reads as a ~0/1 win chance — the
    // mate-safe severity the analysis/diagnosis layers threshold on.
    expect(res.moveEvals).toEqual([
      { ply: 1, cpBefore: 20, cpAfter: 20, cpLoss: 0, winProbBefore: 0.52, winProbAfter: 0.52, winProbDrop: 0 }, // prettier-ignore
      { ply: 2, cpBefore: -20, cpAfter: -20, cpLoss: 0, winProbBefore: 0.48, winProbAfter: 0.48, winProbDrop: 0 }, // prettier-ignore
      { ply: 3, cpBefore: 20, cpAfter: -30, cpLoss: 50, winProbBefore: 0.52, winProbAfter: 0.47, winProbDrop: 0.05 }, // prettier-ignore
      { ply: 4, cpBefore: 30, cpAfter: -40, cpLoss: 70, winProbBefore: 0.53, winProbAfter: 0.46, winProbDrop: 0.07 }, // prettier-ignore
      { ply: 5, cpBefore: 40, cpAfter: 40, cpLoss: 0, winProbBefore: 0.54, winProbAfter: 0.54, winProbDrop: 0 }, // prettier-ignore
      { ply: 6, cpBefore: -40, cpAfter: -1000, cpLoss: 960, winProbBefore: 0.46, winProbAfter: 0, winProbDrop: 0.46 }, // prettier-ignore
      { ply: 7, cpBefore: 1000, cpAfter: 1000, cpLoss: 0, winProbBefore: 1, winProbAfter: 1, winProbDrop: 0 }, // prettier-ignore
    ]);

    expect(res.acplOverall).toBe(343.33); // (0 + 70 + 960) / 3
    expect(res.acplByPhase).toEqual({
      opening: 343.33,
      middlegame: 0,
      endgame: 0,
    });
    expect(res.phaseBoundaries).toEqual({
      openingEndsPly: 7, // min(OPENING_PLY_CAP=24, endgameStartsPly-1=7)
      endgameStartsPly: 8,
    });

    expect(res.errorCounts).toEqual({
      inaccuracies: 1, // ply 4
      mistakes: 0,
      blunders: 0,
      grossBlunders: 1, // ply 6
    });

    expect(res.blunders).toHaveLength(1);
    expect(res.blunders[0]).toEqual({
      ply: 6,
      fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
      cpLoss: 960,
    });

    expect(res.conversion).toEqual({
      reachedWinningPlus: false,
      converted: false,
      reachedLosingMinus: true,
      saved: false,
    });

    expect(res.openingDeviation).toEqual({
      firstDeviationPly: 4,
      earlyCpl: 343.33,
    });
  });

  it("extracts exact raw features for White (the winner)", () => {
    const res = extractFeatures({ pgn, evals, userColor: "w" });

    expect(res.acplOverall).toBe(12.5); // (0 + 50 + 0 + 0) / 4
    expect(res.acplByPhase).toEqual({
      opening: 12.5,
      middlegame: 0,
      endgame: 0,
    });

    expect(res.errorCounts).toEqual({
      inaccuracies: 1,
      mistakes: 0,
      blunders: 0,
      grossBlunders: 0,
    });

    expect(res.blunders).toEqual([]);

    expect(res.conversion).toEqual({
      reachedWinningPlus: true,
      converted: true,
      reachedLosingMinus: false,
      saved: false,
    });

    expect(res.openingDeviation).toEqual({
      firstDeviationPly: 3,
      earlyCpl: 12.5,
    });
  });

  it("extracts clock information from PGN clock comments", () => {
    const clockedPgn = [
      '[Event "Rated Rapid game"]',
      '[TimeControl "300+3"]',
      "",
      "1. e4 { [%clk 0:05:00] } e5 { [%clk 0:04:58] } 2. Nf3 { [%clk 0:04:55] } 1-0",
    ].join("\n");
    const clockedEvals: PositionEval[] = [
      { cp: 20, mate: null },
      { cp: -20, mate: null },
      { cp: 20, mate: null },
      { cp: 30, mate: null },
    ];

    const res = extractFeatures({
      pgn: clockedPgn,
      evals: clockedEvals,
      userColor: "w",
    });

    expect(res.clock).toBeDefined();
    expect(res.clock).toEqual([
      { ply: 1, remainingMs: 300000, spentMs: 3000 },
      { ply: 2, remainingMs: 298000, spentMs: 5000 },
      { ply: 3, remainingMs: 295000, spentMs: 8000 },
    ]);
  });
});
