// Pure mapping of a Chess.com monthly-archive game object → ImportedGameInput
// (BUILD.md §6.3). No network, no clock — golden-testable. RAW facts only (L1).

import type { ImportedGameInput } from "@/integrations/adapter";
import { pgnTag } from "@/integrations/pgn";

// Subset of a Chess.com archive game we read. `end_time` is epoch SECONDS.
export interface ChessComGame {
  url?: string;
  pgn?: string;
  time_control?: string;
  time_class?: string;
  end_time?: number; // epoch seconds
  white?: { username?: string; rating?: number; result?: string };
  black?: { username?: string; rating?: number; result?: string };
  eco?: string; // usually an opening URL, not an ECO code
}

// Chess.com encodes the outcome per side as a string. "win" is the only winning
// code; the rest are either draws or losses. Raw mapping, not a chess judgement.
const DRAW_RESULTS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

function outcomeFor(
  sideResult: string | undefined,
): ImportedGameInput["result"] {
  if (!sideResult) return undefined;
  if (sideResult === "win") return "win";
  if (DRAW_RESULTS.has(sideResult)) return "draw";
  return "loss";
}

// Chess.com has no stable numeric game id field; the trailing path segment of the
// game URL (…/game/live/123456789) is the stable identifier.
export function gameIdFromUrl(url: string | undefined): string {
  if (!url) return "";
  const segs = url.split("/").filter(Boolean);
  return segs[segs.length - 1] ?? "";
}

function sideOf(game: ChessComGame, username: string): "w" | "b" | undefined {
  const u = username.trim().toLowerCase();
  if (game.white?.username?.toLowerCase() === u) return "w";
  if (game.black?.username?.toLowerCase() === u) return "b";
  return undefined;
}

export function parseChessComGame(
  game: ChessComGame,
  username: string,
): ImportedGameInput {
  const color = sideOf(game, username);
  const me =
    color === "w" ? game.white : color === "b" ? game.black : undefined;
  const opp =
    color === "w" ? game.black : color === "b" ? game.white : undefined;
  const id = gameIdFromUrl(game.url);
  const pgn = game.pgn ?? "";
  return {
    platform: "chesscom",
    externalGameId: id,
    dedupeKey: `chesscom:${id}`,
    pgn,
    playedAt: (game.end_time ?? 0) * 1000,
    timeControl: game.time_control ?? game.time_class,
    color,
    result: outcomeFor(me?.result),
    userRatingAtGame: me?.rating,
    opponentRating: opp?.rating,
    eco: pgnTag(pgn, "ECO"),
    opening: pgnTag(pgn, "Opening"),
    source: "chesscom",
  };
}
