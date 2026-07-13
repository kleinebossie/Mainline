import { describe, expect, it } from "vitest";
import { loadMethodology } from "@/methodology/loader";
import {
  gameAnalysisProtocol,
  filterEngineLines,
  selectGamesForAnalysis,
  detectTilt,
  type RecentResult,
  type RecentGame,
  type EngineLine,
} from "@/methodology/index";
import { fixedClock } from "@/lib/clock";

const cfg = loadMethodology("stub-0.1.0");
const PLAYED_AT = new Date(0);
const LONG_PGN =
  "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5 6. Bb5+ c6 7. dxc6 bxc6";
const GAME_BASE = { pgn: LONG_PGN, playedAt: PLAYED_AT, color: "w" } as const;

describe("gameAnalysisProtocol", () => {
  it("orchestrates the 5-step game analysis protocol", () => {
    const game = {
      ...GAME_BASE,
      id: "game1",
      result: "win",
      rawFeatures: {
        acplOverall: 40,
        acplByPhase: { opening: 10, middlegame: 50, endgame: 0 },
        phaseBoundaries: { openingEndsPly: 10, endgameStartsPly: 20 },
        moveEvals: [
          { ply: 1, cpBefore: 30, cpAfter: 30, cpLoss: 0 },
          // user ply 3, made a blunder (cpLoss = 350)
          { ply: 3, cpBefore: 30, cpAfter: -320, cpLoss: 350 },
        ],
        blunders: [
          {
            ply: 3,
            fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
            cpLoss: 350,
          },
        ],
        errorCounts: {
          inaccuracies: 0,
          mistakes: 0,
          blunders: 1,
          grossBlunders: 1,
        },
      },
    };

    const session = gameAnalysisProtocol(game, "u800", cfg);
    expect(session.calibrationPrompt).toBe(
      "Did you get in trouble because of the clock or a blunder?",
    );
    expect(session.analysisUnlockDelay).toBe(0);
    expect(session.tiltBlocked).toBe(false);
    expect(session.criticalMoments.length).toBe(1);
    expect(session.criticalMoments[0]!.ply).toBe(3);
    expect(session.criticalMoments[0]!.cpLoss).toBe(350);
    expect(session.criticalMoments[0]!.fen).toBe(
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    );
    // u800 RPL threshold is 300cp and guessAcceptanceCpLossRatio is 0.5 → min(350*0.5, 300) = 175.
    expect(session.criticalMoments[0]!.maxAcceptableCpLoss).toBe(175);
    expect(session.srsPuzzles.length).toBe(1);
    expect(session.srsPuzzles[0]!.ply).toBe(3);
    expect(session.gameSelectionRatio.win).toBe(0.8);
    expect(session.gameSelectionRatio.loss).toBe(0.2);
  });

  it("returns critical moments in chronological (ply) order even when selected by severity", () => {
    // Severity selects both moments, but the player must receive them in game order.
    const game = {
      ...GAME_BASE,
      id: "game2",
      result: "loss",
      rawFeatures: {
        acplOverall: 60,
        acplByPhase: { opening: 10, middlegame: 80, endgame: 0 },
        phaseBoundaries: { openingEndsPly: 10, endgameStartsPly: 20 },
        moveEvals: [
          { ply: 1, cpBefore: 30, cpAfter: 30, cpLoss: 0 },
          { ply: 3, cpBefore: 30, cpAfter: -180, cpLoss: 210 },
          { ply: 7, cpBefore: -100, cpAfter: -600, cpLoss: 500 },
        ],
        blunders: [
          { ply: 3, fen: "fen-ply3", cpLoss: 210 },
          { ply: 7, fen: "fen-ply7", cpLoss: 500 },
        ],
        errorCounts: {
          inaccuracies: 0,
          mistakes: 0,
          blunders: 2,
          grossBlunders: 1,
        },
      },
    };

    const session = gameAnalysisProtocol(game, "b800_1200", cfg);
    expect(session.criticalMoments.map((m) => m.ply)).toEqual([3, 7]);
  });

  it("reconstructs the FEN for a mistake (not in blunders array) by replaying the PGN", () => {
    const game = {
      ...GAME_BASE,
      id: "game-mistake",
      pgn: "1. e4 e5 2. Nf3 Nc6",
      result: "loss",
      rawFeatures: {
        acplOverall: 30,
        acplByPhase: { opening: 30, middlegame: 0, endgame: 0 },
        phaseBoundaries: { openingEndsPly: 10, endgameStartsPly: 20 },
        moveEvals: [
          { ply: 1, cpBefore: 35, cpAfter: 35, cpLoss: 0 },
          { ply: 2, cpBefore: -35, cpAfter: -35, cpLoss: 0 },
          { ply: 3, cpBefore: 35, cpAfter: -165, cpLoss: 200 }, // White's mistake on move 2 (ply 3)
          { ply: 4, cpBefore: 165, cpAfter: 165, cpLoss: 0 },
        ],
        blunders: [], // No blunders over 300cp
        errorCounts: {
          inaccuracies: 0,
          mistakes: 1,
          blunders: 0,
          grossBlunders: 0,
        },
      },
    };

    // For b800_1200 band, threshold is 100cp, so ply 3 (200cp loss) is critical.
    const session = gameAnalysisProtocol(game, "b800_1200", cfg);
    expect(session.criticalMoments.length).toBe(1);
    expect(session.criticalMoments[0]!.ply).toBe(3);
    expect(session.criticalMoments[0]!.cpLoss).toBe(200);
    // The FEN before ply 3 (White's move 2: 2. Nf3) is the position after 1... e5
    expect(session.criticalMoments[0]!.fen).toBe(
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    );
  });

  it("does NOT flag a missed mate that stays winning as a critical moment (low band)", () => {
    // Ply 3 changes the likely result. Ply 5 misses mate but remains clearly winning,
    // so the low-band protocol should not surface it as another critical moment.
    const game = {
      ...GAME_BASE,
      id: "game3",
      result: "win",
      rawFeatures: {
        acplOverall: 40,
        acplByPhase: { opening: 10, middlegame: 50, endgame: 0 },
        phaseBoundaries: { openingEndsPly: 10, endgameStartsPly: 20 },
        moveEvals: [
          { ply: 1, cpBefore: 30, cpAfter: 30, cpLoss: 0, winProbDrop: 0 },
          // Real swing with a large win-probability drop.
          {
            ply: 3,
            cpBefore: 30,
            cpAfter: -320,
            cpLoss: 350,
            winProbDrop: 0.29,
          },
          // Missed mate with little change in win probability.
          {
            ply: 5,
            cpBefore: 1000,
            cpAfter: 600,
            cpLoss: 400,
            winProbDrop: 0.07,
          },
        ],
        blunders: [{ ply: 3, fen: "fen-ply3", cpLoss: 350 }],
        errorCounts: {
          inaccuracies: 0,
          mistakes: 0,
          blunders: 1,
          grossBlunders: 1,
        },
      },
    };

    const session = gameAnalysisProtocol(game, "b800_1200", cfg);
    expect(session.criticalMoments.map((m) => m.ply)).toEqual([3]);
    // The graded, band-dependent win-probability tolerance rides along for client grading.
    expect(session.criticalMoments[0]!.maxAcceptableWinProbDrop).toBe(0.13);
  });
});

describe("filterEngineLines", () => {
  // Config visible-error thresholds: u800 300 · b800_1200 200 · b1200_1600 100 ·
  // b1600_2000 50 · 2000+ 0. A line shows only if it is mate or |eval| ≥ threshold.
  const lines: EngineLine[] = [
    { pv: ["e2e4", "e7e5"], depth: 10, evaluation: 150, mate: false },
    { pv: ["d2d4", "d7d5", "c2c4"], depth: 10, evaluation: 350, mate: false },
    { pv: ["g1f3"], depth: 10, evaluation: 20, mate: false },
  ];

  it("hides sub-threshold lines for u800 (300cp) and points to a visible alternative", () => {
    const filtered = filterEngineLines(lines, "u800", cfg);
    expect(filtered[0]!.visible).toBe(false); // 150 < 300
    expect(filtered[1]!.visible).toBe(true); // 350 ≥ 300 (decisive/material)
    expect(filtered[2]!.visible).toBe(false); // 20 < 300
    expect(filtered[0]!.reason).toContain("300cp");
    // hidden top line surfaces the best visible line as a human alternative
    expect(filtered[0]!.humanAlternative?.evaluation).toBe(350);
  });

  it("always shows a forced mate regardless of threshold", () => {
    const mateLine: EngineLine = {
      pv: ["d8h4"],
      depth: 6,
      evaluation: 0,
      mate: true,
    };
    const filtered = filterEngineLines([mateLine], "u800", cfg);
    expect(filtered[0]!.visible).toBe(true);
  });

  it("hides sub-threshold lines for b800_1200 (200cp)", () => {
    const positionalLine: EngineLine = {
      pv: ["Re1"],
      depth: 10,
      evaluation: 120,
      mate: false,
    };
    const filtered = filterEngineLines([positionalLine], "b800_1200", cfg);
    expect(filtered[0]!.visible).toBe(false);
    expect(filtered[0]!.reason).toContain("200cp");
  });

  it("applies the 100cp threshold for b1200_1600", () => {
    const above: EngineLine = {
      pv: ["e4", "e5", "Nf3"],
      depth: 10,
      evaluation: 150,
      mate: false,
    };
    const below: EngineLine = {
      pv: ["a2a3"],
      depth: 10,
      evaluation: 80,
      mate: false,
    };
    const filtered = filterEngineLines([above, below], "b1200_1600", cfg);
    expect(filtered[0]!.visible).toBe(true); // 150 ≥ 100
    expect(filtered[1]!.visible).toBe(false); // 80 < 100
  });

  it("flags high-entropy positions when candidate moves are nearly equal", () => {
    const nearEqual: EngineLine[] = [
      { pv: ["e2e4"], depth: 12, evaluation: 60, mate: false },
      { pv: ["d2d4"], depth: 12, evaluation: 50, mate: false },
    ];
    const filtered = filterEngineLines(nearEqual, "b1600_2000", cfg);
    expect(filtered.every((l) => l.visible)).toBe(true); // both ≥ 50
    expect(filtered[0]!.reason).toContain("high-entropy");
  });

  it("suppresses nothing for the top band (threshold 0)", () => {
    const filtered = filterEngineLines(lines, "b2200plus", cfg);
    expect(filtered.every((l) => l.visible)).toBe(true);
  });
});

describe("selectGamesForAnalysis", () => {
  const games: RecentGame[] = [
    {
      id: "g1",
      result: "win",
      color: "w",
      playedAt: new Date(Date.now() - 1000),
      rawFeatures: {
        acplOverall: 10,
        acplByPhase: { opening: 0, middlegame: 0, endgame: 0 },
        phaseBoundaries: { openingEndsPly: 10, endgameStartsPly: 20 },
        moveEvals: [{ ply: 1, cpBefore: 10, cpAfter: 10, cpLoss: 0 }],
        blunders: [],
        errorCounts: {
          inaccuracies: 0,
          mistakes: 0,
          blunders: 0,
          grossBlunders: 0,
        },
      },
    },
    {
      id: "g2",
      result: "loss",
      color: "b",
      playedAt: new Date(Date.now() - 2000),
      rawFeatures: {
        acplOverall: 10,
        acplByPhase: { opening: 0, middlegame: 0, endgame: 0 },
        phaseBoundaries: { openingEndsPly: 10, endgameStartsPly: 20 },
        moveEvals: [
          // user ply 2 (black), blunder (cpLoss = 200)
          { ply: 2, cpBefore: 10, cpAfter: -190, cpLoss: 200 },
        ],
        blunders: [{ ply: 2, fen: "some_fen", cpLoss: 200 }],
        errorCounts: {
          inaccuracies: 0,
          mistakes: 0,
          blunders: 1,
          grossBlunders: 0,
        },
      },
    },
  ];

  it("suggests games and respects win ratio", () => {
    const suggestions = selectGamesForAnalysis(games, "u800", cfg);
    expect(suggestions.length).toBeGreaterThan(0);
    // u800 ratio is 80% win, 20% loss. With 1 win and 1 loss, it should prioritize win if possible
    expect(suggestions[0]!.result).toBe("win");
  });
});

describe("detectTilt", () => {
  const clock = fixedClock(1700000000000);

  it("returns tilted: false when no triggers met", () => {
    const results: RecentResult[] = [
      { playedAt: new Date(1700000000000 - 1000), result: "win" },
    ];
    const state = detectTilt(results, "b800_1200", clock, cfg);
    expect(state.tilted).toBe(false);
  });

  it("detects losses_in_row for b800_1200", () => {
    const results: RecentResult[] = [
      { playedAt: new Date(1700000000000 - 1000), result: "loss" },
      { playedAt: new Date(1700000000000 - 2000), result: "loss" },
      { playedAt: new Date(1700000000000 - 3000), result: "loss" },
    ];
    const state = detectTilt(results, "b800_1200", clock, cfg);
    expect(state.tilted).toBe(true);
    expect(state.reason).toContain("3 consecutive losses");
  });

  it("detects losses_in_time for u800", () => {
    const results: RecentResult[] = [
      { playedAt: new Date(1700000000000 - 1000), result: "loss" },
      { playedAt: new Date(1700000000000 - 2000), result: "loss" },
      { playedAt: new Date(1700000000000 - 3000), result: "loss" },
    ];
    const state = detectTilt(results, "u800", clock, cfg);
    expect(state.tilted).toBe(true);
    expect(state.reason).toContain("losses in the last hour");
  });
});
