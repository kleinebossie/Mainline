import { Chess, type Move } from "chess.js";
import type { EpochMs } from "@/lib/clock";

export type San = string;

export interface SolveState {
  position: string;
  solutionLine: San[];
  cursor: number;
  checkpointPosition?: string;
  checkpointCursor?: number;
  startedMs: EpochMs;
  attempts: number;
}

export interface StepResult {
  state: SolveState;
  step: "correct" | "wrong" | "solved" | "continue";
  solveMs: number;
  /** Legal-but-wrong move position; callers may show it briefly before resetting. */
  transientPosition?: string;
  /** Stable position the board should return to after feedback. */
  checkpointPosition: string;
  wrongMoveKind?: "legal" | "illegal";
}

/**
 * Pure state machine to process a move guess in an interactive puzzle or drill.
 * Matches `move` against the supplied solutionLine, handles timing, and automatically
 * plays the opponent's reply moves. Does not use Date.now or hardcode science.
 */
export function stepSolve(
  state: SolveState,
  move: { san: San; atMs: EpochMs },
): StepResult {
  const solveMs = Math.max(0, move.atMs - state.startedMs);
  const checkpointPosition = state.checkpointPosition ?? state.position;
  const checkpointCursor = state.checkpointCursor ?? state.cursor;

  if (state.cursor >= state.solutionLine.length) {
    return {
      state,
      step: "solved",
      solveMs,
      checkpointPosition,
    };
  }

  const chess = new Chess(state.position);
  let moveResult: Move;
  try {
    moveResult = applyMove(chess, move.san);
  } catch {
    return {
      state: {
        ...state,
        position: checkpointPosition,
        cursor: checkpointCursor,
        checkpointPosition,
        checkpointCursor,
        attempts: state.attempts + 1,
      },
      step: "wrong",
      solveMs,
      checkpointPosition,
      wrongMoveKind: "illegal",
    };
  }

  const expected = state.solutionLine[state.cursor];
  if (!expected) {
    return {
      state: {
        ...state,
        position: checkpointPosition,
        cursor: checkpointCursor,
        checkpointPosition,
        checkpointCursor,
        attempts: state.attempts + 1,
      },
      step: "wrong",
      solveMs,
      checkpointPosition,
      transientPosition: chess.fen(),
      wrongMoveKind: "legal",
    };
  }

  const playedSan = moveResult.san;
  const playedUci =
    moveResult.from + moveResult.to + (moveResult.promotion || "");

  const isCorrect = playedSan === expected || playedUci === expected;
  if (!isCorrect) {
    return {
      state: {
        ...state,
        position: checkpointPosition,
        cursor: checkpointCursor,
        checkpointPosition,
        checkpointCursor,
        attempts: state.attempts + 1,
      },
      step: "wrong",
      solveMs,
      checkpointPosition,
      transientPosition: chess.fen(),
      wrongMoveKind: "legal",
    };
  }

  let currentFen = chess.fen();
  let nextCursor = state.cursor + 1;

  while (nextCursor < state.solutionLine.length && nextCursor % 2 === 1) {
    const opponentMove = state.solutionLine[nextCursor];
    if (!opponentMove) break;
    applyMove(chess, opponentMove);
    currentFen = chess.fen();
    nextCursor++;
  }

  const isSolved = nextCursor >= state.solutionLine.length;

  return {
    state: {
      ...state,
      position: currentFen,
      cursor: nextCursor,
      checkpointPosition: currentFen,
      checkpointCursor: nextCursor,
    },
    step: isSolved ? "solved" : "continue",
    solveMs,
    checkpointPosition: currentFen,
  };
}

function applyMove(chess: Chess, notation: string): Move {
  try {
    return chess.move(notation);
  } catch {
    const from = notation.substring(0, 2);
    const to = notation.substring(2, 4);
    const promotion =
      notation.length > 4 ? notation.substring(4, 5) : undefined;
    return chess.move({ from, to, promotion });
  }
}
