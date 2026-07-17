import { describe, expect, it } from "vitest";

import {
  ACTIVITY_EVENT_TYPES,
  GAME_ANALYSED_ACTIVITY_EVENT_TYPE,
  logOutcomeInputSchema,
  NON_OUTCOME_ACTIVITY_EVENT_TYPES,
  outcomeCompletesActivity,
  PROGRAM_ITEM_COMPLETION_EVENT_TYPE,
  programItemStatusAfterOutcome,
  SKIP_UNDONE_ACTIVITY_EVENT_TYPE,
} from "@/lib/tracker";

const requestId = "00000000-0000-4000-8000-000000000001";

describe("tracker event rules", () => {
  it("declares every persisted event type in one taxonomy", () => {
    expect(ACTIVITY_EVENT_TYPES).toEqual([
      "puzzle_attempt",
      "drill_done",
      "game_played",
      "book_session",
      "skip",
      "self_report",
      SKIP_UNDONE_ACTIVITY_EVENT_TYPE,
      PROGRAM_ITEM_COMPLETION_EVENT_TYPE,
      GAME_ANALYSED_ACTIVITY_EVENT_TYPE,
    ]);
    expect(NON_OUTCOME_ACTIVITY_EVENT_TYPES).toEqual([
      "skip",
      SKIP_UNDONE_ACTIVITY_EVENT_TYPE,
      PROGRAM_ITEM_COMPLETION_EVENT_TYPE,
    ]);
  });

  it("keeps server-owned structural events out of the public outcome input", () => {
    for (const type of [
      SKIP_UNDONE_ACTIVITY_EVENT_TYPE,
      PROGRAM_ITEM_COMPLETION_EVENT_TYPE,
      GAME_ANALYSED_ACTIVITY_EVENT_TYPE,
    ]) {
      expect(logOutcomeInputSchema.safeParse({ requestId, type }).success).toBe(
        false,
      );
    }
  });

  it("derives ProgramItem transitions and completion recognition from one rule", () => {
    const partial = {
      programItemId: "item-1",
      completeProgramItem: false,
      type: "puzzle_attempt" as const,
    };
    expect(programItemStatusAfterOutcome(partial)).toBeNull();
    expect(outcomeCompletesActivity(partial)).toBe(false);

    const completed = { ...partial, completeProgramItem: true };
    expect(programItemStatusAfterOutcome(completed)).toBe("done");
    expect(outcomeCompletesActivity(completed)).toBe(true);

    const skipped = { programItemId: "item-1", type: "skip" as const };
    expect(programItemStatusAfterOutcome(skipped)).toBe("skipped");
    expect(outcomeCompletesActivity(skipped)).toBe(false);

    expect(outcomeCompletesActivity({ type: "book_session" })).toBe(true);
  });
});
