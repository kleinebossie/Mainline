import { describe, expect, it } from "vitest";

import { createBlunderDrillsFromGame } from "@/server/practice";
import { fixedClock } from "@/lib/clock";

// M12 server orchestration: createBlunderDrillsFromGame over an in-memory fake Prisma. The
// pure derivation + threshold are golden-tested elsewhere; this pins the plumbing — ownership
// gate, PracticeItem upsert, the immediate FSRS seed, and idempotent re-derivation.

type Db = Parameters<typeof createBlunderDrillsFromGame>[0];

const T = 1_000_000_000_000;

function fakeDb(opts: { owns: boolean; existingRefs?: string[] }) {
  const existing = new Set(opts.existingRefs ?? []);
  const rec = {
    practiceUpserts: [] as { sourceRef: string; solutionLine: string[] }[],
    scheduleUpserts: [] as { itemRef: string; itemType: string; due: Date }[],
  };
  const db = {
    importedGame: {
      findFirst: async () => (opts.owns ? { id: "g1" } : null),
    },
    practiceItem: {
      upsert: async ({
        create,
      }: {
        create: { sourceRef: string; solutionLine: string[] };
      }) => {
        rec.practiceUpserts.push({
          sourceRef: create.sourceRef,
          solutionLine: create.solutionLine,
        });
        return { id: `pi_${create.sourceRef}`, ...create };
      },
    },
    scheduleState: {
      findMany: async ({ where }: { where: { OR?: { itemRef: string }[] } }) =>
        (where.OR ?? [])
          .filter((k) => existing.has(k.itemRef))
          .map((k) => ({ ...k, fsrsState: {}, lastGrade: 1, source: "drill" })),
      upsert: async ({
        create,
      }: {
        create: { itemRef: string; itemType: string; due: Date };
      }) => {
        rec.scheduleUpserts.push({
          itemRef: create.itemRef,
          itemType: create.itemType,
          due: create.due,
        });
        return {};
      },
    },
    analysisResult: {},
  };
  return { db: db as unknown as Db, rec };
}

const drills = [
  { ply: 3, fen: "FEN3", bestUci: "e2e4", cpLoss: 300 }, // kept
  { ply: 5, fen: "FEN5", bestUci: "d2d4", cpLoss: 100 }, // below the 150cp floor → dropped
  { ply: 7, fen: "FEN7", bestUci: "", cpLoss: 400 }, // no best move → dropped
];

describe("createBlunderDrillsFromGame", () => {
  it("persists drillable blunders and seeds them due now (Again)", async () => {
    const { db, rec } = fakeDb({ owns: true });
    const res = await createBlunderDrillsFromGame(
      db,
      "u1",
      { gameId: "g1", drills },
      fixedClock(T),
    );
    expect(res.created).toBe(1);
    expect(rec.practiceUpserts).toEqual([
      { sourceRef: "blunder:g1:3", solutionLine: ["e2e4"] },
    ]);
    expect(rec.scheduleUpserts).toEqual([
      {
        itemRef: "pi_blunder:g1:3",
        itemType: "blunder_drill",
        due: new Date(T),
      },
    ]);
  });

  it("is idempotent — never resets a drill already in the FSRS queue", async () => {
    const { db, rec } = fakeDb({
      owns: true,
      existingRefs: ["pi_blunder:g1:3"],
    });
    const res = await createBlunderDrillsFromGame(
      db,
      "u1",
      { gameId: "g1", drills },
      fixedClock(T),
    );
    expect(res.created).toBe(0);
    expect(rec.practiceUpserts).toHaveLength(1); // still upserts the position (no-op create)
    expect(rec.scheduleUpserts).toHaveLength(0); // but does NOT re-seed the schedule
  });

  it("refuses a game the user does not own", async () => {
    const { db } = fakeDb({ owns: false });
    await expect(
      createBlunderDrillsFromGame(db, "u1", { gameId: "g1", drills }),
    ).rejects.toThrow(/Unauthorized/);
  });
});
