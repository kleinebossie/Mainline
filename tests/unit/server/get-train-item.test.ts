import { describe, expect, it } from "vitest";

import { programRouter } from "@/server/routers/program";

function createCaller(fakePrisma: unknown) {
  return programRouter.createCaller({
    session: { user: { id: "user-1" }, expires: "2099-01-01" },
    prisma: fakePrisma,
  } as never);
}

describe("getTrainItem endpoint nextItem resolution", () => {
  it("resolves nextItem to the subsequent uncompleted item in the program", async () => {
    const mockItems = [
      {
        id: "item-1",
        orderIndex: 0,
        activityId: "tactics_theme",
        activityType: "puzzle_theme",
        dimensionsTargeted: ["calculation"],
        params: { theme: "fork", targetRating: 1500, count: 5 },
        rationaleText: "Drill tactical weaknesses",
        evidenceGrade: "A",
        evidenceTier: 1,
        citationKey: "deliberate_practice",
        confidence: "high",
        soften: false,
        status: "done",
        resourceRef: null,
      },
      {
        id: "item-2",
        orderIndex: 1,
        activityId: "blunder_drill",
        activityType: "blunder_drill",
        dimensionsTargeted: ["blunder_prevention"],
        params: { dueItemRefs: ["p1"] },
        rationaleText: "Review missed blunders",
        evidenceGrade: "A",
        evidenceTier: 1,
        citationKey: "deliberate_practice",
        confidence: "high",
        soften: false,
        status: "todo",
        resourceRef: null,
      },
      {
        id: "item-3",
        orderIndex: 2,
        activityId: "endgame_drill",
        activityType: "endgame_drill",
        dimensionsTargeted: ["endgame_conversion"],
        params: { dueItemRefs: ["e1"] },
        rationaleText: "Convert winning endgames",
        evidenceGrade: "B",
        evidenceTier: 1,
        citationKey: "spaced_repetition",
        confidence: "medium",
        soften: false,
        status: "todo",
        resourceRef: null,
      },
    ];

    const fakePrisma = {
      programItem: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const target = mockItems.find((i) => i.id === where.id);
          if (!target) return null;
          return {
            ...target,
            program: {
              id: "program-1",
              userId: "user-1",
              methodologyVersion: "research-1.0.0",
              items: mockItems,
            },
          };
        },
      },
      user: {
        findUnique: async () => ({
          primaryPlatform: "lichess",
          deletedAt: null,
          betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
        }),
      },
      practiceItem: {
        findMany: async () => [
          {
            id: "p1",
            fen: "8/8/8/8/8/8/8/8 w - - 0 1",
            solutionLine: ["e2e4"],
          },
        ],
      },
      lichessPuzzle: {
        findMany: async () => [],
      },
      activityEvent: {
        findMany: async () => [],
      },
      assessment: {
        findUnique: async () => ({ tacticalRatingEstimate: 1500 }),
      },
      chessProfileSnapshot: {
        findFirst: async () => null,
      },
      constraintSet: {
        findFirst: async () => ({
          formatPrefs: { targetFocus: "online" },
        }),
      },
    };

    const caller = createCaller(fakePrisma);

    // When querying item-1 (Block 1), nextItem should be item-2 (Block 2)
    const result1 = await caller.getTrainItem({ programItemId: "item-1" });
    expect(result1.nextItem).not.toBeNull();
    expect(result1.nextItem?.id).toBe("item-2");
    expect(result1.nextItem?.orderIndex).toBe(1);
    expect(result1.nextItem?.url).toBe("/train/item-2");

    // When querying item-2 (Block 2), nextItem should be item-3 (Block 3)
    const result2 = await caller.getTrainItem({ programItemId: "item-2" });
    expect(result2.nextItem).not.toBeNull();
    expect(result2.nextItem?.id).toBe("item-3");
    expect(result2.nextItem?.orderIndex).toBe(2);
    expect(result2.nextItem?.url).toBe("/train/item-3");
  });

  it("returns null for nextItem when completing the last block of the session", async () => {
    const mockItems = [
      {
        id: "item-1",
        orderIndex: 0,
        activityId: "blunder_drill",
        activityType: "blunder_drill",
        dimensionsTargeted: ["blunder_prevention"],
        params: { dueItemRefs: ["p1"] },
        rationaleText: "Review missed blunders",
        evidenceGrade: "A",
        evidenceTier: 1,
        citationKey: "deliberate_practice",
        confidence: "high",
        soften: false,
        status: "todo",
        resourceRef: null,
      },
    ];

    const fakePrisma = {
      programItem: {
        findUnique: async () => ({
          ...mockItems[0],
          program: {
            id: "program-1",
            userId: "user-1",
            methodologyVersion: "research-1.0.0",
            items: mockItems,
          },
        }),
      },
      user: {
        findUnique: async () => ({
          primaryPlatform: "lichess",
          deletedAt: null,
          betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
        }),
      },
      practiceItem: {
        findMany: async () => [
          {
            id: "p1",
            fen: "8/8/8/8/8/8/8/8 w - - 0 1",
            solutionLine: ["e2e4"],
          },
        ],
      },
      assessment: {
        findUnique: async () => ({ tacticalRatingEstimate: 1500 }),
      },
      chessProfileSnapshot: {
        findFirst: async () => null,
      },
      constraintSet: {
        findFirst: async () => ({
          formatPrefs: { targetFocus: "online" },
        }),
      },
    };

    const caller = createCaller(fakePrisma);
    const result = await caller.getTrainItem({ programItemId: "item-1" });
    expect(result.nextItem).toBeNull();
  });
});
