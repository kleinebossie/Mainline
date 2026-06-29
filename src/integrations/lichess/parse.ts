// Pure mapping of a Lichess game-export JSON object → ImportedGameInput (BUILD.md
// §6.2). No network, no clock — golden-testable. Emits RAW facts only (result is a
// game outcome, not a chess judgement); nothing here is interpreted (L1).

import type { ImportedGameInput } from "@/integrations/adapter";
import { pgnTag } from "@/integrations/pgn";

// Shape of the NDJSON the Lichess games export returns with
// `pgnInJson=true&clocks=true&evals=true&opening=true` (subset we read).
export interface LichessGame {
  id: string;
  createdAt: number; // epoch ms
  lastMoveAt?: number;
  speed?: string; // bullet | blitz | rapid | classical | correspondence
  winner?: "white" | "black";
  status?: string;
  clock?: { initial?: number; increment?: number };
  opening?: { eco?: string; name?: string };
  players?: {
    white?: { user?: { name?: string }; rating?: number };
    black?: { user?: { name?: string }; rating?: number };
  };
  pgn?: string;
  variant?: string; // e.g. "standard", "chess960", etc.
}

function sideOf(game: LichessGame, username: string): "w" | "b" | undefined {
  const u = username.trim().toLowerCase();
  const white = game.players?.white?.user?.name?.toLowerCase();
  const black = game.players?.black?.user?.name?.toLowerCase();
  if (white === u) return "w";
  if (black === u) return "b";
  return undefined;
}

function resultFor(
  winner: LichessGame["winner"],
  color: "w" | "b" | undefined,
): ImportedGameInput["result"] {
  if (!winner) return "draw";
  if (!color) return undefined;
  const won =
    (winner === "white" && color === "w") ||
    (winner === "black" && color === "b");
  return won ? "win" : "loss";
}

function timeControlOf(game: LichessGame): string | undefined {
  if (game.clock?.initial != null) {
    return `${game.clock.initial}+${game.clock.increment ?? 0}`;
  }
  return game.speed;
}

export function parseLichessGame(
  game: LichessGame,
  username: string,
): ImportedGameInput | null {
  if (game.variant && game.variant !== "standard") {
    return null;
  }
  const color = sideOf(game, username);
  const pgn = game.pgn ?? "";
  return {
    platform: "lichess",
    externalGameId: game.id,
    dedupeKey: `lichess:${game.id}`,
    pgn,
    playedAt: game.createdAt,
    timeControl: timeControlOf(game),
    color,
    result: resultFor(game.winner, color),
    userRatingAtGame:
      color === "w"
        ? game.players?.white?.rating
        : color === "b"
          ? game.players?.black?.rating
          : undefined,
    opponentRating:
      color === "w"
        ? game.players?.black?.rating
        : color === "b"
          ? game.players?.white?.rating
          : undefined,
    eco: game.opening?.eco ?? pgnTag(pgn, "ECO"),
    opening: game.opening?.name ?? pgnTag(pgn, "Opening"),
    source: "lichess",
  };
}

/** Parse a raw NDJSON export body into games, skipping blank lines. */
export function parseLichessNdjson(
  body: string,
  username: string,
): ImportedGameInput[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => parseLichessGame(JSON.parse(line) as LichessGame, username))
    .filter((g): g is ImportedGameInput => g !== null);
}
