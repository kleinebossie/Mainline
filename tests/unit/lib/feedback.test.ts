import { describe, expect, it } from "vitest";

import { safeRouteContext, trainingFeedbackInputSchema } from "@/lib/feedback";

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
});
