import { describe, expect, it } from "vitest";

import {
  programHistoryCursorSchema,
  programHistoryInputSchema,
  programHistoryPageSchema,
} from "@/lib/program-history";

describe("program-history transport schemas", () => {
  describe("programHistoryCursorSchema", () => {
    it("accepts valid cursor object", () => {
      const cursor = {
        createdAt: new Date("2026-07-15T12:00:00.000Z"),
        id: "prog-1",
      };
      expect(programHistoryCursorSchema.safeParse(cursor).success).toBe(true);
    });

    it("rejects missing fields", () => {
      expect(
        programHistoryCursorSchema.safeParse({ id: "prog-1" }).success,
      ).toBe(false);
    });
  });

  describe("programHistoryInputSchema", () => {
    it("defaults limit to 10 and accepts valid input", () => {
      const parsed = programHistoryInputSchema.parse({});
      expect(parsed.limit).toBe(10);
    });

    it("rejects limit below 1 or above 25", () => {
      expect(programHistoryInputSchema.safeParse({ limit: 0 }).success).toBe(
        false,
      );
      expect(programHistoryInputSchema.safeParse({ limit: 26 }).success).toBe(
        false,
      );
      expect(programHistoryInputSchema.safeParse({ limit: 20 }).success).toBe(
        true,
      );
    });
  });

  describe("programHistoryPageSchema", () => {
    it("validates a complete program history page", () => {
      const page = {
        entries: [
          {
            id: "prog-1",
            status: "completed",
            scheduledDate: new Date("2026-07-15T00:00:00.000Z"),
            createdAt: new Date("2026-07-15T12:00:00.000Z"),
            methodologyVersion: "research-1.4.0",
            plannedMinutes: 30,
            actualMinutes: 28,
            eventCount: 3,
            measuredEventCount: 3,
            measurementTruncated: false,
            lastActivityAt: new Date("2026-07-15T12:30:00.000Z"),
            items: [
              {
                id: "item-1",
                orderIndex: 0,
                activityId: "puzzles_fork",
                activityType: "tactics",
                label: "Themed Tactics",
                dimensionLabels: ["Tactics"],
                plannedMinutes: 15,
                actualMinutes: 14,
                status: "completed",
                eventCount: 1,
                measuredEventCount: 1,
                measurementTruncated: false,
                lastActivityAt: new Date("2026-07-15T12:15:00.000Z"),
                rationale: {
                  text: "Deliberate tactical practice",
                  evidenceGrade: "A",
                  evidenceTier: 1,
                  citationKey: "deliberate_practice",
                  citationSource: "Ericsson 1993",
                  confidence: "high",
                  soften: false,
                },
              },
            ],
          },
        ],
        nextCursor: null,
      };

      expect(programHistoryPageSchema.safeParse(page).success).toBe(true);
    });
  });
});
