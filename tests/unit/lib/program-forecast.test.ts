import { describe, expect, it } from "vitest";

import {
  availabilityOverrideInputSchema,
  forecastBlockSchema,
  weeklyAvailabilityInputSchema,
} from "@/lib/program-forecast";

describe("program forecast contracts", () => {
  it("accepts an explicit flexible schedule without inventing weekdays", () => {
    expect(
      weeklyAvailabilityInputSchema.parse({
        mode: "flexible",
        preferredWeekdays: [],
        defaultMinutesByDay: {},
      }),
    ).toEqual({
      mode: "flexible",
      preferredWeekdays: [],
      defaultMinutesByDay: {},
    });
  });

  it("rejects ambiguous schedules and one-date overrides", () => {
    expect(() =>
      weeklyAvailabilityInputSchema.parse({
        mode: "preferred",
        preferredWeekdays: [1, 1],
        defaultMinutesByDay: { monday: 20 },
      }),
    ).toThrow();
    expect(() =>
      availabilityOverrideInputSchema.parse({
        date: 1,
        minutes: 20,
        unavailable: true,
      }),
    ).toThrow();
    expect(() =>
      availabilityOverrideInputSchema.parse({
        date: 1,
        minutes: null,
        unavailable: false,
      }),
    ).toThrow();
  });

  it("keeps future blocks activity-level only", () => {
    expect(() =>
      forecastBlockSchema.parse({
        activityId: "pattern",
        activityType: "puzzle_theme",
        expectedMinutes: 10,
        dimensionsTargeted: ["tactical_pattern"],
        rationaleKey: "puzzle_mix",
        rationaleText: "Practise the current focus.",
        evidenceGrade: "C",
        evidenceTier: 1,
        citationKey: "methodology",
        confidence: "medium",
        soften: true,
        puzzleIds: ["p1"],
      }),
    ).toThrow();
  });
});
