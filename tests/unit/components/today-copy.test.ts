import { describe, expect, it } from "vitest";
import type { TodayItem, TodayProgram } from "@/server/program";
import {
  formatForecastDate,
  formatMeasurementCoverage,
  formatMeasuredMinutes,
  formatProgramVersionTime,
  focusSourceLabel,
  formatMinuteCap,
  humanizeFocusArea,
  itemSummary,
  isSameUtcDay,
  primaryActionKind,
  rowStatusLabel,
  sessionMinuteCap,
} from "@/app/today/today-copy";

function item(overrides: Partial<TodayItem>): TodayItem {
  return {
    id: "item-1",
    orderIndex: 0,
    label: "Failed tactics",
    activityType: "spaced_review",
    dimensionLabels: ["Tactics"],
    estMinutes: 0.75,
    params: { theme: null, track: null },
    reviewThemes: [],
    externalUrl: null,
    externalLabel: null,
    url: "/train/item-1",
    delivery: "internal",
    bookResource: null,
    rationaleText: "Review misses because spacing helps retention.",
    evidenceGrade: "A",
    evidenceTier: 2,
    citationKey: "cepeda2006",
    citationSource: "Cepeda et al. 2006",
    confidence: "medium",
    soften: false,
    status: "pending",
    ...overrides,
  };
}

describe("Today copy helpers", () => {
  it("formats methodology ids and UTC forecast dates for people", () => {
    expect(humanizeFocusArea("board_vision")).toBe("Board vision");
    expect(humanizeFocusArea("tactics")).toBe("Tactics");
    expect(formatForecastDate(Date.parse("2026-07-13T00:00:00Z"))).toMatch(
      /Mon.*Jul.*13|Mon.*13.*Jul/,
    );
  });

  it("compares session dates at UTC day granularity", () => {
    expect(
      isSameUtcDay(
        new Date("2026-07-15T00:00:00.000Z"),
        new Date("2026-07-15T23:59:59.999Z"),
      ),
    ).toBe(true);
    expect(
      isSameUtcDay(
        new Date("2026-07-14T23:59:59.999Z"),
        new Date("2026-07-15T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("turns recommendation signals into concise user-facing reasons", () => {
    expect(focusSourceLabel("measured weakness")).toBe("recent measured needs");
    expect(focusSourceLabel("process goal:rating")).toBe("your stated goal");
  });

  it("formats visible time as rounded hard caps", () => {
    expect(formatMinuteCap(0.75)).toBe("Up to 1 min");
    expect(formatMinuteCap(15)).toBe("Up to 15 min");
    expect(formatMinuteCap(15.1)).toBe("Up to 16 min");
  });

  it("keeps planned and measured time labels distinct", () => {
    expect(formatMeasuredMinutes(null)).toBe("Not measured");
    expect(formatMeasuredMinutes(0)).toBe("0 min");
    expect(formatMeasuredMinutes(0.5)).toBe("Less than 1 min");
    expect(formatMeasuredMinutes(14.4)).toBe("14 min");
    expect(formatMeasuredMinutes(14.4, true)).toBe("At least 14 min");
    expect(formatMeasuredMinutes(null, true)).toBe("No measured time in view");
    expect(formatMeasuredMinutes(0.5, true)).toBe(
      "At least some measured time",
    );
    expect(formatMeasurementCoverage(2, 3, false)).toBe("2 of 3 logs timed");
    expect(formatMeasurementCoverage(100, 140, true)).toBe(
      "At least 100 of 140 logs timed",
    );
    expect(
      formatProgramVersionTime(new Date("2026-07-13T09:30:00.000Z")),
    ).toMatch(/9:30.*UTC|09:30.*UTC/);
  });

  it("sums the session cap without fractional minutes", () => {
    const program = {
      items: [
        item({ estMinutes: 14.25 }),
        item({ id: "item-2", estMinutes: 0.75 }),
      ],
    } as TodayProgram;
    expect(sessionMinuteCap(program)).toBe("Up to 15 min");
  });

  it("uses server-shaped review themes in Today summaries", () => {
    const summary = itemSummary(
      item({
        reviewThemes: ["Fork", "Mate in 2"],
      }),
    );
    expect(summary).toBe("Review due failed tactics: Fork, Mate in 2.");
  });

  it("uses neutral review copy without raw ids or quantity pressure", () => {
    const summary = itemSummary(
      item({
        params: { theme: null, track: null },
        reviewThemes: [],
      }),
    );
    expect(summary).toBe("Review due failed tactics.");
    expect(summary).not.toContain("099Vg");
    expect(summary).not.toContain("0cbN7");
    expect(summary).not.toMatch(/puzzles?|positions?|games?/i);
  });

  it("uses final status labels for closed rows", () => {
    expect(rowStatusLabel(item({ status: "done" }))).toBe("Done");
    expect(rowStatusLabel(item({ status: "skipped" }))).toBe("Skipped");
  });

  it("suppresses original actions once a block is done or skipped", () => {
    expect(
      primaryActionKind(
        item({ status: "done", delivery: "internal", url: "/train/item-1" }),
      ),
    ).toBeNull();
    expect(
      primaryActionKind(
        item({
          status: "skipped",
          delivery: "external",
          externalUrl: "https://lichess.org/training",
        }),
      ),
    ).toBeNull();
    expect(
      primaryActionKind(
        item({ status: "pending", delivery: "internal", url: "/train/item-1" }),
      ),
    ).toBe("internal");
  });
});
