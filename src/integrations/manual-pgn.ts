import { createHash } from "node:crypto";

import { Chess } from "chess.js";

export {
  MANUAL_PGN_MAX_BATCH_BYTES,
  MANUAL_PGN_MAX_GAME_BYTES,
  MANUAL_PGN_MAX_GAMES,
  MANUAL_PGN_MAX_PLIES,
} from "@/lib/manual-import";
import {
  MANUAL_PGN_MAX_BATCH_BYTES,
  MANUAL_PGN_MAX_GAME_BYTES,
  MANUAL_PGN_MAX_GAMES,
  MANUAL_PGN_MAX_PLIES,
} from "@/lib/manual-import";

export type ManualPgnBatchErrorCode =
  | "empty_input"
  | "batch_too_large"
  | "too_many_games";

export type ManualPgnRejectionCode =
  | "game_too_large"
  | "too_many_plies"
  | "no_moves"
  | "invalid";

export interface ManualPgnMetadata {
  white?: string;
  black?: string;
  event?: string;
  site?: string;
  round?: string;
  date?: string;
  utcDate?: string;
  timeControl?: string;
  result?: string;
  whiteElo?: string;
  blackElo?: string;
  eco?: string;
  opening?: string;
  variant?: string;
}

export interface ManualPgnValidEntry {
  status: "valid";
  index: number;
  canonicalPgn: string;
  plyCount: number;
  metadata: ManualPgnMetadata;
}

export interface ManualPgnRejectedEntry {
  status: "rejected";
  index: number;
  code: ManualPgnRejectionCode;
  message: string;
}

export interface ManualPgnUnsupportedEntry {
  status: "unsupported";
  index: number;
  code: "unsupported_variant";
  variant: string;
  message: string;
}

export type ManualPgnEntry =
  | ManualPgnValidEntry
  | ManualPgnRejectedEntry
  | ManualPgnUnsupportedEntry;

export interface ManualPgnParseSuccess {
  ok: true;
  totalBytes: number;
  entries: ManualPgnEntry[];
}

export interface ManualPgnParseFailure {
  ok: false;
  code: ManualPgnBatchErrorCode;
  message: string;
  totalBytes: number;
  gameCount?: number;
}

export type ManualPgnParseResult =
  | ManualPgnParseSuccess
  | ManualPgnParseFailure;

export type ManualPgnResultHeader = "1-0" | "0-1" | "1/2-1/2" | "*";

export interface ManualPgnHeaderOverrides {
  event?: string;
  playedDate?: string;
  timeControl?: string;
  resultHeader?: ManualPgnResultHeader;
  whiteRating?: number;
  blackRating?: number;
}

export interface FinalizedManualPgn {
  canonicalPgn: string;
  contentHash: string;
  plyCount: number;
  metadata: ManualPgnMetadata;
}

export type ManualPgnFinalizeErrorCode =
  | ManualPgnRejectionCode
  | "unsupported_variant"
  | "invalid_override";

export class ManualPgnFinalizeError extends Error {
  constructor(
    public readonly code: ManualPgnFinalizeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ManualPgnFinalizeError";
  }
}

const STANDARD_VARIANTS = new Set(["standard", "chess", "standard chess"]);
const HEADER_LINE = /^\s*\[[A-Za-z][A-Za-z0-9_]*\s+"(?:[^"\\]|\\.)*"\s*\]\s*$/;
const VARIANT_HEADER = /^\s*\[\s*Variant\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/gim;

const textEncoder = new TextEncoder();

function utf8Bytes(value: string): number {
  return textEncoder.encode(value).byteLength;
}

function normalizeInput(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Separates header-delimited games, including recovery after a malformed game
 * that never reaches a termination marker.
 */
function splitAtHeaderBlocks(pgn: string): string[] {
  const lines = pgn.match(/.*(?:\n|$)/g) ?? [];
  const chunks: string[] = [];
  let offset = 0;
  let gameStart = -1;
  let sawMovetext = false;

  for (const lineWithNewline of lines) {
    if (lineWithNewline.length === 0) continue;

    const lineStart = offset;
    offset += lineWithNewline.length;
    const line = lineWithNewline.replace(/\n$/, "");
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    if (gameStart < 0) gameStart = lineStart;

    if (HEADER_LINE.test(line)) {
      if (sawMovetext) {
        const previous = pgn.slice(gameStart, lineStart).trim();
        if (nonEmpty(previous)) chunks.push(previous);
        gameStart = lineStart;
        sawMovetext = false;
      }
      continue;
    }

    sawMovetext = true;
  }

  if (gameStart >= 0) {
    const finalChunk = pgn.slice(gameStart).trim();
    if (nonEmpty(finalChunk)) chunks.push(finalChunk);
  }

  return chunks;
}

function tokenBoundary(char: string | undefined): boolean {
  return char === undefined || /\s|[{}()[\];]/.test(char);
}

/** Split headerless concatenated games at top-level PGN result markers. */
function splitAtTerminationMarkers(pgn: string): string[] {
  const games: string[] = [];
  let start = 0;
  let braceComment = false;
  let lineComment = false;
  let tag = false;
  let variationDepth = 0;

  for (let index = 0; index < pgn.length; index += 1) {
    const char = pgn[index];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (braceComment) {
      if (char === "}") braceComment = false;
      continue;
    }
    if (tag) {
      if (char === "]") tag = false;
      continue;
    }

    if (char === ";") {
      lineComment = true;
      continue;
    }
    if (char === "{") {
      braceComment = true;
      continue;
    }
    if (char === "[") {
      tag = true;
      continue;
    }
    if (char === "(") {
      variationDepth += 1;
      continue;
    }
    if (char === ")") {
      variationDepth = Math.max(0, variationDepth - 1);
      continue;
    }
    if (variationDepth > 0) continue;

    const result = ["1/2-1/2", "1-0", "0-1", "*"].find((candidate) =>
      pgn.startsWith(candidate, index),
    );
    if (!result) continue;

    const end = index + result.length;
    if (!tokenBoundary(pgn[index - 1]) || !tokenBoundary(pgn[end])) continue;

    const game = pgn.slice(start, end).trim();
    if (nonEmpty(game)) games.push(game);
    start = end;
    index = end - 1;
  }

  const remainder = pgn.slice(start).trim();
  if (nonEmpty(remainder)) games.push(remainder);
  return games;
}

function splitPgnGames(pgn: string): string[] {
  return splitAtHeaderBlocks(pgn).flatMap(splitAtTerminationMarkers);
}

function unescapeHeaderValue(value: string): string {
  return value.replace(/\\([\\"])/g, "$1");
}

function rawVariantOf(pgn: string): string | undefined {
  let value: string | undefined;
  VARIANT_HEADER.lastIndex = 0;
  for (const match of pgn.matchAll(VARIANT_HEADER)) {
    value = unescapeHeaderValue(match[1] ?? "").trim();
  }
  return value;
}

function isStandardVariant(variant: string): boolean {
  return STANDARD_VARIANTS.has(variant.trim().toLowerCase());
}

function headerValue(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  const value = entry?.[1]?.trim();
  if (!value || value === "?" || value === "????.??.??") return undefined;
  return value;
}

function metadataOf(chess: Chess): ManualPgnMetadata {
  const headers = chess.getHeaders();
  return {
    white: headerValue(headers, "White"),
    black: headerValue(headers, "Black"),
    event: headerValue(headers, "Event"),
    site: headerValue(headers, "Site"),
    round: headerValue(headers, "Round"),
    date: headerValue(headers, "Date"),
    utcDate: headerValue(headers, "UTCDate"),
    timeControl: headerValue(headers, "TimeControl"),
    result: headerValue(headers, "Result"),
    whiteElo: headerValue(headers, "WhiteElo"),
    blackElo: headerValue(headers, "BlackElo"),
    eco: headerValue(headers, "ECO"),
    opening: headerValue(headers, "Opening"),
    variant: headerValue(headers, "Variant"),
  };
}

function rejection(
  index: number,
  code: ManualPgnRejectionCode,
): ManualPgnRejectedEntry {
  const messages: Record<ManualPgnRejectionCode, string> = {
    game_too_large: `This game exceeds the ${MANUAL_PGN_MAX_GAME_BYTES}-byte limit.`,
    too_many_plies: `This game exceeds the ${MANUAL_PGN_MAX_PLIES}-ply limit.`,
    no_moves: "This PGN does not contain any moves.",
    invalid: "This game could not be parsed as legal standard-chess PGN.",
  };
  return { status: "rejected", index, code, message: messages[code] };
}

function parseGame(pgn: string, index: number): ManualPgnEntry {
  if (utf8Bytes(pgn) > MANUAL_PGN_MAX_GAME_BYTES) {
    return rejection(index, "game_too_large");
  }

  const variant = rawVariantOf(pgn);
  if (variant !== undefined && !isStandardVariant(variant)) {
    return {
      status: "unsupported",
      index,
      code: "unsupported_variant",
      variant,
      message: "Only standard chess PGN is supported.",
    };
  }

  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const plyCount = chess.history().length;
    if (plyCount === 0) {
      return rejection(index, "no_moves");
    }
    if (plyCount > MANUAL_PGN_MAX_PLIES) {
      return rejection(index, "too_many_plies");
    }
    return {
      status: "valid",
      index,
      canonicalPgn: chess.pgn({ newline: "\n", maxWidth: 0 }),
      plyCount,
      metadata: metadataOf(chess),
    };
  } catch {
    return rejection(index, "invalid");
  }
}

/** Parse a pasted PGN string or decoded PGN file without coupling game failures. */
export function parseManualPgnBatch(input: string): ManualPgnParseResult {
  const totalBytes = utf8Bytes(input);
  if (totalBytes > MANUAL_PGN_MAX_BATCH_BYTES) {
    return {
      ok: false,
      code: "batch_too_large",
      message: `The PGN batch exceeds the ${MANUAL_PGN_MAX_BATCH_BYTES}-byte limit.`,
      totalBytes,
    };
  }

  const normalized = normalizeInput(input).trim();
  if (!nonEmpty(normalized)) {
    return {
      ok: false,
      code: "empty_input",
      message: "Paste PGN text or choose a non-empty PGN file.",
      totalBytes,
    };
  }

  const games = splitPgnGames(normalized);
  if (games.length > MANUAL_PGN_MAX_GAMES) {
    return {
      ok: false,
      code: "too_many_games",
      message: `A PGN batch can contain at most ${MANUAL_PGN_MAX_GAMES} games.`,
      totalBytes,
      gameCount: games.length,
    };
  }

  return {
    ok: true,
    totalBytes,
    entries: games.map(parseGame),
  };
}

function normalizedHeaderOverride(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().replace(/"/g, "'");
}

function pgnDate(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = days[month - 1];
  if (maxDay === undefined || day < 1 || day > maxDay) return undefined;
  return `${match[1]}.${match[2]}.${match[3]}`;
}

function applyTextHeader(chess: Chess, name: string, value: string): void {
  const normalized = normalizedHeaderOverride(value);
  if (!normalized) {
    throw new ManualPgnFinalizeError(
      "invalid_override",
      `${name} must not be blank.`,
    );
  }
  chess.setHeader(name, normalized);
}

function applyRatingHeader(chess: Chess, name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ManualPgnFinalizeError(
      "invalid_override",
      `${name} must be a non-negative integer.`,
    );
  }
  chess.setHeader(name, String(value));
}

function normalizedIdentity(value: string | undefined): string {
  return (
    value?.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase() ?? ""
  );
}

function contentHashOf(chess: Chess): string {
  const headers = chess.getHeaders();
  const fenHeader = headerValue(headers, "FEN");
  const startPosition = fenHeader
    ? new Chess(fenHeader).fen()
    : new Chess().fen();
  const identity = {
    white: normalizedIdentity(headerValue(headers, "White")),
    black: normalizedIdentity(headerValue(headers, "Black")),
    date: normalizedIdentity(
      headerValue(headers, "Date") ?? headerValue(headers, "UTCDate"),
    ),
    event: normalizedIdentity(headerValue(headers, "Event")),
    site: normalizedIdentity(headerValue(headers, "Site")),
    round: normalizedIdentity(headerValue(headers, "Round")),
  };
  const normalizedContent = JSON.stringify({
    startPosition,
    moves: chess.history({ verbose: true }).map((move) => move.lan),
    result: headerValue(headers, "Result") ?? "*",
    identity,
  });
  return createHash("sha256").update(normalizedContent).digest("hex");
}

/** Apply optional side-specific facts and derive the stable manual-game key. */
export function finalizeManualPgn(
  pgn: string,
  overrides: ManualPgnHeaderOverrides = {},
): FinalizedManualPgn {
  const parsed = parseGame(normalizeInput(pgn).trim(), 0);
  if (parsed.status !== "valid") {
    throw new ManualPgnFinalizeError(parsed.code, parsed.message);
  }

  const chess = new Chess();
  chess.loadPgn(parsed.canonicalPgn);

  if (overrides.event !== undefined) {
    applyTextHeader(chess, "Event", overrides.event);
  }
  if (overrides.playedDate !== undefined) {
    const date = pgnDate(overrides.playedDate);
    if (!date) {
      throw new ManualPgnFinalizeError(
        "invalid_override",
        "playedDate must be a real date in YYYY-MM-DD form.",
      );
    }
    chess.setHeader("Date", date);
  }
  if (overrides.timeControl !== undefined) {
    applyTextHeader(chess, "TimeControl", overrides.timeControl);
  }
  if (overrides.resultHeader !== undefined) {
    chess.setHeader("Result", overrides.resultHeader);
  }
  if (overrides.whiteRating !== undefined) {
    applyRatingHeader(chess, "WhiteElo", overrides.whiteRating);
  }
  if (overrides.blackRating !== undefined) {
    applyRatingHeader(chess, "BlackElo", overrides.blackRating);
  }

  let canonicalPgn: string;
  let canonicalChess: Chess;
  try {
    canonicalPgn = chess.pgn({ newline: "\n", maxWidth: 0 });
    canonicalChess = new Chess();
    canonicalChess.loadPgn(canonicalPgn);
  } catch {
    throw new ManualPgnFinalizeError(
      "invalid_override",
      "The supplied metadata could not be represented as valid PGN headers.",
    );
  }

  return {
    canonicalPgn,
    contentHash: contentHashOf(canonicalChess),
    plyCount: canonicalChess.history().length,
    metadata: metadataOf(canonicalChess),
  };
}
