import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { puzzleToSolveState } from "@/engine/interactive/puzzle";
import { stepSolve } from "@/engine/interactive/session";

describe("puzzleToSolveState (Lichess setup-move translation)", () => {
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const moves = "e2e4 c7c5 g1f3 d7d6";

  it("applies the opponent setup move and starts the line at the player's move", () => {
    const { solveState, orientation } = puzzleToSolveState(fen, moves, 1000);

    expect(orientation).toBe("black");
    expect(solveState.position).toContain(" b ");
    expect(solveState.solutionLine).toEqual(["c7c5", "g1f3", "d7d6"]);
    expect(solveState.cursor).toBe(0);
    expect(solveState.startedMs).toBe(1000);
  });

  it("produces a SolveState the player can actually solve via stepSolve", () => {
    const { solveState } = puzzleToSolveState(fen, moves, 0);

    const r1 = stepSolve(solveState, { san: "c5", atMs: 100 });
    expect(r1.step).toBe("continue");
    expect(r1.state.cursor).toBe(2);
    expect(r1.state.position).toContain(" b ");

    const r2 = stepSolve(r1.state, { san: "d6", atMs: 200 });
    expect(r2.step).toBe("solved");
  });

  it("rejects the opponent's setup move as a wrong first move would be impossible to play", () => {
    const { solveState } = puzzleToSolveState(fen, moves, 0);
    const board = new Chess(solveState.position);
    expect(board.turn()).toBe("b");
  });

  it("falls back gracefully when the line is empty", () => {
    const { solveState, orientation } = puzzleToSolveState(fen, "", 0);
    expect(solveState.solutionLine).toEqual([]);
    expect(orientation).toBe("white");
    expect(solveState.position).toBe(fen);
  });

  it("rejects malformed positions and illegal setup moves", () => {
    expect(() => puzzleToSolveState("not a fen", moves, 0)).toThrow();
    expect(() => puzzleToSolveState(fen, "e2e5 e7e5", 0)).toThrow();
  });
});
