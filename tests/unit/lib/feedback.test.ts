import { describe, expect, it } from "vitest";

import {
  resolveFeedbackTarget,
  safeRouteContext,
  trainingFeedbackInputSchema,
} from "@/lib/feedback";

describe("feedback input boundaries", () => {
  it("normalizes route context without retaining ids, queries, or fragments", () => {
    expect(safeRouteContext("/analysis/game-secret?token=secret#move-12")).toBe(
      "/analysis/[gameId]",
    );
    expect(safeRouteContext("/settings?programItemId=private")).toBe(
      "/settings",
    );
    expect(safeRouteContext("https://example.com/private")).toBeNull();
  });

  it("requires an owned target shape for item or program feedback", () => {
    const base = {
      requestId: "request-1",
      source: "always_available" as const,
      relevance: "neutral" as const,
      enjoyment: "neutral" as const,
      timeFit: "fits" as const,
      frictionTags: [],
    };
    expect(
      trainingFeedbackInputSchema.safeParse({ ...base, scope: "item" }),
    ).toMatchObject({ success: false });
    expect(
      trainingFeedbackInputSchema.safeParse({
        ...base,
        scope: "program",
        programId: "program-1",
      }),
    ).toMatchObject({ success: true });
  });

  it("keeps a weekly contextual link targeted at its active program", () => {
    expect(
      resolveFeedbackTarget({
        requestedProgramItemId: null,
        requestedProgramId: "program-1",
        activeProgramId: "program-1",
        recentItems: [{ id: "item-1", programId: "program-1" }],
      }),
    ).toBe("program:program-1");
  });

  it("prefers an owned contextual item and rejects unknown URL targets", () => {
    const recentItems = [{ id: "item-1", programId: "program-1" }];
    expect(
      resolveFeedbackTarget({
        requestedProgramItemId: "item-1",
        requestedProgramId: "program-1",
        activeProgramId: "program-1",
        recentItems,
      }),
    ).toBe("item-1");
    expect(
      resolveFeedbackTarget({
        requestedProgramItemId: "unknown-item",
        requestedProgramId: "unknown-program",
        activeProgramId: "program-1",
        recentItems,
      }),
    ).toBe("item-1");
  });
});
