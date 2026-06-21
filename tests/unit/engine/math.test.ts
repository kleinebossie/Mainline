import { describe, expect, it } from "vitest";

import { servoOffset } from "@/engine/math/servo";
import { packToBudget } from "@/engine/math/packing";
import { stableSortByScoreDesc } from "@/engine/math/weighted-sort";

// Generic Engine math (BUILD.md §2.8). Pure + deterministic (L2), science-free (L1) —
// every number is supplied by the caller, so these tests pin behaviour, not policy.

describe("servoOffset", () => {
  it("returns the seed when measured == target (or no measurement)", () => {
    expect(servoOffset(-150, 0.8, 0.8, 400)).toBe(-150);
  });

  it("raises the offset (harder) when success is above target", () => {
    // -150 + (0.9 - 0.8) * 400 = -110
    expect(servoOffset(-150, 0.9, 0.8, 400)).toBeCloseTo(-110);
  });

  it("lowers the offset (easier) when success is below target", () => {
    // -150 + (0.6 - 0.8) * 400 = -230
    expect(servoOffset(-150, 0.6, 0.8, 400)).toBeCloseTo(-230);
  });
});

describe("packToBudget", () => {
  const item = (id: string, estMinutes: number) => ({ id, estMinutes });

  it("keeps items in order while they fit, skipping ones too big for the remainder", () => {
    const ordered = [
      item("a", 15),
      item("b", 30),
      item("c", 10),
      item("d", 15),
    ];
    // 15 (a) ✓ → 30 (b) 45>30 ✗ → 10 (c) 25 ✓ → 15 (d) 40>30 ✗
    expect(packToBudget(ordered, 30).map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("always keeps at least the highest-priority item when nothing fits the budget", () => {
    const ordered = [item("big", 30), item("med", 20)];
    expect(packToBudget(ordered, 10).map((i) => i.id)).toEqual(["big"]);
  });

  it("returns nothing for an empty candidate list", () => {
    expect(packToBudget([], 60)).toEqual([]);
  });
});

describe("stableSortByScoreDesc", () => {
  it("sorts by score desc, breaking ties by the id tiebreak (asc)", () => {
    const items = [
      { id: "play", score: 3 },
      { id: "analyse", score: 3 },
      { id: "endgame", score: 2 },
      { id: "calc", score: 2 },
    ];
    expect(
      stableSortByScoreDesc(
        items,
        (i) => i.score,
        (i) => i.id,
      ).map((i) => i.id),
    ).toEqual(["analyse", "play", "calc", "endgame"]);
  });
});
