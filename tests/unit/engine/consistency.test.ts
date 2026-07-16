import { describe, expect, it } from "vitest";

import {
  consistencyGrid,
  consistencyStreak,
  dayIndexOf,
} from "@/engine/math/consistency";
import { DAY_MS } from "@/lib/clock";

describe("dayIndexOf", () => {
  it("changes buckets exactly at the day boundary", () => {
    expect(dayIndexOf(DAY_MS - 1)).toBe(0);
    expect(dayIndexOf(DAY_MS)).toBe(1);
  });

  it("uses floor semantics for negative epochs", () => {
    expect(dayIndexOf(-1)).toBe(-1);
    expect(dayIndexOf(-DAY_MS)).toBe(-1);
    expect(dayIndexOf(-DAY_MS - 1)).toBe(-2);
  });

  it("does not truncate large epochs to 32 bits", () => {
    expect(dayIndexOf(Number.MAX_SAFE_INTEGER)).toBe(
      Math.floor(Number.MAX_SAFE_INTEGER / DAY_MS),
    );
  });
});

describe("consistencyStreak", () => {
  it("ignores active days after today", () => {
    expect(consistencyStreak(new Set([101, 102]), 100)).toBe(0);
    expect(consistencyStreak(new Set([3, 4, 5, 6, 7]), 5)).toBe(3);
  });
});

describe("consistencyGrid", () => {
  it("returns no cells for an empty window", () => {
    expect(consistencyGrid(new Set([10]), 10, 0)).toEqual([]);
  });

  it("returns only the requested window, oldest to newest", () => {
    const grid = consistencyGrid(new Set([5, 10, 11, 12]), 10, 3);
    expect(grid.map((c) => c.dayIndex)).toEqual([8, 9, 10]);
    expect(grid.filter((c) => c.active).map((c) => c.dayIndex)).toEqual([10]);
  });
});
