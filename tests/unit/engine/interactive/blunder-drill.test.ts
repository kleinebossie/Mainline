import { describe, expect, it } from "vitest";

import { deriveBlunderDrills } from "@/engine/interactive/blunder-drill";

// M12 — deterministic blunder → PracticeItem derivation (golden). Keeps only blunders that
// clear the config severity floor, carry a FEN, and have a resolved best move; ply-ascending,
// deduped, idempotent sourceRef.

const blunders = [
  { ply: 3, fen: "FEN3", cpLoss: 300 },
  { ply: 7, fen: "FEN7", cpLoss: 120 }, // below the floor → dropped
  { ply: 9, fen: "", cpLoss: 400 }, // no FEN → dropped
  { ply: 11, fen: "FEN11", cpLoss: 500 }, // no best move → dropped
  { ply: 13, fen: "FEN13", cpLoss: 250 },
];
const bestMoveByPly = { 3: "e2e4", 7: "d7d5", 13: "g1f3" };

describe("deriveBlunderDrills", () => {
  it("keeps drillable blunders and builds idempotent drafts (ply-ascending)", () => {
    const drafts = deriveBlunderDrills(
      { gameId: "g1", blunders, bestMoveByPly },
      { minCpLoss: 150 },
    );
    expect(drafts).toEqual([
      {
        kind: "blunder_drill",
        fen: "FEN3",
        solutionLine: ["e2e4"],
        sourceRef: "blunder:g1:3",
      },
      {
        kind: "blunder_drill",
        fen: "FEN13",
        solutionLine: ["g1f3"],
        sourceRef: "blunder:g1:13",
      },
    ]);
  });

  it("is deterministic regardless of input order and dedupes a repeated ply", () => {
    const shuffled = [blunders[4]!, blunders[0]!, { ...blunders[0]! }];
    const drafts = deriveBlunderDrills(
      { gameId: "g1", blunders: shuffled, bestMoveByPly },
      { minCpLoss: 150 },
    );
    expect(drafts.map((d) => d.sourceRef)).toEqual([
      "blunder:g1:3",
      "blunder:g1:13",
    ]);
  });

  it("a higher severity floor admits fewer drills", () => {
    // At 260cp only ply 3 (300) clears it; ply 13 (250) drops out.
    const drafts = deriveBlunderDrills(
      { gameId: "g1", blunders, bestMoveByPly },
      { minCpLoss: 260 },
    );
    expect(drafts.map((d) => d.sourceRef)).toEqual(["blunder:g1:3"]);
  });
});
