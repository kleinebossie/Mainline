import { describe, expect, it } from "vitest";

import { buildResourceCatalog, lichessThemeUrl } from "@/integrations/catalog";
import {
  humanizeTheme,
  LICHESS_PUZZLE_THEMES,
} from "@/integrations/puzzles/themes";

describe("humanizeTheme", () => {
  it("humanizes camelCase keys and honors overrides", () => {
    expect(humanizeTheme("fork")).toBe("Fork");
    expect(humanizeTheme("rookEndgame")).toBe("Rook Endgame");
    expect(humanizeTheme("hangingPiece")).toBe("Hanging Piece");
    expect(humanizeTheme("mateIn2")).toBe("Mate in 2");
    expect(humanizeTheme("enPassant")).toBe("En passant");
    expect(humanizeTheme("xRayAttack")).toBe("X-ray attack");
  });
});

describe("buildResourceCatalog", () => {
  it("builds one resolvable lichess_puzzle_theme ResourceRef per theme (golden)", () => {
    expect(buildResourceCatalog(["fork", "mateIn2"])).toEqual([
      {
        id: "lichess_theme_fork",
        type: "lichess_puzzle_theme",
        title: "Fork puzzles",
        externalUrl: "https://lichess.org/training/fork",
        provider: "lichess",
        metadata: { theme: "fork" },
        methodologyKey: null,
      },
      {
        id: "lichess_theme_mateIn2",
        type: "lichess_puzzle_theme",
        title: "Mate in 2 puzzles",
        externalUrl: "https://lichess.org/training/mateIn2",
        provider: "lichess",
        metadata: { theme: "mateIn2" },
        methodologyKey: null,
      },
    ]);
  });

  it("gives every catalog entry a resolvable external URL and a unique id", () => {
    const cat = buildResourceCatalog(LICHESS_PUZZLE_THEMES);
    expect(cat.length).toBe(LICHESS_PUZZLE_THEMES.length);
    for (const r of cat) {
      expect(r.externalUrl).toMatch(
        /^https:\/\/lichess\.org\/training\/[A-Za-z0-9]+$/,
      );
    }
    expect(new Set(cat.map((r) => r.id)).size).toBe(cat.length);
  });

  it("lichessThemeUrl points at the training page", () => {
    expect(lichessThemeUrl("pin")).toBe("https://lichess.org/training/pin");
  });
});
