import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformAdapter } from "@/integrations/adapter";
import type { PrismaClient } from "@prisma/client";

const { assertApiCallBudgetMock, getAdapterMock } = vi.hoisted(() => ({
  assertApiCallBudgetMock: vi.fn(),
  getAdapterMock: vi.fn(),
}));

vi.mock("@/integrations/registry", () => ({
  getAdapter: getAdapterMock,
}));

vi.mock("@/server/api-budget", () => ({
  ApiCallBudgetExceededError: class ApiCallBudgetExceededError extends Error {},
  assertApiCallBudget: assertApiCallBudgetMock,
}));

import { importConnection } from "@/server/import";

const START = 1_700_000_000_000;

describe("importConnection clock", () => {
  beforeEach(() => {
    assertApiCallBudgetMock.mockReset().mockResolvedValue(undefined);
    getAdapterMock.mockReset();
  });

  it("uses the injected clock for request budgets and the sync watermark", async () => {
    let now = START;
    const adapter: PlatformAdapter = {
      platform: "lichess",
      isLoginProvider: true,
      async fetchProfile(connection) {
        await connection.beforeRequest?.();
        now += 5_000;
        return {
          platform: "lichess",
          externalUsername: "player",
          capturedAt: START,
          ratings: {},
          totalGames: 0,
          raw: {},
        };
      },
      async fetchGames(connection) {
        await connection.beforeRequest?.();
        return [];
      },
    };
    getAdapterMock.mockReturnValue(adapter);

    const createSnapshot = vi.fn().mockResolvedValue({});
    const createGames = vi.fn().mockResolvedValue({ count: 0 });
    const updateConnection = vi.fn().mockResolvedValue({});
    const tx = {
      chessProfileSnapshot: { create: createSnapshot },
      importedGame: { createMany: createGames },
      platformConnection: {
        findUnique: vi.fn().mockResolvedValue({
          userId: "user-1",
          lastSyncedAt: null,
          updatedAt: new Date(START - 1),
        }),
        update: updateConnection,
      },
    };
    const db = {
      ...tx,
      $transaction: (work: (client: typeof tx) => unknown) => work(tx),
    } as unknown as PrismaClient;

    await importConnection(
      db,
      {
        id: "connection-1",
        userId: "user-1",
        platform: "lichess",
        externalUsername: "player",
        accessToken: null,
        lastSyncedAt: null,
      },
      { now: () => now },
    );

    expect(assertApiCallBudgetMock).toHaveBeenNthCalledWith(
      1,
      db,
      "user-1",
      "lichess",
      new Date(START),
    );
    expect(assertApiCallBudgetMock).toHaveBeenNthCalledWith(
      2,
      db,
      "user-1",
      "lichess",
      new Date(START + 5_000),
    );
    expect(updateConnection).toHaveBeenCalledWith({
      where: { id: "connection-1" },
      data: {
        lastSyncedAt: new Date(START),
        status: "active",
        updatedAt: new Date(START + 5_000),
      },
    });
  });

  it("keeps a game that appears mid-import eligible for the next import", async () => {
    let now = START;
    const midImportGameAt = START + 2_500;
    const seenSince: Array<number | undefined> = [];
    let fetchCount = 0;
    const adapter: PlatformAdapter = {
      platform: "lichess",
      isLoginProvider: true,
      async fetchProfile() {
        now += 1_000;
        return {
          platform: "lichess",
          externalUsername: "player",
          capturedAt: now,
          ratings: {},
          totalGames: 1,
          raw: {},
        };
      },
      async fetchGames(_connection, since) {
        seenSince.push(since);
        fetchCount += 1;
        if (fetchCount === 1) {
          now += 4_000;
          return [];
        }
        if (since !== undefined && since <= midImportGameAt) {
          return [
            {
              platform: "lichess",
              externalGameId: "mid-import-game",
              dedupeKey: "lichess:mid-import-game",
              pgn: "1. e4 e5 *",
              playedAt: midImportGameAt,
              source: "lichess",
            },
          ];
        }
        return [];
      },
    };
    getAdapterMock.mockReturnValue(adapter);

    let savedWatermark: Date | null = null;
    let savedUpdatedAt = new Date(START - 1);
    const createGames = vi.fn(
      async ({ data }: { data: Array<{ externalGameId: string }> }) => ({
        count: data.length,
      }),
    );
    const tx = {
      chessProfileSnapshot: { create: vi.fn().mockResolvedValue({}) },
      importedGame: { createMany: createGames },
      platformConnection: {
        findUnique: vi.fn(async () => ({
          userId: "user-1",
          lastSyncedAt: savedWatermark,
          updatedAt: savedUpdatedAt,
        })),
        update: vi.fn(
          async ({
            data,
          }: {
            data: { lastSyncedAt: Date; updatedAt: Date };
          }) => {
            savedWatermark = data.lastSyncedAt;
            savedUpdatedAt = data.updatedAt;
            return {};
          },
        ),
      },
    };
    const db = {
      ...tx,
      $transaction: (work: (client: typeof tx) => unknown) => work(tx),
    } as unknown as PrismaClient;
    const connection = {
      id: "connection-1",
      userId: "user-1",
      platform: "lichess",
      externalUsername: "player",
      accessToken: null,
      lastSyncedAt: null,
    };
    const clock = { now: () => now };

    await importConnection(db, connection, clock);
    const firstWatermark = savedWatermark;
    expect(firstWatermark).toEqual(new Date(START));

    now += 5_000;
    await importConnection(
      db,
      { ...connection, lastSyncedAt: firstWatermark },
      clock,
    );

    expect(seenSince).toEqual([undefined, START]);
    expect(createGames).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ externalGameId: "mid-import-game" })],
      }),
    );
  });

  it("drops local effects when another import advanced the connection cursor", async () => {
    const adapter: PlatformAdapter = {
      platform: "lichess",
      isLoginProvider: true,
      async fetchProfile() {
        return {
          platform: "lichess",
          externalUsername: "player",
          capturedAt: START,
          ratings: {},
          totalGames: 0,
          raw: {},
        };
      },
      async fetchGames() {
        return [];
      },
    };
    getAdapterMock.mockReturnValue(adapter);
    const createSnapshot = vi.fn();
    const createGames = vi.fn();
    const updateConnection = vi.fn();
    const tx = {
      chessProfileSnapshot: { create: createSnapshot },
      importedGame: { createMany: createGames },
      platformConnection: {
        findUnique: vi.fn().mockResolvedValue({
          userId: "user-1",
          lastSyncedAt: new Date(START - 1),
          updatedAt: new Date(START - 1),
        }),
        update: updateConnection,
      },
    };
    const db = {
      ...tx,
      $transaction: (work: (client: typeof tx) => unknown) => work(tx),
    } as unknown as PrismaClient;

    await expect(
      importConnection(
        db,
        {
          id: "connection-1",
          userId: "user-1",
          platform: "lichess",
          externalUsername: "player",
          accessToken: null,
          lastSyncedAt: null,
        },
        { now: () => START },
      ),
    ).resolves.toEqual({
      platform: "lichess",
      snapshotCaptured: false,
      fetched: 0,
      imported: 0,
    });
    expect(createSnapshot).not.toHaveBeenCalled();
    expect(createGames).not.toHaveBeenCalled();
    expect(updateConnection).not.toHaveBeenCalled();
  });
});
