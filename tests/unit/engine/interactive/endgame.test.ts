import { describe, expect, it } from "vitest";

import {
  classifyTerminal,
  scoreEndgame,
  endgamePlayerColor,
  endgameOrientation,
  type EndgameOutcome,
} from "@/engine/interactive/endgame";

const MATE_FEN = "k7/Q7/K7/8/8/8/8/8 b - - 1 1"; // Black (to move) is checkmated
const STALEMATE_FEN = "k7/8/1Q6/8/8/8/8/K7 b - - 0 1"; // Black has no move, not in check
const INSUFFICIENT_FEN = "k7/8/K7/8/8/8/8/7B w - - 0 1"; // KB vs K
const START_FEN = "4k3/8/8/8/8/4K3/4Q3/8 w - - 0 1"; // ongoing KQ vs K

describe("endgamePlayerColor / endgameOrientation", () => {
  it("are the side to move in the start position", () => {
    expect(endgamePlayerColor(START_FEN)).toBe("w");
    expect(endgameOrientation(START_FEN)).toBe("white");
    expect(endgamePlayerColor("4k3/8/8/8/8/4K3/4q3/8 b - - 0 1")).toBe("b");
    expect(endgameOrientation("4k3/8/8/8/8/4K3/4q3/8 b - - 0 1")).toBe("black");
  });

  it("rejects a malformed FEN", () => {
    expect(() => endgamePlayerColor("not a fen")).toThrow();
    expect(() => classifyTerminal("not a fen", "w")).toThrow();
  });
});

describe("classifyTerminal", () => {
  it("is player_won when the OPPONENT is checkmated", () => {
    expect(classifyTerminal(MATE_FEN, "w")).toBe<EndgameOutcome>("player_won");
  });

  it("is player_lost when the PLAYER is checkmated", () => {
    // Same mate position, but from the mated side's perspective.
    expect(classifyTerminal(MATE_FEN, "b")).toBe<EndgameOutcome>("player_lost");
  });

  it("is draw on stalemate", () => {
    expect(classifyTerminal(STALEMATE_FEN, "w")).toBe<EndgameOutcome>("draw");
    expect(classifyTerminal(STALEMATE_FEN, "b")).toBe<EndgameOutcome>("draw");
  });

  it("is draw on insufficient material", () => {
    expect(classifyTerminal(INSUFFICIENT_FEN, "w")).toBe<EndgameOutcome>(
      "draw",
    );
  });

  it("is unresolved while the game is still going", () => {
    expect(classifyTerminal(START_FEN, "w")).toBe<EndgameOutcome>("unresolved");
  });
});

describe("scoreEndgame", () => {
  it("WIN objective: correct only on a delivered checkmate", () => {
    expect(scoreEndgame("player_won", "win").correct).toBe(true);
    expect(scoreEndgame("draw", "win").correct).toBe(false);
    expect(scoreEndgame("player_lost", "win").correct).toBe(false);
    expect(scoreEndgame("unresolved", "win").correct).toBe(false);
  });

  it("DRAW objective: correct on a held draw (or a better-than-needed win)", () => {
    expect(scoreEndgame("draw", "draw").correct).toBe(true);
    expect(scoreEndgame("player_won", "draw").correct).toBe(true);
    expect(scoreEndgame("player_lost", "draw").correct).toBe(false);
    expect(scoreEndgame("unresolved", "draw").correct).toBe(false);
  });

  it("carries the outcome + objective + a process-focused reason", () => {
    const s = scoreEndgame("player_won", "win");
    expect(s).toMatchObject({
      correct: true,
      outcome: "player_won",
      objective: "win",
    });
    expect(s.reason).toMatch(/checkmate/i);
  });
});
