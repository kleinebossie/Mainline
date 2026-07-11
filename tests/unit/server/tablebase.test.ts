import { afterEach, describe, expect, it, vi } from "vitest";

import { lookupTablebase } from "@/server/tablebase";

// M13 — tablebase lookup is cache-first ("respect the platform", §12): a FEN is fetched from
// Lichess at most once, ever, and reused thereafter. A probe failure degrades to null (the
// oracle is optional — the endgame surface falls back to engine-only judging).

afterEach(() => vi.unstubAllGlobals());

const THREE_PIECE = "k7/Q7/K7/8/8/8/8/8 b - - 1 1";
const RESULT = {
  category: "win",
  dtz: 3,
  dtm: 5,
  checkmate: false,
  stalemate: false,
  bestMove: "a7a8",
  bestMoveSan: "Ra8+",
};

/** Minimal in-memory TablebaseCache: just findUnique + upsert over a Map. */
function fakeDb() {
  const store = new Map<string, unknown>();
  let budgetCount = 0;
  return {
    store,
    apiCallBudget: {
      updateMany: async () => ({ count: budgetCount > 0 ? 1 : 0 }),
      create: async () => {
        budgetCount = 1;
      },
      findUniqueOrThrow: async () => ({ count: budgetCount }),
    },
    tablebaseCache: {
      findUnique: async ({ where }: { where: { fen: string } }) => {
        const result = store.get(where.fen);
        return result
          ? { fen: where.fen, result, fetchedAt: new Date() }
          : null;
      },
      upsert: async ({
        where,
        create,
      }: {
        where: { fen: string };
        create: { result: unknown };
      }) => {
        store.set(where.fen, create.result);
      },
    },
  };
}

describe("lookupTablebase", () => {
  it("fetches once on a miss, then serves the cache with NO refetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ...RESULT, moves: [{ uci: "a7a8", san: "Ra8+" }] }),
        {
          status: 200,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const db = fakeDb();

    const first = await lookupTablebase(db as never, "user-1", THREE_PIECE);
    expect(first?.category).toBe("win");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await lookupTablebase(db as never, "user-1", THREE_PIECE);
    expect(second?.category).toBe("win");
    // The key guarantee: the cache hit did NOT hit Lichess again.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("short-circuits a > 7-piece position without any cache/network work", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const db = fakeDb();
    const res = await lookupTablebase(
      db as never,
      "user-1",
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    expect(res).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("degrades to null (engine-only fallback) on a probe failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 500 })),
    );
    const db = fakeDb();
    expect(
      await lookupTablebase(db as never, "user-1", THREE_PIECE),
    ).toBeNull();
  });
});
