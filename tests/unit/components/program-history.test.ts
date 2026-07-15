import { describe, expect, it } from "vitest";

import { groupProgramHistoryByDay } from "@/app/today/program-history";
import type { ProgramHistoryEntry } from "@/lib/program-history";

function entry(id: string, scheduledDate: Date | null): ProgramHistoryEntry {
  return { id, scheduledDate } as ProgramHistoryEntry;
}

describe("program history grouping", () => {
  it("shows one session day while retaining every same-day plan version", () => {
    const july5 = new Date("2026-07-05T00:00:00.000Z");
    const july4 = new Date("2026-07-04T00:00:00.000Z");

    const days = groupProgramHistoryByDay([
      entry("july-5-v3", july5),
      entry("july-5-v2", july5),
      entry("july-5-v1", july5),
      entry("july-4-v1", july4),
    ]);

    expect(days).toHaveLength(2);
    expect(days[0]?.entries.map((version) => version.id)).toEqual([
      "july-5-v3",
      "july-5-v2",
      "july-5-v1",
    ]);
    expect(days[1]?.entries.map((version) => version.id)).toEqual([
      "july-4-v1",
    ]);
  });

  it("keeps unscheduled historic artifacts separate", () => {
    const days = groupProgramHistoryByDay([
      entry("unknown-2", null),
      entry("unknown-1", null),
    ]);

    expect(days.map((day) => day.key)).toEqual([
      "unscheduled:unknown-2",
      "unscheduled:unknown-1",
    ]);
  });
});
