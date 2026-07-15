import { beforeEach, describe, expect, it, vi } from "vitest";

const history = vi.hoisted(() => ({
  getProgramHistory: vi.fn(),
}));

vi.mock("@/server/program-history", () => history);

import { programRouter } from "@/server/routers/program";

function caller() {
  return programRouter.createCaller({
    session: { user: { id: "u1" }, expires: "2099-01-01" },
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          deletedAt: null,
          betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
        }),
      },
    },
  } as never);
}

describe("P7 program history router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    history.getProgramHistory.mockResolvedValue({
      entries: [],
      nextCursor: null,
    });
  });

  it("protects and delegates the bounded history read", async () => {
    await expect(caller().history({ limit: 7 })).resolves.toEqual({
      entries: [],
      nextCursor: null,
    });
    expect(history.getProgramHistory).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      { limit: 7 },
    );
  });

  it("accepts the forward direction added by tRPC infinite queries", async () => {
    await expect(
      caller().history({ limit: 8, direction: "forward" }),
    ).resolves.toEqual({ entries: [], nextCursor: null });
    expect(history.getProgramHistory).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      { limit: 8, direction: "forward" },
    );
  });

  it("applies the default page bound", async () => {
    await caller().history();
    expect(history.getProgramHistory).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      { limit: 10 },
    );
  });
});
