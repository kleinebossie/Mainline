import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { replaceWeeklyFocus, WEEKLY_FOCUS_CHANGED } from "@/db/weekly-focus";

const input = {
  userId: "u1",
  weekStart: new Date(0),
  focusAreas: ["tactics"],
  supportingSignals: [],
  confidence: "low",
  methodologyVersion: "research-1.1.0",
  inputSnapshot: {},
  rationaleSnapshots: [],
  alternatives: [],
  selectedAlternative: null,
  revisionTrigger: "window",
};

function fakeDb(updateCount: number, createError?: unknown) {
  const updateMany = vi.fn(async () => ({ count: updateCount }));
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (createError) throw createError;
    return { id: "new-focus", ...data };
  });
  const tx = { weeklyFocus: { updateMany, create } };
  return {
    db: {
      $transaction: async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
    } as unknown as PrismaClient,
    updateMany,
    create,
  };
}

describe("weekly focus persistence", () => {
  it("supersedes only the expected active identity", async () => {
    const { db, updateMany, create } = fakeDb(1);
    await replaceWeeklyFocus(db, { ...input, expectedActiveId: "focus-1" });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "focus-1", userId: "u1", status: "active" },
      data: { status: "superseded" },
    });
    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty(
      "expectedActiveId",
    );
  });

  it("rejects a stale replacement before creating a successor", async () => {
    const { db, create } = fakeDb(0);
    await expect(
      replaceWeeklyFocus(db, { ...input, expectedActiveId: "stale" }),
    ).rejects.toThrow(WEEKLY_FOCUS_CHANGED);
    expect(create).not.toHaveBeenCalled();
  });

  it("normalizes a concurrent initial insert conflict", async () => {
    const conflict = Object.assign(new Error("unique conflict"), {
      code: "P2002",
    });
    const { db } = fakeDb(0, conflict);
    await expect(
      replaceWeeklyFocus(db, { ...input, expectedActiveId: null }),
    ).rejects.toThrow(WEEKLY_FOCUS_CHANGED);
  });
});
