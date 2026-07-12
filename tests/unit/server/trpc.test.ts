import { describe, expect, it, vi } from "vitest";

import { protectedProcedure, router } from "@/server/trpc";

const testRouter = router({
  first: protectedProcedure.query(({ ctx }) => ctx.userId),
  second: protectedProcedure.query(({ ctx }) => ctx.userId),
});

describe("protected procedure authorization", () => {
  it("shares one authorization lookup across a batched request context", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      deletedAt: null,
      betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
    });
    const context = {
      session: { user: { id: "u1" }, expires: "2099-01-01" },
      prisma: { user: { findUnique } },
    } as never;
    const caller = testRouter.createCaller(context);

    await expect(Promise.all([caller.first(), caller.second()])).resolves.toEqual(
      ["u1", "u1"],
    );
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
