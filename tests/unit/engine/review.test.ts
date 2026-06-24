import { describe, expect, it } from "vitest";

import { projectEvalGraph, userIsMover } from "@/engine/review";
import type { RawGameFeatures } from "@/lib/raw-features";

// M12 — eval-graph projection (golden). Re-bases the analysis's mover-perspective cp into a
// single user-perspective advantage curve and marks the user's blunder plies. Pure transform.

const moveEvals: RawGameFeatures["moveEvals"] = [
  { ply: 1, cpBefore: 20, cpAfter: 30, cpLoss: 0 }, // White (user) move
  { ply: 2, cpBefore: 30, cpAfter: 40, cpLoss: 0 }, // Black (opp) move, Black POV
  { ply: 3, cpBefore: 30, cpAfter: -200, cpLoss: 300 }, // White (user) blunder
  { ply: 4, cpBefore: 200, cpAfter: 250, cpLoss: 0 }, // Black (opp) move
];

describe("userIsMover", () => {
  it("White moves on odd plies, Black on even", () => {
    expect(userIsMover(1, "w")).toBe(true);
    expect(userIsMover(2, "w")).toBe(false);
    expect(userIsMover(1, "b")).toBe(false);
    expect(userIsMover(2, "b")).toBe(true);
  });
});

describe("projectEvalGraph", () => {
  it("projects to the user's perspective and marks user blunders (White)", () => {
    const points = projectEvalGraph(moveEvals, "w", new Set([3]));
    expect(points).toEqual([
      { ply: 1, cp: 30, userMove: true, cpLoss: 0, blunder: false },
      { ply: 2, cp: -40, userMove: false, cpLoss: 0, blunder: false },
      { ply: 3, cp: -200, userMove: true, cpLoss: 300, blunder: true },
      { ply: 4, cp: -250, userMove: false, cpLoss: 0, blunder: false },
    ]);
  });

  it("flips the perspective and user/opponent roles for a Black player", () => {
    const points = projectEvalGraph(moveEvals, "b", new Set());
    // Now odd plies are the opponent (negated, no cpLoss attributed to the user) and even
    // plies are the user's own moves (cp kept as-is).
    expect(points[0]).toEqual({
      ply: 1,
      cp: -30,
      userMove: false,
      cpLoss: 0,
      blunder: false,
    });
    expect(points[1]).toEqual({
      ply: 2,
      cp: 40,
      userMove: true,
      cpLoss: 0,
      blunder: false,
    });
  });

  it("never marks an opponent ply as a blunder even if its ply is in the set", () => {
    // ply 2 is the opponent's for a White player; it must stay unmarked.
    const points = projectEvalGraph(moveEvals, "w", new Set([2, 3]));
    expect(points[1]!.blunder).toBe(false);
    expect(points[2]!.blunder).toBe(true);
  });
});
