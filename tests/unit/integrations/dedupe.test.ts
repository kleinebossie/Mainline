import { describe, expect, it } from "vitest";

import type { ImportedGameInput } from "@/integrations/adapter";
import { dedupeImportedGames } from "@/integrations/dedupe";

// M2 DoD: import is idempotent. The DB unique (userId, dedupeKey) covers cross-run
// idempotency; this covers within-batch collapse (first occurrence wins).

function game(id: string, rating: number): ImportedGameInput {
  return {
    platform: "lichess",
    externalGameId: id,
    dedupeKey: `lichess:${id}`,
    pgn: "",
    playedAt: 0,
    source: "lichess",
    userRatingAtGame: rating,
  };
}

describe("dedupeImportedGames", () => {
  it("removes duplicate dedupeKeys, keeping the first", () => {
    const out = dedupeImportedGames([
      game("a", 1),
      game("b", 2),
      game("a", 99), // duplicate key — dropped
    ]);
    expect(out.map((g) => g.dedupeKey)).toEqual(["lichess:a", "lichess:b"]);
    expect(out[0]?.userRatingAtGame).toBe(1); // first occurrence wins
  });

  it("is a no-op on an already-distinct batch (idempotent)", () => {
    const batch = [game("a", 1), game("b", 2)];
    expect(dedupeImportedGames(dedupeImportedGames(batch))).toEqual(
      dedupeImportedGames(batch),
    );
  });
});
