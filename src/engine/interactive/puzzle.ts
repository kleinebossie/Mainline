import { Chess } from "chess.js";
import type { EpochMs } from "@/lib/clock";
import type { SolveState } from "./session";

// Generic, science-free puzzle setup (L1/L2). Lichess puzzle rows store the position
// in the canonical Lichess format: `fen` is the position BEFORE the opponent's setup
// move, and `moves` is a UCI line whose FIRST move is that opponent setup move. The
// position the solver actually faces is reached by playing moves[0]; the player then
// has to find moves[1], moves[3], … (the engine auto-replies moves[2], moves[4], …).
//
// `stepSolve` (session.ts) expects `solutionLine[0]` to be the PLAYER's move and treats
// odd indices as auto-played opponent replies. So feeding it the raw fen + full move list
// is off by one: it would ask the player to make the opponent's setup move, from the wrong
// side of the board. This helper applies the setup move once, hands `stepSolve` a line that
// starts with the player's move, and derives the orientation as the player's side — the
// single place that translation happens.

export type BoardOrientation = "white" | "black";

export interface PuzzleSetup {
  solveState: SolveState;
  /** The side the solver is playing (whose turn it is after the setup move). */
  orientation: BoardOrientation;
  /** The opponent's setup move (UCI) already applied to reach the start position, or null. */
  setupMove: string | null;
}

/**
 * Convert a raw Lichess-format puzzle into a ready-to-solve {@link SolveState}.
 *
 * @param fen   the puzzle FEN as ingested (before the opponent's setup move)
 * @param moves the space-separated UCI line (moves[0] is the opponent's setup move)
 * @param startedMs solve clock origin (from the injected Clock, never the wall clock — L2)
 */
export function puzzleToSolveState(
  fen: string,
  moves: string,
  startedMs: EpochMs,
): PuzzleSetup {
  const line = moves.trim().length > 0 ? moves.trim().split(/\s+/) : [];
  const chess = safeChess(fen);

  // Apply the opponent's setup move so the solver faces the real puzzle position and
  // `solutionLine[0]` is the player's move. If applying it fails (malformed data), fall
  // back to the raw position + full line so the surface still renders something legal.
  let setupMove: string | null = null;
  let solutionLine = line;
  const first = line[0];
  if (first && applyUci(chess, first)) {
    setupMove = first;
    solutionLine = line.slice(1);
  }

  return {
    solveState: {
      position: chess.fen(),
      solutionLine,
      cursor: 0,
      startedMs,
      attempts: 0,
    },
    orientation: chess.turn() === "w" ? "white" : "black",
    setupMove,
  };
}

/**
 * Convert a blunder drill (or any "you are to move here" practice position) into a
 * {@link SolveState}. Unlike a Lichess puzzle there is NO opponent setup move — the `fen`
 * IS the position the solver faces and `solutionLine[0]` is already the player's move — so
 * this skips the setup-move translation `puzzleToSolveState` does.
 *
 * @param fen           the position the solver faces
 * @param solutionLine  the known answer (UCI/SAN); the player must find `solutionLine[0]`
 * @param startedMs     solve clock origin (from the injected Clock, never the wall clock — L2)
 */
export function drillToSolveState(
  fen: string,
  solutionLine: readonly string[],
  startedMs: EpochMs,
): PuzzleSetup {
  const chess = safeChess(fen);
  return {
    solveState: {
      position: chess.fen(),
      solutionLine: [...solutionLine],
      cursor: 0,
      startedMs,
      attempts: 0,
    },
    orientation: chess.turn() === "w" ? "white" : "black",
    setupMove: null,
  };
}

/** Apply a UCI move to the board in place; return true on success, false if illegal. */
function applyUci(chess: Chess, uci: string): boolean {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  try {
    chess.move({ from, to, promotion });
    return true;
  } catch {
    return false;
  }
}

function safeChess(fen: string): Chess {
  try {
    return new Chess(fen);
  } catch {
    return new Chess();
  }
}
