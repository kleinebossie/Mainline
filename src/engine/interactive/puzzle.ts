import { Chess } from "chess.js";
import type { EpochMs } from "@/lib/clock";
import type { SolveState } from "./session";

// Lichess puzzle FENs precede the opponent's setup move. Apply the first UCI move so the
// solve state starts with the player's turn and answer.

export type BoardOrientation = "white" | "black";

export interface PuzzleSetup {
  solveState: SolveState;
  orientation: BoardOrientation;
}

/** Convert a Lichess-format puzzle into a ready-to-solve state. */
export function puzzleToSolveState(
  fen: string,
  moves: string,
  startedMs: EpochMs,
): PuzzleSetup {
  const line = moves.trim().split(/\s+/).filter(Boolean);
  const chess = new Chess(fen);

  let solutionLine = line;
  const first = line[0];
  if (first) {
    applyUci(chess, first);
    solutionLine = line.slice(1);
  }
  return buildSetup(chess, solutionLine, startedMs);
}

/** Convert a position where the player is already to move into a solve state. */
export function drillToSolveState(
  fen: string,
  solutionLine: readonly string[],
  startedMs: EpochMs,
): PuzzleSetup {
  return buildSetup(new Chess(fen), solutionLine, startedMs);
}

function buildSetup(
  chess: Chess,
  solutionLine: readonly string[],
  startedMs: EpochMs,
): PuzzleSetup {
  const position = chess.fen();
  return {
    solveState: {
      position,
      solutionLine: [...solutionLine],
      cursor: 0,
      checkpointPosition: position,
      checkpointCursor: 0,
      startedMs,
      attempts: 0,
    },
    orientation: chess.turn() === "w" ? "white" : "black",
  };
}

function applyUci(chess: Chess, uci: string): void {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  chess.move({ from, to, promotion });
}
