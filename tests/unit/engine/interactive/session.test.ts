import { describe, expect, it } from "vitest";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import { createEnginePlay } from "@/engine/interactive/engine-play";
import type { AnalysisEngineAdapter } from "@/analysis";

describe("stepSolve pure state machine", () => {
  // Starting FEN position (standard starting board)
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  it("handles a single-move correct puzzle solve", () => {
    const initialState: SolveState = {
      position: startFen,
      solutionLine: ["e4"],
      cursor: 0,
      startedMs: 1000,
      attempts: 0,
    };

    const result = stepSolve(initialState, { san: "e4", atMs: 3500 });

    expect(result.step).toBe("solved");
    expect(result.solveMs).toBe(2500); // 3500 - 1000
    expect(result.state.cursor).toBe(1);
    expect(result.state.attempts).toBe(0);
    // Position should be updated after e4
    expect(result.state.position).not.toBe(startFen);
  });

  it("handles a multi-move puzzle with auto-played opponent reply", () => {
    // Solution line: 1. e4 e5 2. Nf3
    // The player plays e4, the opponent replies e5 (auto-played), then player plays Nf3
    const initialState: SolveState = {
      position: startFen,
      solutionLine: ["e2e4", "e7e5", "g1f3"], // Mix of UCI and SAN in expected solution
      cursor: 0,
      startedMs: 1000,
      attempts: 0,
    };

    // Player makes move 1: "e4" (represented as SAN or UCI)
    const result1 = stepSolve(initialState, { san: "e4", atMs: 2000 });

    expect(result1.step).toBe("continue");
    expect(result1.solveMs).toBe(1000);
    expect(result1.state.attempts).toBe(0);
    // Cursor should have jumped past player move (0) AND opponent move (1) to 2
    expect(result1.state.cursor).toBe(2);

    // Let's check that Black's reply "e5" was indeed played on the board FEN
    // After 1. e4 e5, it's White's turn again.
    expect(result1.state.position).toContain(" w ");

    // Player makes move 2: "Nf3"
    const result2 = stepSolve(result1.state, { san: "Nf3", atMs: 4500 });
    expect(result2.step).toBe("solved");
    expect(result2.solveMs).toBe(3500); // from the original startedMs (1000)
    expect(result2.state.cursor).toBe(3);
  });

  it("handles incorrect moves by incrementing attempts without moving board", () => {
    const initialState: SolveState = {
      position: startFen,
      solutionLine: ["e4"],
      cursor: 0,
      startedMs: 1000,
      attempts: 0,
    };

    const result = stepSolve(initialState, { san: "d4", atMs: 2500 });

    expect(result.step).toBe("wrong");
    expect(result.solveMs).toBe(1500);
    expect(result.state.attempts).toBe(1);
    expect(result.state.cursor).toBe(0);
    expect(result.state.position).toBe(startFen);
  });

  it("handles illegal moves by incrementing attempts", () => {
    const initialState: SolveState = {
      position: startFen,
      solutionLine: ["e4"],
      cursor: 0,
      startedMs: 1000,
      attempts: 0,
    };

    // "e5" is illegal for White on the first move
    const result = stepSolve(initialState, { san: "e5", atMs: 2000 });

    expect(result.step).toBe("wrong");
    expect(result.state.attempts).toBe(1);
    expect(result.state.cursor).toBe(0);
    expect(result.state.position).toBe(startFen);
  });
});

describe("createEnginePlay Stockfish opponent harness", () => {
  const testFen =
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";

  it("queries the engine adapter and returns the move in SAN/UCI along with timing", async () => {
    // Mock Stockfish engine adapter
    const mockAdapter: AnalysisEngineAdapter = {
      init: async () => {},
      analyzePosition: async () => {
        return {
          scoreCp: 30,
          mate: null,
          bestMove: "f1c4", // Bc4
          depth: 10,
        };
      },
      analyzeLines: async () => [],
      analyzeGame: async () => ({
        acplOverall: 10,
        acplByPhase: { opening: 10, middlegame: 10, endgame: 10 },
        phaseBoundaries: { openingEndsPly: 8, endgameStartsPly: 30 },
        moveEvals: [],
        blunders: [],
        errorCounts: {
          inaccuracies: 0,
          mistakes: 0,
          blunders: 0,
          grossBlunders: 0,
        },
      }),
      dispose: () => {},
    };

    // A clock that advances on each read, to simulate time passing during the
    // getOpponentMove call (solveMs = end - start).
    let nowValue = 5000;
    const incrementingClock = {
      now: () => {
        const val = nowValue;
        nowValue += 800; // Simulate 800ms search
        return val;
      },
    };

    const enginePlay = createEnginePlay(mockAdapter, incrementingClock);
    const result = await enginePlay.getOpponentMove(testFen, { depth: 10 });

    expect(result.uci).toBe("f1c4");
    expect(result.san).toBe("Bc4");
    expect(result.solveMs).toBe(800);
  });
});
