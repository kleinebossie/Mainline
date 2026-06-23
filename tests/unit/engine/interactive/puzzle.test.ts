import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { puzzleToSolveState } from "@/engine/interactive/puzzle";
import { stepSolve } from "@/engine/interactive/session";

describe("puzzleToSolveState (Lichess setup-move translation)", () => {
  // A real Lichess-format puzzle: `fen` is before White's setup move (g1f3 not relevant
  // here — use a constructed one). We use the standard start position so the moves are
  // easy to reason about: the "opponent" plays e4, then the solver (Black) plays c5, the
  // opponent replies Nf3, the solver plays d6.
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const moves = "e2e4 c7c5 g1f3 d7d6";

  it("applies the opponent setup move and starts the line at the player's move", () => {
    const { solveState, orientation, setupMove } = puzzleToSolveState(
      fen,
      moves,
      1000,
    );

    expect(setupMove).toBe("e2e4");
    // After 1. e4 it is Black to move — the solver plays Black.
    expect(orientation).toBe("black");
    expect(solveState.position).toContain(" b ");
    // The solution line the solver must find no longer includes the setup move.
    expect(solveState.solutionLine).toEqual(["c7c5", "g1f3", "d7d6"]);
    expect(solveState.cursor).toBe(0);
    expect(solveState.startedMs).toBe(1000);
  });

  it("produces a SolveState the player can actually solve via stepSolve", () => {
    const { solveState } = puzzleToSolveState(fen, moves, 0);

    // Player's first move c5 — correct → opponent reply Nf3 auto-plays → continue.
    const r1 = stepSolve(solveState, { san: "c5", atMs: 100 });
    expect(r1.step).toBe("continue");
    expect(r1.state.cursor).toBe(2);
    expect(r1.state.position).toContain(" b "); // Black to move again after Nf3

    // Player's final move d6 → solved.
    const r2 = stepSolve(r1.state, { san: "d6", atMs: 200 });
    expect(r2.step).toBe("solved");
  });

  it("rejects the opponent's setup move as a wrong first move would be impossible to play", () => {
    // Sanity: the solver is Black, so White's e2e4 is not even a legal move for them.
    const { solveState } = puzzleToSolveState(fen, moves, 0);
    const board = new Chess(solveState.position);
    expect(board.turn()).toBe("b");
  });

  it("falls back gracefully when the line is empty", () => {
    const { solveState, orientation, setupMove } = puzzleToSolveState(
      fen,
      "",
      0,
    );
    expect(setupMove).toBeNull();
    expect(solveState.solutionLine).toEqual([]);
    expect(orientation).toBe("white");
    expect(solveState.position).toBe(fen);
  });
});
