import { describe, expect, it, vi } from "vitest";

import { findPracticeItemsByIds, upsertPracticeItem } from "@/db/practice";

describe("db/practice query helpers", () => {
  it("upserts a practice item using compound unique key (userId, sourceRef)", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "pi-1" });
    const db = { practiceItem: { upsert } };

    const item = await upsertPracticeItem(db as never, {
      userId: "u1",
      kind: "blunder",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      solutionLine: ["e2e4", "e7e5"],
      sourceRef: "blunder:game1:10",
      methodologyKey: "tactics_pin",
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_sourceRef: { userId: "u1", sourceRef: "blunder:game1:10" },
      },
      create: {
        userId: "u1",
        kind: "blunder",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        solutionLine: ["e2e4", "e7e5"],
        sourceRef: "blunder:game1:10",
        methodologyKey: "tactics_pin",
      },
      update: {},
    });
    expect(item).toEqual({ id: "pi-1" });
  });

  it("finds practice items by IDs scoped to user", async () => {
    const rows = [
      {
        id: "pi-1",
        kind: "blunder",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        solutionLine: ["e2e4"],
        methodologyKey: null,
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const db = { practiceItem: { findMany } };

    const items = await findPracticeItemsByIds(db as never, "u1", ["pi-1", "pi-2"]);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "u1", id: { in: ["pi-1", "pi-2"] } },
      select: {
        id: true,
        kind: true,
        fen: true,
        solutionLine: true,
        methodologyKey: true,
      },
    });
    expect(items).toEqual(rows);
  });

  it("returns an empty array when given an empty list of IDs without querying the database", async () => {
    const findMany = vi.fn();
    const db = { practiceItem: { findMany } };

    const items = await findPracticeItemsByIds(db as never, "u1", []);

    expect(items).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
