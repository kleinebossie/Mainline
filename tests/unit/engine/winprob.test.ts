import { describe, expect, it } from "vitest";
import { winProb, evalToWinProb, winProbDrop } from "@/engine/math/winprob";

describe("winProb", () => {
  it("is 0.5 at equality and monotonic in cp", () => {
    expect(winProb(0)).toBeCloseTo(0.5, 6);
    expect(winProb(100)).toBeGreaterThan(winProb(0));
    expect(winProb(-100)).toBeLessThan(winProb(0));
    expect(winProb(100)).toBeGreaterThan(winProb(50));
  });

  it("is symmetric: winProb(-x) = 1 - winProb(x)", () => {
    for (const cp of [50, 150, 600, 2000]) {
      expect(winProb(-cp)).toBeCloseTo(1 - winProb(cp), 9);
    }
  });

  it("saturates toward 1/0 in decided positions — both mate encodings collapse to ~1", () => {
    // The whole point: a clamped mate (±1000), a raw mate (±10000), and the client's
    // ±100000 all read as ~1/0, so a missed mate that stays winning is a ~0 drop.
    expect(winProb(1000)).toBeGreaterThan(0.97);
    expect(winProb(10_000)).toBeCloseTo(1, 6);
    expect(winProb(100_000)).toBeCloseTo(1, 6);
    expect(winProb(-100_000)).toBeCloseTo(0, 6);
  });

  it("evalToWinProb treats a forced mate as a certain win/loss", () => {
    expect(evalToWinProb({ cp: 0, mate: 3 })).toBe(1);
    expect(evalToWinProb({ cp: 0, mate: -2 })).toBe(0);
    expect(evalToWinProb({ cp: 120, mate: null })).toBeCloseTo(winProb(120), 9);
  });
});

describe("winProbDrop", () => {
  it("is ~0 for a missed mate that stays winning, large for a real swing", () => {
    // mate (≈ +1000 clamped) → still clearly winning (+600): tiny practical loss.
    expect(winProbDrop(1000, 600)).toBeLessThan(0.1);
    // winning (+250) → equal (0): a real, large win-probability swing.
    expect(winProbDrop(250, 0)).toBeGreaterThan(0.2);
    // never negative (a move that improved the eval).
    expect(winProbDrop(100, 300)).toBe(0);
  });
});
