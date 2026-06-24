// Resource catalog builder (BUILD.md §5.3). A ResourceRef points at an EXTERNAL
// resource — never hosted content (VISION §6). For M3 the catalog is the set of
// Lichess puzzle-theme training pages, each with a resolvable external URL. Pure +
// golden-tested; seeded idempotently by scripts/seed-resources.ts using the
// deterministic ids minted here. Building the catalog is reference data, not a graded
// methodology decision (L1): which resource to PRESCRIBE for a weakness is Seam 4.

import { humanizeTheme } from "@/integrations/puzzles/themes";

export interface ResourceRefInput {
  /** Deterministic id so re-seeding upserts instead of duplicating. */
  id: string;
  type: string;
  title: string;
  externalUrl: string | null;
  provider: string;
  metadata: Record<string, unknown>;
  /** Links to a Seam-4 ActivityDefinition; populated once methodology lands (M4+). */
  methodologyKey: string | null;
}

/** The Lichess training page for a puzzle theme — a real, resolvable external URL. */
export function lichessThemeUrl(theme: string): string {
  return `https://lichess.org/training/${theme}`;
}

/** A friction-reducing deep link to START A GAME on the user's preferred platform. Both
 *  platforms gate time-control selection behind their own lobby UI rather than a stable GET
 *  param, so we link to the play lobby (one click from a real seek). Infra reference data —
 *  which platform to send the user to is the user's stored preference, not a graded
 *  methodology decision (L1). */
export function platformPlayUrl(platform: string | null | undefined): string {
  return platform === "chesscom"
    ? "https://www.chess.com/play/online"
    : "https://lichess.org/";
}

/** Build one `lichess_puzzle_theme` ResourceRef per trainable theme. */
export function buildResourceCatalog(
  themes: readonly string[],
): ResourceRefInput[] {
  return themes.map((theme) => ({
    id: `lichess_theme_${theme}`,
    type: "lichess_puzzle_theme",
    title: `${humanizeTheme(theme)} puzzles`,
    externalUrl: lichessThemeUrl(theme),
    provider: "lichess",
    metadata: { theme },
    methodologyKey: null,
  }));
}
