import { describe, expect, it, vi } from "vitest";

import {
  admitBetaUser,
  authoritativeGoogleEmail,
  ownerEmailsFromEnv,
} from "@/server/beta-access";

const NOW = new Date("2026-07-11T12:00:00.000Z");

function fakeDb(options: {
  role?: string | null;
  deletedAt?: Date | null;
  betaAccessGrantedAt?: Date | null;
  entry?: {
    id: string;
    email?: string | null;
    usedByUserId: string | null;
  } | null;
  claimCount?: number;
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
    allowlistEntry: {
      findFirst: vi.fn().mockResolvedValue(options.entry ?? null),
      updateMany: vi.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
    },
  };
  return {
    ...db,
    $transaction: vi.fn((run: (tx: typeof db) => unknown) => run(db)),
  };
}

describe("closed-beta admission", () => {
  it("refuses a non-allowlisted sign-in", async () => {
    const db = fakeDb({ entry: null });
    await expect(
      admitBetaUser(db as never, {
        userId: "user-1",
        authoritativeEmail: "not-invited@example.com",
        now: NOW,
        ownerEmails: new Set(),
      }),
    ).resolves.toBe(false);
  });

  it("preserves owner and admin access", async () => {
    const ownerDb = fakeDb({});
    await expect(
      admitBetaUser(ownerDb as never, {
        authoritativeEmail: "Owner@Example.com",
        now: NOW,
        ownerEmails: ownerEmailsFromEnv("owner@example.com"),
      }),
    ).resolves.toBe(true);
    expect(ownerDb.allowlistEntry.findFirst).not.toHaveBeenCalled();

    const adminDb = fakeDb({ role: "admin" });
    await expect(
      admitBetaUser(adminDb as never, {
        userId: "admin-1",
        now: NOW,
        ownerEmails: new Set(),
      }),
    ).resolves.toBe(true);
  });

  it("preserves access granted to accounts by the gate migration", async () => {
    const db = fakeDb({ betaAccessGrantedAt: NOW });
    await expect(
      admitBetaUser(db as never, {
        userId: "user-zero",
        now: NOW,
        ownerEmails: new Set(),
      }),
    ).resolves.toBe(true);
    expect(db.user.findUnique).toHaveBeenCalledOnce();
    expect(db.allowlistEntry.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a soft-deleted account even when it predates the gate", async () => {
    const db = fakeDb({ role: "admin", deletedAt: NOW });
    await expect(
      admitBetaUser(db as never, {
        userId: "deleted-user",
        authoritativeEmail: "owner@example.com",
        now: NOW,
        ownerEmails: new Set(["owner@example.com"]),
      }),
    ).resolves.toBe(false);
  });

  it("claims a current allowlist entry for the authenticated user", async () => {
    const db = fakeDb({
      role: "user",
      entry: { id: "entry-1", usedByUserId: null },
    });
    await expect(
      admitBetaUser(db as never, {
        userId: "user-1",
        inviteCode: "invite-123",
        now: NOW,
        ownerEmails: new Set(),
      }),
    ).resolves.toBe(true);
    expect(db.allowlistEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "entry-1", usedByUserId: null },
      data: { usedByUserId: "user-1" },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { betaAccessGrantedAt: NOW },
    });
    expect(db.allowlistEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }] },
          ]),
        }),
      }),
    );
  });

  it("allows the account that already owns an invite without claiming it again", async () => {
    const db = fakeDb({
      role: "user",
      entry: { id: "entry-1", usedByUserId: "user-1" },
    });
    await expect(
      admitBetaUser(db as never, {
        userId: "user-1",
        inviteCode: "invite-123",
        now: NOW,
        ownerEmails: new Set(),
      }),
    ).resolves.toBe(true);
    expect(db.allowlistEntry.updateMany).not.toHaveBeenCalled();
    expect(db.user.update).toHaveBeenCalledOnce();
  });

  it("refuses admission when another request wins the invite claim", async () => {
    const db = fakeDb({
      role: "user",
      entry: { id: "entry-1", usedByUserId: null },
      claimCount: 0,
    });
    await expect(
      admitBetaUser(db as never, {
        userId: "user-2",
        inviteCode: "invite-123",
        now: NOW,
        ownerEmails: new Set(),
      }),
    ).resolves.toBe(false);
  });

  it("validates an invite before Auth.js creates the database user", async () => {
    const db = fakeDb({
      entry: { id: "entry-1", email: null, usedByUserId: null },
    });
    await expect(
      admitBetaUser(db as never, {
        inviteCode: "invite-123",
        now: NOW,
        ownerEmails: new Set(),
      }),
    ).resolves.toBe(true);
    expect(db.allowlistEntry.updateMany).not.toHaveBeenCalled();
  });

  it("accepts only verified provider-authoritative Google profiles", () => {
    expect(
      authoritativeGoogleEmail({
        email: "Invited.User@GMAIL.com",
        email_verified: true,
      }),
    ).toBe("invited.user@gmail.com");
    expect(
      authoritativeGoogleEmail({
        email: "person@example.com",
        email_verified: true,
        hd: "example.com",
      }),
    ).toBe("person@example.com");
    expect(
      authoritativeGoogleEmail({
        email: "person@example.com",
        email_verified: true,
      }),
    ).toBeNull();
    expect(
      authoritativeGoogleEmail({
        email: "person@example.com",
        email_verified: true,
        hd: "other.example",
      }),
    ).toBeNull();
    expect(
      authoritativeGoogleEmail({
        email: "person@gmail.com",
        email_verified: false,
      }),
    ).toBeNull();
  });
});
