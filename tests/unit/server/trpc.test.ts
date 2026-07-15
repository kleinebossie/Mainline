import { describe, expect, it, vi } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { protectedProcedure, router } from "@/server/trpc";
import { expectedError, INTERNAL_ERROR_MESSAGE } from "@/server/errors";

const testRouter = router({
  first: protectedProcedure.query(({ ctx }) => ctx.userId),
  second: protectedProcedure.query(({ ctx }) => ctx.userId),
  stale: protectedProcedure.query(() => {
    throw expectedError.conflict(
      "This item changed. Reload the page before trying again.",
    );
  }),
  explode: protectedProcedure.query(() => {
    throw new Error("private database host and query text");
  }),
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

    await expect(
      Promise.all([caller.first(), caller.second()]),
    ).resolves.toEqual(["u1", "u1"]);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("maps transport-independent expected errors at the API boundary", async () => {
    const context = {
      session: { user: { id: "u1" }, expires: "2099-01-01" },
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            deletedAt: null,
            betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
          }),
        },
      },
    } as never;

    await expect(
      testRouter.createCaller(context).stale(),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This item changed. Reload the page before trying again.",
    });
  });

  it("sanitizes unexpected errors in the actual HTTP response", async () => {
    const context = {
      session: { user: { id: "u1" }, expires: "2099-01-01" },
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            deletedAt: null,
            betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
          }),
        },
      },
    } as never;
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request("http://mainline.test/api/trpc/explode"),
      router: testRouter,
      createContext: async () => context,
    });
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain(INTERNAL_ERROR_MESSAGE);
    expect(body).not.toContain("private database host");
    expect(body).not.toContain('"stack"');
  });
});
