import { describe, expect, it } from "vitest";

import { buildSevenDayForecast } from "@/engine/forecast";

const now = Date.parse("2026-07-13T10:00:00Z");
const blocks = [
  {
    activityId: "puzzles",
    activityType: "puzzle_theme",
    expectedMinutes: 10,
    dimensionsTargeted: ["tactical_pattern"],
    rationaleKey: "puzzle_mix",
    rationaleText: "Practise the current focus.",
    evidenceGrade: "C" as const,
    evidenceTier: 1 as const,
    citationKey: "methodology",
    confidence: "medium",
    soften: true,
  },
  {
    activityId: "book",
    activityType: "book",
    expectedMinutes: 15,
    dimensionsTargeted: ["calculation"],
    rationaleKey: "book_study",
    rationaleText: "Use active recall.",
    evidenceGrade: "B" as const,
    evidenceTier: 2 as const,
    citationKey: "bjork2011",
    confidence: "medium",
    soften: false,
  },
];

describe("seven-day forecast", () => {
  it("is deterministic, time-budgeted, and keeps future blocks abstract", () => {
    const input = {
      now,
      fallbackMinutes: 20,
      availability: {
        mode: "flexible" as const,
        preferredWeekdays: [],
        defaultMinutesByDay: {},
      },
      overrides: [],
      candidateBlocks: blocks,
    };
    const first = buildSevenDayForecast(input);
    expect(buildSevenDayForecast(input)).toEqual(first);
    expect(first).toHaveLength(7);
    expect(first.every((day) => day.expectedMinutes <= 20)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(
      /puzzleId|dueItemRefs|practiceItemId/,
    );
  });

  it("does not invent weekdays in flexible mode and honors explicit availability", () => {
    const flexible = buildSevenDayForecast({
      now,
      fallbackMinutes: 20,
      availability: {
        mode: "flexible",
        preferredWeekdays: [],
        defaultMinutesByDay: {},
      },
      overrides: [],
      candidateBlocks: blocks,
    });
    expect(flexible.every((day) => day.expectedMinutes > 0)).toBe(true);

    const preferred = buildSevenDayForecast({
      now,
      fallbackMinutes: 20,
      availability: {
        mode: "preferred",
        preferredWeekdays: [1],
        defaultMinutesByDay: {},
      },
      overrides: [{ date: now, minutes: null, unavailable: true }],
      candidateBlocks: blocks,
    });
    expect(preferred[0]?.expectedMinutes).toBe(0);
    expect(preferred.slice(1).every((day) => day.expectedMinutes === 0)).toBe(
      true,
    );
  });

  it("recalculates each date independently without catch-up debt", () => {
    const result = buildSevenDayForecast({
      now,
      fallbackMinutes: 30,
      availability: {
        mode: "flexible",
        preferredWeekdays: [],
        defaultMinutesByDay: {},
      },
      overrides: [{ date: now, minutes: null, unavailable: true }],
      candidateBlocks: blocks,
    });
    expect(result[0]?.plannedBlocks).toEqual([]);
    expect(result[1]?.plannedBlocks).toEqual(blocks);
    expect(result[1]?.expectedMinutes).toBe(25);
  });
});
