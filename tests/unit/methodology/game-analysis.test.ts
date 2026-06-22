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

describe("gameAnalysisProtocol", () => {
  it("orchestrates the 5-step game analysis protocol", () => {
    const game = {
      id: "game1",
      pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5 6. Bb5+ c6 7. dxc6 bxc6",
      playedAt: new Date(),
      result: "win",
      color: "w",
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
          { ply: 3, fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", cpLoss: 350 },
        ],
        errorCounts: { inaccuracies: 0, mistakes: 0, blunders: 1, grossBlunders: 1 },
      },
    };

    const session = gameAnalysisProtocol(game, "u800", cfg);
    expect(session.calibrationPrompt).toBe("Did you get in trouble because of the clock or a blunder?");
    expect(session.analysisUnlockDelay).toBe(0);
    expect(session.tiltBlocked).toBe(false);
    expect(session.criticalMoments.length).toBe(1);
    expect(session.criticalMoments[0]!.ply).toBe(3);
    expect(session.criticalMoments[0]!.cpLoss).toBe(350);
    expect(session.criticalMoments[0]!.fen).toBe("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3");
    expect(session.srsPuzzles.length).toBe(1);
    expect(session.srsPuzzles[0]!.ply).toBe(3);
    expect(session.gameSelectionRatio.win).toBe(0.8);
    expect(session.gameSelectionRatio.loss).toBe(0.2);
  });
});

describe("filterEngineLines", () => {
  const lines: EngineLine[] = [
    { pv: ["e2e4", "e7e5"], depth: 10, evaluation: 150, mate: false },
    { pv: ["d2d4", "d7d5", "c2c4"], depth: 10, evaluation: 350, mate: false },
    { pv: ["g1f3"], depth: 10, evaluation: 20, mate: false },
  ];

  it("filters engine lines for u800 (hides deep advantages that aren't mate/material)", () => {
    // A shallow line (≤2 ply) and a clear material win (≥300cp) stay visible; only a
    // deep, non-material positional advantage is hidden as beyond the band's RPL.
    const shallow = filterEngineLines(lines, "u800", cfg);
    expect(shallow[0]!.visible).toBe(true); // 2-ply line stays visible
    expect(shallow[1]!.visible).toBe(true); // 350cp material win stays visible

    const deepAdvantageLine: EngineLine = { pv: ["Nf3", "d5", "d4"], depth: 10, evaluation: 150, mate: false };
    const filteredU800 = filterEngineLines([deepAdvantageLine], "u800", cfg);
    expect(filteredU800[0]!.visible).toBe(false);
  });

  it("filters engine lines for b800_1200 (hides pure positional manoeuvres)", () => {
    const positionalLine: EngineLine = { pv: ["Re1"], depth: 10, evaluation: 120, mate: false };
    const filtered = filterEngineLines([positionalLine], "b800_1200", cfg);
    expect(filtered[0]!.visible).toBe(false);
    expect(filtered[0]!.reason).toBe("Pure positional manoeuvre beyond RPL");
  });

  it("filters engine lines for b1200_1600 (hides complex engine sacrifices)", () => {
    const complexLine: EngineLine = { pv: ["e4", "e5", "Nf3", "Nc6", "Bc4"], depth: 10, evaluation: 150, mate: false };
    const filtered = filterEngineLines([complexLine], "b1200_1600", cfg);
    expect(filtered[0]!.visible).toBe(false);
  });

  it("does not suppress but warns for b1600_2000", () => {
    const filtered = filterEngineLines(lines, "b1600_2000", cfg);
    expect(filtered.every((l) => l.visible)).toBe(true);
    expect(filtered[0]!.reason).toBe("Position is high-entropy (chaotic)");
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
        errorCounts: { inaccuracies: 0, mistakes: 0, blunders: 0, grossBlunders: 0 },
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
        errorCounts: { inaccuracies: 0, mistakes: 0, blunders: 1, grossBlunders: 0 },
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
