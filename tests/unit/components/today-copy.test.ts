import { describe, expect, it } from "vitest";
import type { TodayItem, TodayProgram } from "@/server/program";
import {
  formatMinuteCap,
  itemSummary,
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
  it("formats visible time as rounded hard caps", () => {
    expect(formatMinuteCap(0.75)).toBe("up to 1 min");
    expect(formatMinuteCap(15)).toBe("up to 15 min");
    expect(formatMinuteCap(15.1)).toBe("up to 16 min");
  });

  it("sums the session cap without fractional minutes", () => {
    const program = {
      items: [
        item({ estMinutes: 14.25 }),
        item({ id: "item-2", estMinutes: 0.75 }),
      ],
    } as TodayProgram;
    expect(sessionMinuteCap(program)).toBe("up to 15 min");
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
