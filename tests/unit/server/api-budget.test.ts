import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import {
  apiBudgetWindowStart,
  consumeApiCallBudget,
} from "@/server/api-budget";

function fakeDb() {
  const counts = new Map<string, number>();
  const keyFor = (key: {
    userId: string;
    platform: string;
    windowStart: Date;
  }) => `${key.userId}:${key.platform}:${key.windowStart.toISOString()}`;
  return {
    counts,
    apiCallBudget: {
      updateMany: async ({ where }: { where: Record<string, unknown> }) => {
        const key = keyFor(where as never);
        const count = counts.get(key);
        const limit = (where.count as { lt: number }).lt;
        if (count === undefined || count >= limit) return { count: 0 };
        counts.set(key, count + 1);
        return { count: 1 };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const key = keyFor(data as never);
        if (counts.has(key)) {
          throw new Prisma.PrismaClientKnownRequestError("unique", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        counts.set(key, data.count as number);
      },
      findUniqueOrThrow: async ({
        where,
      }: {
        where: { userId_platform_windowStart: Record<string, unknown> };
      }) => ({
        count: counts.get(keyFor(where.userId_platform_windowStart as never)),
      }),
    },
  };
}

describe("per-user external API budgets", () => {
  it("blocks calls beyond the configured fixed-window limit", async () => {
    const db = fakeDb();
    const policy = { limit: 2, windowMs: 60_000 };
    const now = new Date("2026-07-11T12:00:30.000Z");

    await expect(
      consumeApiCallBudget(db as never, "user-1", "lichess", now, policy),
    ).resolves.toMatchObject({ allowed: true, count: 1 });
    await expect(
      consumeApiCallBudget(db as never, "user-1", "lichess", now, policy),
    ).resolves.toMatchObject({ allowed: true, count: 2 });
    await expect(
      consumeApiCallBudget(db as never, "user-1", "lichess", now, policy),
    ).resolves.toMatchObject({ allowed: false, count: 2, limit: 2 });
  });

  it("isolates users and starts a fresh bucket in the next window", async () => {
    const db = fakeDb();
    const policy = { limit: 1, windowMs: 60_000 };
    const first = new Date("2026-07-11T12:00:30.000Z");
    const next = new Date("2026-07-11T12:01:00.000Z");

    expect(apiBudgetWindowStart(first, policy.windowMs).toISOString()).toBe(
      "2026-07-11T12:00:00.000Z",
    );
    await consumeApiCallBudget(
      db as never,
      "user-1",
      "chesscom",
      first,
      policy,
    );
    await expect(
      consumeApiCallBudget(db as never, "user-2", "chesscom", first, policy),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      consumeApiCallBudget(db as never, "user-1", "lichess", first, policy),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      consumeApiCallBudget(db as never, "user-1", "chesscom", next, policy),
    ).resolves.toMatchObject({ allowed: true, count: 1 });
  });

  it("propagates unexpected database errors", async () => {
    const failure = new Error("database unavailable");
    const db = fakeDb();
    db.apiCallBudget.create = async () => {
      throw failure;
    };

    await expect(
      consumeApiCallBudget(
        db as never,
        "user-1",
        "lichess",
        new Date("2026-07-11T12:00:30.000Z"),
        { limit: 1, windowMs: 60_000 },
      ),
    ).rejects.toBe(failure);
  });
});
