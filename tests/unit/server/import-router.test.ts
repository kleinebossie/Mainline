import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { importRouter, manualImportJobKey } from "@/server/routers/import";

function authorizedContext(prisma: Record<string, unknown>) {
  return {
    session: { user: { id: "user-1" }, expires: "2099-01-01" },
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          deletedAt: null,
          betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
        }),
      },
      ...prisma,
    },
  } as never;
}

function uniqueConflict() {
  return new Prisma.PrismaClientKnownRequestError("unique", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("manual import job keys", () => {
  it("coalesces retries within one API budget window", () => {
    expect(
      manualImportJobKey("user-1", new Date("2026-07-16T12:05:00.000Z")),
    ).toBe(manualImportJobKey("user-1", new Date("2026-07-16T12:59:59.999Z")));
  });

  it("allows a fresh import in the next API budget window", () => {
    expect(
      manualImportJobKey("user-1", new Date("2026-07-16T12:59:59.999Z")),
    ).not.toBe(
      manualImportJobKey("user-1", new Date("2026-07-16T13:00:00.000Z")),
    );
  });
});

describe("manual PGN request limits", () => {
  it.each(["manualPreview", "manualCreate"] as const)(
    "blocks %s after the hourly request budget is exhausted",
    async (procedure) => {
      const transaction = vi.fn();
      const context = authorizedContext({
        apiCallBudget: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockRejectedValue(uniqueConflict()),
        },
        $transaction: transaction,
      });
      const caller = importRouter.createCaller(context);
      const request =
        procedure === "manualPreview"
          ? caller.manualPreview("1. e4 *")
          : caller.manualCreate({
              pgnText: "1. e4 *",
              games: [{ index: 0, color: "w" }],
            });

      await expect(request).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});
