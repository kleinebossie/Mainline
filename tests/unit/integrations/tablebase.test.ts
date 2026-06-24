import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchTablebase,
  parseTablebaseResponse,
} from "@/integrations/lichess/tablebase";

// M13 — Lichess tablebase adapter. The PARSER is pure (golden); the fetcher guards the
// piece-count ceiling, returns null on 404, and backs off on 429 via the shared politeFetch
// (the "respect the platform" path, §6.6/§12).

afterEach(() => vi.unstubAllGlobals());

const SAMPLE = {
  category: "win",
  dtz: 3,
  dtm: 5,
  precise_dtz: 3,
  checkmate: false,
  stalemate: false,
  insufficient_material: false,
  moves: [
    { uci: "a7a8", san: "Ra8+", category: "loss", dtz: -2, dtm: -4 },
    { uci: "a7b7", san: "Rb7", category: "draw", dtz: 0, dtm: null },
  ],
};

const THREE_PIECE = "k7/Q7/K7/8/8/8/8/8 b - - 1 1";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("parseTablebaseResponse", () => {
  it("shapes the side-to-move verdict + the best move (moves[0])", () => {
    expect(parseTablebaseResponse(SAMPLE)).toEqual({
      category: "win",
      dtz: 3,
      dtm: 5,
      checkmate: false,
      stalemate: false,
      bestMove: "a7a8",
      bestMoveSan: "Ra8+",
    });
  });

  it("is defensive: missing fields collapse to safe defaults", () => {
    expect(parseTablebaseResponse({})).toEqual({
      category: "unknown",
      dtz: null,
      dtm: null,
      checkmate: false,
      stalemate: false,
      bestMove: null,
      bestMoveSan: null,
    });
  });
});

describe("fetchTablebase", () => {
  it("never probes a position beyond the tablebase ceiling (> 7 pieces)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchTablebase(START)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the position is not in the tablebase (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404 })),
    );
    expect(await fetchTablebase(THREE_PIECE)).toBeNull();
  });

  it("parses a 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(SAMPLE), { status: 200 }),
        ),
    );
    const res = await fetchTablebase(THREE_PIECE);
    expect(res?.category).toBe("win");
    expect(res?.bestMove).toBe("a7a8");
  });

  it("backs off and retries on 429, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(SAMPLE), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchTablebase(THREE_PIECE, {
      policy: { maxRetries: 2, baseMs: 0, capMs: 0 },
    });
    expect(res?.category).toBe("win");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up with a typed error after exhausting 429 retries", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("", { status: 429, headers: { "retry-after": "0" } }),
        ),
    );
    await expect(
      fetchTablebase(THREE_PIECE, {
        policy: { maxRetries: 1, baseMs: 0, capMs: 0 },
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});
