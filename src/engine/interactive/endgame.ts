// Pure chess-rule mechanics for played-out endgame drills. Methodology supplies the objective.

import { Chess } from "chess.js";
import type { BoardOrientation } from "./puzzle";

export type EndgameObjective = "win" | "draw";

export type PlayerColor = "w" | "b";

/** The result of playing the drill out, from the drilling player's perspective. */
export type EndgameOutcome =
  | "player_won"
  | "player_lost"
  | "draw"
  | "unresolved";

export interface EndgameScore {
  /** Whether the played-out result satisfies the drill's required objective. */
  correct: boolean;
  outcome: EndgameOutcome;
  objective: EndgameObjective;
  reason: string;
}

export function endgamePlayerColor(fen: string): PlayerColor {
  return new Chess(fen).turn();
}

/** Board orientation for the drilling player (whose turn it is in the start position). */
export function endgameOrientation(fen: string): BoardOrientation {
  return endgamePlayerColor(fen) === "w" ? "white" : "black";
}

/** Classify a terminal position from the drilling player's perspective. */
export function classifyTerminal(
  fen: string,
  playerColor: PlayerColor,
): EndgameOutcome {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    // The side to move is the one checkmated.
    return chess.turn() === playerColor ? "player_lost" : "player_won";
  }
  if (chess.isStalemate() || chess.isInsufficientMaterial() || chess.isDraw()) {
    return "draw";
  }
  return "unresolved";
}

/**
 * Judge a played-out endgame against its required objective. Deterministic (golden-tested).
 *
 * - `win`: correct only when the player actually delivered checkmate.
 * - `draw`: correct when the player held the draw (over-performing into a win also counts);
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
        "You converted the win: checkmate delivered.",
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
        "A winning endgame was let slip to a draw. The conversion technique is the lesson here.",
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
      "You held the draw. The defensive technique worked.",
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
      "A holdable position was lost. The drawing method is the lesson here.",
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
