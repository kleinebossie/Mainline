// In-app endgame drill mechanics (BUILD.md M13) — PURE (L2), science-free (L1). The user
// plays a curated endgame position OUT against the client-side chess engine; this module
// turns the played-out board into a result and judges it against the drill's OBJECTIVE.
//
// L1: the OBJECTIVE ("win" / "draw") is a methodology decision (Seam-4 endgame curriculum)
// the caller passes in — exactly as the blunder-drill engine takes the config blunder
// threshold as a number. This module only knows chess RULES (chess.js), never chess MERIT:
// "did the played-out game end in a win/draw/loss for the player, and does that satisfy the
// required technique outcome?" Deterministic given its inputs, so it is golden-testable.

import { Chess } from "chess.js";
import type { BoardOrientation } from "./puzzle";

/** The technique target a curated endgame requires (mirrors the config `objective` value). */
export type EndgameObjective = "win" | "draw";

export type PlayerColor = "w" | "b";

/** The result of playing the drill out, from the drilling player's perspective. */
export type EndgameOutcome =
  | "player_won" // the player delivered checkmate (or the engine was mated)
  | "player_lost" // the player got checkmated
  | "draw" // stalemate / insufficient material / 50-move / threefold
  | "unresolved"; // the game is not over yet (player gave up / hit a move cap)

export interface EndgameScore {
  /** Whether the played-out result satisfies the drill's required objective. */
  correct: boolean;
  outcome: EndgameOutcome;
  objective: EndgameObjective;
  /** A short, process-focused reason (Seam-20 feedback-on-task, never on the player). */
  reason: string;
}

/** The side to move in `fen` — the side the drilling player controls. Falls back to white
 *  on a malformed FEN so a surface never crashes (mirrors puzzle.ts `safeChess`). */
export function endgamePlayerColor(fen: string): PlayerColor {
  return safeChess(fen).turn();
}

/** Board orientation for the drilling player (whose turn it is in the start position). */
export function endgameOrientation(fen: string): BoardOrientation {
  return endgamePlayerColor(fen) === "w" ? "white" : "black";
}

/**
 * Classify a position reached during/after play-out into an {@link EndgameOutcome}, from
 * `playerColor`'s perspective. Pure: same (fen, playerColor) → same outcome. A position
 * that is not yet over is `unresolved` (the caller decides when to stop — game over, a move
 * cap, or the player giving up).
 */
export function classifyTerminal(
  fen: string,
  playerColor: PlayerColor,
): EndgameOutcome {
  const chess = safeChess(fen);
  if (chess.isCheckmate()) {
    // The side to move is the one checkmated.
    return chess.turn() === playerColor ? "player_lost" : "player_won";
  }
  if (
    chess.isStalemate() ||
    chess.isInsufficientMaterial() ||
    chess.isDraw() // 50-move rule or threefold repetition
  ) {
    return "draw";
  }
  return "unresolved";
}

/**
 * Judge a played-out endgame against its required objective. Deterministic (golden-tested).
 *
 * - `win`  → correct only when the player actually delivered checkmate.
 * - `draw` → correct when the player held the draw (over-performing into a win also counts);
 *            losing or not finishing fails.
 */
export function scoreEndgame(
  outcome: EndgameOutcome,
  objective: EndgameObjective,
): EndgameScore {
  if (objective === "win") {
    if (outcome === "player_won")
      return mk(
        true,
        outcome,
        objective,
        "You converted the win — checkmate delivered.",
      );
    if (outcome === "player_lost")
      return mk(
        false,
        outcome,
        objective,
        "The win slipped: this game ended in checkmate against you.",
      );
    if (outcome === "draw")
      return mk(
        false,
        outcome,
        objective,
        "A winning endgame was let slip to a draw — the technique to convert is the lesson here.",
      );
    return mk(
      false,
      outcome,
      objective,
      "The endgame wasn't converted to mate this time.",
    );
  }
  // objective === "draw"
  if (outcome === "draw")
    return mk(
      true,
      outcome,
      objective,
      "You held the draw — the defensive technique worked.",
    );
  if (outcome === "player_won")
    return mk(
      true,
      outcome,
      objective,
      "You did better than the draw the position called for.",
    );
  if (outcome === "player_lost")
    return mk(
      false,
      outcome,
      objective,
      "A holdable position was lost — the drawing method is the lesson here.",
    );
  return mk(false, outcome, objective, "The draw wasn't secured this time.");
}

function mk(
  correct: boolean,
  outcome: EndgameOutcome,
  objective: EndgameObjective,
  reason: string,
): EndgameScore {
  return { correct, outcome, objective, reason };
}

function safeChess(fen: string): Chess {
  try {
    return new Chess(fen);
  } catch {
    return new Chess();
  }
}
