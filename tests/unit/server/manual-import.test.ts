import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { MANUAL_PGN_MAX_GAMES_PER_USER } from "@/lib/manual-import";
import {
  importManualPgnBatch,
  importManualPgnBatchWithinQuota,
  ManualGameQuotaExceededError,
  previewManualPgn,
} from "@/server/manual-import";

const TAGGED_GAME = [
  '[Event "City Open"]',
  '[Date "2026.07.04"]',
  '[White "Alice"]',
  '[Black "Jo"]',
  '[Result "1-0"]',
  '[TimeControl "5400+30"]',
  '[WhiteElo "1810"]',
  '[BlackElo "1725"]',
  '[ECO "C50"]',
  '[Opening "Italian Game"]',
  "",
  "1. e4 e5 2. Nf3 Nc6 1-0",
].join("\n");

function uniqueConflict() {
  return new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("manual PGN import service", () => {
  it("returns metadata previews without echoing canonical PGN", () => {
    const preview = previewManualPgn(TAGGED_GAME);

    expect(preview).toMatchObject({
      ok: true,
      entries: [
        {
          status: "valid",
          index: 0,
          plyCount: 4,
          metadata: { event: "City Open", white: "Alice", black: "Jo" },
        },
      ],
    });
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.entries[0]).not.toHaveProperty("canonicalPgn");
  });

  it("orients raw result and ratings from the chosen color", async () => {
    const create = vi.fn().mockResolvedValue({ id: "manual-1" });
    const result = await importManualPgnBatch(
      { importedGame: { create } } as never,
      "user-1",
      TAGGED_GAME,
      [{ index: 0, color: "b" }],
    );

    expect(result).toMatchObject({
      ok: true,
      imported: 1,
      duplicates: 0,
      entries: [{ status: "imported", index: 0, gameId: "manual-1" }],
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        platform: "manual",
        source: "manual",
        color: "b",
        result: "loss",
        userRatingAtGame: 1725,
        opponentRating: 1810,
        timeControl: "5400+30",
        eco: "C50",
        opening: "Italian Game",
        playedAt: new Date("2026-07-04T12:00:00.000Z"),
      }),
      select: { id: true },
    });
    const data = create.mock.calls[0]?.[0].data;
    expect(data.externalGameId).toMatch(/^[a-f0-9]{64}$/);
    expect(data.dedupeKey).toBe(`manual:${data.externalGameId}`);
  });

  it("keeps missing optional observations unknown", async () => {
    const create = vi.fn().mockResolvedValue({ id: "manual-2" });
    await importManualPgnBatch(
      { importedGame: { create } } as never,
      "user-1",
      "1. d4 d5 *",
      [{ index: 0, color: "w" }],
    );

    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      playedAt: null,
      result: undefined,
      userRatingAtGame: undefined,
      opponentRating: undefined,
      timeControl: undefined,
    });
  });

  it("requires color without rejecting valid siblings", async () => {
    const create = vi.fn().mockResolvedValue({ id: "manual-3" });
    const pgn = `${TAGGED_GAME}\n\n[Event "Second"]\n\n1. d4 d5 *`;
    const result = await importManualPgnBatch(
      { importedGame: { create } } as never,
      "user-1",
      pgn,
      [{ index: 0 }, { index: 1, color: "w" }],
    );

    expect(result.entries).toMatchObject([
      { status: "needs_input", index: 0 },
      { status: "imported", index: 1 },
    ]);
    expect(create).toHaveBeenCalledOnce();
  });

  it("imports valid games while reporting malformed and variant siblings", async () => {
    const create = vi.fn().mockResolvedValue({ id: "manual-4" });
    const pgn = [
      '[Event "Good"]\n\n1. e4 e5 1-0',
      '[Event "Bad"]\n\n1. d4 Nope 0-1',
      '[Event "Variant"]\n[Variant "Chess960"]\n\n1. c4 *',
    ].join("\n\n");
    const result = await importManualPgnBatch(
      { importedGame: { create } } as never,
      "user-1",
      pgn,
      [{ index: 0, color: "w" }],
    );

    expect(result.entries).toMatchObject([
      { status: "imported", index: 0 },
      { status: "rejected", index: 1 },
      { status: "unsupported", index: 2 },
    ]);
  });

  it("reports stable normalized-content duplicates", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: "manual-5" })
      .mockRejectedValueOnce(uniqueConflict());
    const db = { importedGame: { create } } as never;
    const compact = '[Event "Club"]\n[White "A"]\n[Black "B"]\n\n1.e4 e5 *';
    const spaced =
      '[Black "B"]\r\n[Event " Club "]\r\n[White "A"]\r\n\r\n1. e4   e5 *';

    await importManualPgnBatch(db, "user-1", compact, [
      { index: 0, color: "w" },
    ]);
    const duplicate = await importManualPgnBatch(db, "user-1", spaced, [
      { index: 0, color: "w" },
    ]);

    expect(duplicate).toMatchObject({
      imported: 0,
      duplicates: 1,
      entries: [{ status: "duplicate", index: 0 }],
    });
    expect(create.mock.calls[1]?.[0].data.dedupeKey).toBe(
      create.mock.calls[0]?.[0].data.dedupeKey,
    );
  });

  it("propagates unexpected persistence failures", async () => {
    const create = vi.fn().mockRejectedValue(new Error("database unavailable"));

    await expect(
      importManualPgnBatch(
        { importedGame: { create } } as never,
        "user-1",
        "1. e4 *",
        [{ index: 0, color: "w" }],
      ),
    ).rejects.toThrow("database unavailable");
  });

  it("writes optional user corrections back into canonical PGN", async () => {
    const create = vi.fn().mockResolvedValue({ id: "manual-6" });
    await importManualPgnBatch(
      { importedGame: { create } } as never,
      "user-1",
      "1. e4 e5 *",
      [
        {
          index: 0,
          color: "b",
          playedDate: "2026-07-15",
          timeControl: "90+30",
          result: "win",
          userRating: 1900,
          opponentRating: 1875,
          event: "Regional final",
        },
      ],
    );

    const data = create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      color: "b",
      result: "win",
      userRatingAtGame: 1900,
      opponentRating: 1875,
      playedAt: new Date("2026-07-15T12:00:00.000Z"),
      timeControl: "90+30",
    });
    expect(data.pgn).toContain('[Event "Regional final"]');
    expect(data.pgn).toContain('[Result "0-1"]');
    expect(data.pgn).toContain('[WhiteElo "1875"]');
    expect(data.pgn).toContain('[BlackElo "1900"]');
  });

  it("enforces the manual library cap inside a serializable transaction", async () => {
    const create = vi.fn();
    const transaction = vi.fn(
      async (
        run: (tx: unknown) => Promise<unknown>,
        options: { isolationLevel: string },
      ) => {
        expect(options).toEqual({ isolationLevel: "Serializable" });
        return run({
          $queryRaw: vi.fn().mockResolvedValue([{ id: "user-1" }]),
          importedGame: {
            count: vi.fn().mockResolvedValue(MANUAL_PGN_MAX_GAMES_PER_USER),
            create,
          },
        });
      },
    );

    await expect(
      importManualPgnBatchWithinQuota(
        { $transaction: transaction } as never,
        "user-1",
        "1. e4 *",
        [{ index: 0, color: "w" }],
      ),
    ).rejects.toBeInstanceOf(ManualGameQuotaExceededError);
    expect(create).not.toHaveBeenCalled();
  });

  it("prechecks duplicates while holding the per-user quota lock", async () => {
    const create = vi.fn();
    const findUnique = vi.fn().mockResolvedValue({ id: "existing" });
    const transaction = vi.fn(async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        $queryRaw: vi.fn().mockResolvedValue([{ id: "user-1" }]),
        importedGame: {
          count: vi.fn().mockResolvedValue(MANUAL_PGN_MAX_GAMES_PER_USER - 1),
          findUnique,
          create,
        },
      }),
    );

    await expect(
      importManualPgnBatchWithinQuota(
        { $transaction: transaction } as never,
        "user-1",
        "1. e4 *",
        [{ index: 0, color: "w" }],
      ),
    ).resolves.toMatchObject({ imported: 0, duplicates: 1 });
    expect(findUnique).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });

  it("retries a serialization conflict before reserving quota", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    const create = vi.fn().mockResolvedValue({ id: "manual-after-retry" });
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          $queryRaw: vi.fn().mockResolvedValue([{ id: "user-1" }]),
          importedGame: {
            count: vi.fn().mockResolvedValue(0),
            findUnique: vi.fn().mockResolvedValue(null),
            create,
          },
        }),
      );

    await expect(
      importManualPgnBatchWithinQuota(
        { $transaction: transaction } as never,
        "user-1",
        "1. e4 *",
        [{ index: 0, color: "w" }],
      ),
    ).resolves.toMatchObject({ imported: 1 });
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
