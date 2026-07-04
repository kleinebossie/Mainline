import { Chess, type Move } from "chess.js";
import type { EpochMs } from "@/lib/clock";

export type San = string;

export interface SolveState {
  position: string; // Current FEN
  solutionLine: San[]; // Expected moves in SAN or UCI format
  cursor: number; // Current index in solutionLine
  checkpointPosition?: string; // Last accepted stable FEN; wrong legal moves reset here.
  checkpointCursor?: number; // Cursor paired with checkpointPosition.
  startedMs: EpochMs; // Start time of the solve attempt
  attempts: number; // Count of wrong attempts
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

  // If the puzzle is already solved, return it as solved
  if (state.cursor >= state.solutionLine.length) {
    return {
      state,
      step: "solved",
      solveMs,
      checkpointPosition,
    };
  }

  const chess = new Chess(state.position);
  let moveResult: Move | null = null;

  // 1. Try to parse and apply the move guess locally
  try {
    // Attempt 1: As standard SAN (e.g. "Nf3", "e4", "O-O")
    moveResult = chess.move(move.san);
  } catch {
    try {
      // Attempt 2: As UCI format (e.g. "g1f3", "e2e4", "e7e8q")
      const from = move.san.substring(0, 2);
      const to = move.san.substring(2, 4);
      const promotion =
        move.san.length > 4 ? move.san.substring(4, 5) : undefined;
      moveResult = chess.move({ from, to, promotion });
    } catch {
      // Illegal move on this board position -> treat as wrong guess
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
  }

  // 2. Validate if the legal move made matches the expected solution line move
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

  // 3. Move is correct! Advance board position and cursor.
  let currentFen = chess.fen();
  let nextCursor = state.cursor + 1;

  // 4. If there are subsequent opponent moves in the solution line (odd index), auto-play them
  while (nextCursor < state.solutionLine.length && nextCursor % 2 === 1) {
    const opponentMove = state.solutionLine[nextCursor];
    if (!opponentMove) break;
    try {
      // Try as SAN first
      chess.move(opponentMove);
    } catch {
      try {
        // Try as UCI next
        const from = opponentMove.substring(0, 2);
        const to = opponentMove.substring(2, 4);
        const promotion =
          opponentMove.length > 4 ? opponentMove.substring(4, 5) : undefined;
        chess.move({ from, to, promotion });
      } catch {
        // A malformed opponent reply is a data bug upstream; stop auto-playing the line
        // here and leave it to the caller. Stay pure — no I/O in the state machine.
        break;
      }
    }
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
