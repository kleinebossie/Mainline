// Lichess tablebase adapter (BUILD.md §6.6, M13). Endgame ground truth for ≤7-piece
// positions: the public, read-only, no-auth tablebase API returns WDL/DTZ + the moves
// ranked best-first for the side to move. "Respect the platform" (VISION §6, §12): the
// shared `politeFetch` sends a descriptive User-Agent and backs off on HTTP 429, the caller
// caches every lookup (TablebaseCache) so a FEN is fetched at most once, and we never probe
// a position the tablebase can't answer (> 7 pieces → null, no request). The PARSER is a
// pure function (golden-testable) so response shaping is verified without the network.

import { politeFetch, type BackoffPolicy } from "@/integrations/http";
import {
  fenPieceCount,
  tablebaseResultSchema,
  TABLEBASE_MAX_PIECES,
  type TablebaseResult,
} from "@/lib/tablebase";

const TABLEBASE_URL = "https://tablebase.lichess.ovh/standard";

/** The raw Lichess tablebase response shape (only the fields we use). */
interface RawTablebaseMove {
  uci?: string;
  san?: string;
  category?: string;
  dtz?: number | null;
  dtm?: number | null;
}
interface RawTablebaseResponse {
  category?: string;
  dtz?: number | null;
  dtm?: number | null;
  checkmate?: boolean;
  stalemate?: boolean;
  moves?: RawTablebaseMove[];
}

/**
 * Shape a raw Lichess tablebase response into a {@link TablebaseResult}. Pure (no network):
 * the side-to-move category/distance plus the best move (Lichess sorts `moves` best-first,
 * so `moves[0]` is the move to play). Defensive — missing fields collapse to safe defaults.
 */
export function parseTablebaseResponse(raw: unknown): TablebaseResult {
  const r = (raw ?? {}) as RawTablebaseResponse;
  const best = Array.isArray(r.moves) ? r.moves[0] : undefined;
  return tablebaseResultSchema.parse({
    category: typeof r.category === "string" ? r.category : "unknown",
    dtz: typeof r.dtz === "number" ? r.dtz : null,
    dtm: typeof r.dtm === "number" ? r.dtm : null,
    checkmate: r.checkmate === true,
    stalemate: r.stalemate === true,
    bestMove: best && typeof best.uci === "string" ? best.uci : null,
    bestMoveSan: best && typeof best.san === "string" ? best.san : null,
  });
}

/**
 * Probe the Lichess tablebase for one FEN. Returns null (no request made) when the position
 * has more pieces than the tablebase covers, or when the API has no entry (404). Throws a
 * typed PlatformError on rate-limit exhaustion / network failure (the caller decides whether
 * to fall back to engine-only judging). `policy` is injectable so tests pin the back-off.
 */
export async function fetchTablebase(
  fen: string,
  opts: { policy?: BackoffPolicy; beforeRequest?: () => Promise<void> } = {},
): Promise<TablebaseResult | null> {
  if (fenPieceCount(fen) > TABLEBASE_MAX_PIECES) return null;

  const url = `${TABLEBASE_URL}?fen=${encodeURIComponent(fen)}`;
  const res = await politeFetch(
    "lichess",
    url,
    {},
    opts.policy,
    opts.beforeRequest,
  );
  if (res.status === 404) return null; // position not in the tablebase
  if (!res.ok) {
    throw new Error(`Lichess tablebase lookup failed (${res.status})`);
  }
  return parseTablebaseResponse(await res.json());
}
