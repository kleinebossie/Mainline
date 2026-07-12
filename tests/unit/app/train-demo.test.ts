import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";

import {
  DEMO_ENDGAME_FEN,
  DEMO_PUZZLE_FEN,
  DEMO_PUZZLE_SOLUTION,
} from "@/app/train/train-demo-fixtures";
import {
  classifyTerminal,
  endgamePlayerColor,
  scoreEndgame,
} from "@/engine/interactive/endgame";
import { stepSolve, type SolveState } from "@/engine/interactive/session";

describe("standalone training demo", () => {
  it("solves the displayed rook puzzle with Ra8 mate", () => {
    const initial: SolveState = {
      position: DEMO_PUZZLE_FEN,
      solutionLine: DEMO_PUZZLE_SOLUTION,
      cursor: 0,
      startedMs: 0,
      attempts: 0,
    };

    const result = stepSolve(initial, { san: "Ra8#", atMs: 1000 });

    expect(result.step).toBe("solved");
    expect(result.state.cursor).toBe(1);
  });

  it("scores the displayed queen endgame after Qa7 mate", () => {
    const chess = new Chess(DEMO_ENDGAME_FEN);
    chess.move("Qa7#");

    const outcome = classifyTerminal(
      chess.fen(),
      endgamePlayerColor(DEMO_ENDGAME_FEN),
    );

    expect(chess.isCheckmate()).toBe(true);
    expect(scoreEndgame(outcome, "win")).toMatchObject({ correct: true });
  });
});
