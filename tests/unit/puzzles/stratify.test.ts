import { describe, expect, it } from "vitest";

import type { LichessPuzzleInput } from "@/integrations/puzzles/parse";
import {
  ratingBucket,
  StratifiedSampler,
  type StratifyOptions,
} from "@/integrations/puzzles/stratify";

function p(
  puzzleId: string,
  rating: number,
  themes: string[],
  extra?: Partial<LichessPuzzleInput>,
): LichessPuzzleInput {
  return {
    puzzleId,
    fen: "f",
    moves: "m",
    rating,
    ratingDeviation: 50,
    popularity: 90,
    nbPlays: 100,
    themes,
    gameUrl: null,
    openingTags: [],
    ...extra,
  };
}

describe("ratingBucket", () => {
  it("floors to the bucket edge", () => {
    expect(ratingBucket(1234, 100)).toBe(1200);
    expect(ratingBucket(1299, 100)).toBe(1200);
    expect(ratingBucket(800, 100)).toBe(800);
  });
});

describe("StratifiedSampler", () => {
  it("caps per (bucket, theme) but keeps coverage across themes and buckets", () => {
    const s = new StratifiedSampler({
      bucketSize: 100,
      capPerBucketTheme: 1,
      maxRows: 100,
    });
    expect(s.consider(p("a", 1210, ["fork"]))).toBe(true); // 1200:fork kept
    expect(s.consider(p("b", 1250, ["fork"]))).toBe(false); // 1200:fork full
    expect(s.consider(p("c", 1250, ["pin"]))).toBe(true); // 1200:pin kept
    expect(s.consider(p("d", 1350, ["fork"]))).toBe(true); // 1300:fork kept
    expect(s.kept).toBe(3);
  });

  it("enforces the maxRows ceiling", () => {
    const s = new StratifiedSampler({
      bucketSize: 100,
      capPerBucketTheme: 999,
      maxRows: 2,
    });
    expect(s.consider(p("a", 1000, ["fork"]))).toBe(true);
    expect(s.consider(p("b", 2000, ["pin"]))).toBe(true);
    expect(s.consider(p("c", 1500, ["mate"]))).toBe(false);
    expect(s.kept).toBe(2);
  });

  it("applies quality floors", () => {
    const s = new StratifiedSampler({
      bucketSize: 100,
      capPerBucketTheme: 10,
      maxRows: 10,
      minPopularity: 80,
      minNbPlays: 50,
    });
    expect(s.consider(p("lowpop", 1000, ["fork"], { popularity: 10 }))).toBe(
      false,
    );
    expect(s.consider(p("lowplays", 1000, ["fork"], { nbPlays: 5 }))).toBe(
      false,
    );
    expect(s.consider(p("ok", 1000, ["fork"]))).toBe(true);
  });

  it("is deterministic and idempotent: same input + options → same kept set", () => {
    const opts: StratifyOptions = {
      bucketSize: 100,
      capPerBucketTheme: 1,
      maxRows: 100,
    };
    const input = [
      p("a", 1210, ["fork"]),
      p("b", 1250, ["fork"]),
      p("c", 1250, ["pin"]),
    ];
    const run = (o: StratifyOptions) => {
      const s = new StratifiedSampler(o);
      return input.filter((x) => s.consider(x)).map((x) => x.puzzleId);
    };
    expect(run(opts)).toEqual(["a", "c"]);
    expect(run(opts)).toEqual(run({ ...opts }));
  });
});
