import { describe, expect, it } from "vitest";

import {
  applySuccessBiasTiebreak,
  calculateTargetCount,
  calculateUsedReviewMinutes,
  isAnalysisBlockComplete,
  selectAnalysisQueue,
  type QueueGame,
} from "@/engine/interactive/analysis-queue";

describe("analysis-queue math helpers", () => {
  describe("calculateTargetCount", () => {
    it("calculates target count with rounding and minimum of 1", () => {
      expect(calculateTargetCount(15, 15)).toBe(1);
      expect(calculateTargetCount(30, 15)).toBe(2);
      expect(calculateTargetCount(20, 15)).toBe(1);
      expect(calculateTargetCount(25, 15)).toBe(2);
      expect(calculateTargetCount(5, 15)).toBe(1);
      expect(calculateTargetCount(0, 15)).toBe(1);
      expect(calculateTargetCount(15, 0)).toBe(1);
    });
  });

  describe("calculateUsedReviewMinutes", () => {
    it("calculates used minutes from durations in seconds", () => {
      const events = [
        { durationSeconds: 600 }, // 10 min
        { durationSeconds: 300 }, // 5 min
      ];
      expect(calculateUsedReviewMinutes(events, 15)).toBe(15);
    });

    it("falls back to average review duration when durationSeconds is missing", () => {
      const events = [
        { durationSeconds: 600 }, // 10 min
        {}, // missing -> 15 min
        { durationSeconds: null }, // null -> 15 min
      ];
      expect(calculateUsedReviewMinutes(events, 15)).toBe(40);
    });
  });

  describe("isAnalysisBlockComplete", () => {
    it("completes when completed reviews reach target count", () => {
      expect(isAnalysisBlockComplete(1, 10, 1, 15)).toBe(true);
      expect(isAnalysisBlockComplete(2, 20, 2, 30)).toBe(true);
    });

    it("completes when used minutes reach budget with at least one review", () => {
      expect(isAnalysisBlockComplete(1, 30, 2, 30)).toBe(true);
      expect(isAnalysisBlockComplete(1, 35, 2, 30)).toBe(true);
    });

    it("does not complete when neither target count nor budget is reached", () => {
      expect(isAnalysisBlockComplete(0, 0, 1, 15)).toBe(false);
      expect(isAnalysisBlockComplete(1, 15, 2, 30)).toBe(false);
    });

    it("does not complete when zero reviews have been finished even if used minutes meet budget", () => {
      expect(isAnalysisBlockComplete(0, 30, 2, 30)).toBe(false);
    });
  });
});

describe("selectAnalysisQueue", () => {
  const HOUR_MS = 3_600_000;
  const DAY_MS = 24 * HOUR_MS;
  const nowMs = 1_700_000_000_000;
  const thresholds = { freshWindowMs: DAY_MS };

  it("returns empty array for empty input", () => {
    expect(selectAnalysisQueue([], nowMs, thresholds)).toEqual([]);
  });

  it("partitions fresh and older games and sorts each group descending by playedAt", () => {
    const games: QueueGame[] = [
      { id: "old-1", playedAtMs: nowMs - 2 * DAY_MS, result: "win" },
      { id: "fresh-1", playedAtMs: nowMs - 2 * HOUR_MS, result: "loss" },
      { id: "old-2", playedAtMs: nowMs - 5 * DAY_MS, result: "win" },
      { id: "fresh-2", playedAtMs: nowMs - 1 * HOUR_MS, result: "win" },
    ];

    const sorted = selectAnalysisQueue(games, nowMs, thresholds);
    expect(sorted.map((g) => g.id)).toEqual([
      "fresh-2", // 1h ago
      "fresh-1", // 2h ago
      "old-1", // 2d ago
      "old-2", // 5d ago
    ]);
  });

  it("places games with null playedAtMs at the end of older games", () => {
    const games: QueueGame[] = [
      { id: "null-1", playedAtMs: null, result: "win" },
      { id: "fresh-1", playedAtMs: nowMs - 1 * HOUR_MS, result: "loss" },
      { id: "old-1", playedAtMs: nowMs - 3 * DAY_MS, result: "win" },
      { id: "null-2", playedAtMs: null, result: "loss" },
    ];

    const sorted = selectAnalysisQueue(games, nowMs, thresholds);
    expect(sorted.map((g) => g.id)).toEqual([
      "fresh-1",
      "old-1",
      "null-1",
      "null-2",
    ]);
  });
});

describe("applySuccessBiasTiebreak", () => {
  const DAY_MS = 86_400_000;
  const HOUR = 3_600_000;
  const base = 1_700_000_000_000;
  // Two games per UTC day, most recent first within the day.
  const dayGames = (day: number): QueueGame[] => [
    {
      id: `d${day}-a`,
      playedAtMs: base - day * DAY_MS,
      result: "win",
    },
    {
      id: `d${day}-b`,
      playedAtMs: base - day * DAY_MS - HOUR,
      result: "loss",
    },
  ];

  it("puts wins first within a same-day group when wins are favored", () => {
    const games = [...dayGames(0), ...dayGames(1)];
    const ordered = applySuccessBiasTiebreak(games, 0.7);
    expect(ordered.map((g) => g.id)).toEqual([
      "d0-a",
      "d0-b",
      "d1-a",
      "d1-b",
    ]);
  });

  it("puts non-wins first when losses are favored", () => {
    const games = [...dayGames(0), ...dayGames(1)];
    const ordered = applySuccessBiasTiebreak(games, 0.3);
    expect(ordered.map((g) => g.id)).toEqual([
      "d0-b",
      "d0-a",
      "d1-b",
      "d1-a",
    ]);
  });

  it("never moves a game across day groups", () => {
    const games = [...dayGames(0), ...dayGames(1)];
    const ordered = applySuccessBiasTiebreak(games, 0.3);
    const days = ordered.map((g) =>
      Math.floor((base - (g.playedAtMs ?? 0)) / DAY_MS),
    );
    expect(days).toEqual([0, 0, 1, 1]);
  });

  it("keeps order stable for equal results", () => {
    const games: QueueGame[] = [
      { id: "w1", playedAtMs: base, result: "win" },
      { id: "w2", playedAtMs: base - HOUR, result: "win" },
    ];
    expect(applySuccessBiasTiebreak(games, 0.3).map((g) => g.id)).toEqual([
      "w1",
      "w2",
    ]);
  });
});
