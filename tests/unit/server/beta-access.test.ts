import { describe, expect, it, vi } from "vitest";

import { admitBetaUser } from "@/server/beta-access";

const NOW = new Date("2026-07-11T12:00:00.000Z");

function fakeDb(options: {
  role?: string | null;
  deletedAt?: Date | null;
  betaAccessGrantedAt?: Date | null;
}) {
  const db = {
    user: {
      findUnique: vi.fn().mockResolvedValue(
        options.role === undefined &&
          options.deletedAt === undefined &&
          options.betaAccessGrantedAt === undefined
          ? null
          : {
              role: options.role,
              deletedAt: options.deletedAt ?? null,
              betaAccessGrantedAt: options.betaAccessGrantedAt ?? null,
            },
      ),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return db;
}

describe("open-beta admission", () => {
  it("admits any standard non-deleted sign-in", async () => {
    const db = fakeDb({ role: "user" });
    await expect(
      admitBetaUser(db as never, {
        userId: "user-1",
        now: NOW,
      }),
    ).resolves.toBe(true);

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { betaAccessGrantedAt: NOW },
    });
  });

  it("admits preflight sign-ins before user creation in database", async () => {
    const db = fakeDb({});
    await expect(
      admitBetaUser(db as never, {
        now: NOW,
      }),
    ).resolves.toBe(true);
  });

  it("preserves access granted to accounts", async () => {
    const db = fakeDb({ betaAccessGrantedAt: NOW });
    await expect(
      admitBetaUser(db as never, {
        userId: "existing-user",
        now: NOW,
      }),
    ).resolves.toBe(true);
    expect(db.user.findUnique).toHaveBeenCalledOnce();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses a soft-deleted account", async () => {
    const db = fakeDb({ role: "user", deletedAt: NOW });
    await expect(
      admitBetaUser(db as never, {
        userId: "deleted-user",
        now: NOW,
      }),
    ).resolves.toBe(false);
  });
});
