import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { fixedClock } from "@/lib/clock";
import { CURRENT_DATA_USE_NOTICE } from "@/lib/research-consent";
import {
  consentStatus,
  exportUserData,
  grantResearchConsent,
  purgeAccountByToken,
  requestAccountDeletion,
  runAccountPurge,
  StaleDataUseNoticeError,
  withdrawResearchConsent,
} from "@/server/account";

describe("account privacy service", () => {
  it("records grant, withdrawal, and regrant as auditable consent history", async () => {
    const at = new Date("2026-07-11T10:00:00Z");
    const created = { id: "new-grant" };
    const tx = {
      researchConsent: {
        findFirst: vi.fn().mockResolvedValue({
          noticeVersion: "old-notice",
          scopes: ["aggregate_observational_training"],
          withdrawnAt: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(created),
      },
    };
    const db = {
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
      researchConsent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    await expect(
      grantResearchConsent(db as never, "u1", CURRENT_DATA_USE_NOTICE.id, at),
    ).resolves.toBe(created);
    expect(tx.researchConsent.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", withdrawnAt: null },
      data: { withdrawnAt: at },
    });
    expect(tx.researchConsent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        noticeVersion: CURRENT_DATA_USE_NOTICE.id,
        grantedAt: at,
      }),
    });
    await withdrawResearchConsent(db as never, "u1", at);
    expect(db.researchConsent.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", withdrawnAt: null },
      data: { withdrawnAt: at },
    });
  });

  it("rejects a stale displayed notice before writing consent", async () => {
    const db = { $transaction: vi.fn() };
    await expect(
      grantResearchConsent(
        db as never,
        "u1",
        "research-data-use/old",
        new Date("2026-07-11T10:00:00Z"),
      ),
    ).rejects.toBeInstanceOf(StaleDataUseNoticeError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("reports current eligibility and an active outdated grant independently", async () => {
    const oldGrant = {
      id: "old",
      userId: "u1",
      noticeVersion: "research-data-use/old",
      scopes: ["aggregate_observational_training"],
      grantedAt: new Date("2026-07-10T10:00:00Z"),
      withdrawnAt: null,
    };
    const findFirst = vi.fn().mockResolvedValue(oldGrant);
    const status = await consentStatus(
      { researchConsent: { findFirst } } as never,
      "u1",
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", withdrawnAt: null },
      orderBy: { grantedAt: "desc" },
    });
    expect(status).toMatchObject({
      active: oldGrant,
      isEligible: false,
      hasActiveGrant: true,
    });
  });

  it("exports every current owned relation with explicit credential exclusions", async () => {
    const model = (value: unknown = []) => ({
      findMany: vi.fn().mockResolvedValue(value),
      findUnique: vi.fn().mockResolvedValue(value),
    });
    const db = {
      user: model({ id: "u1" }),
      account: model(),
      session: model(),
      platformConnection: model(),
      chessProfileSnapshot: model(),
      importedGame: model(),
      assessment: model(null),
      constraintSet: model(),
      program: model(),
      activityEvent: model(),
      skillState: model(),
      skillStateSnapshot: model(),
      scheduleState: model(),
      practiceItem: model(),
      adaptationLog: model(),
      rewardEvent: model(),
      notificationPref: model(null),
      apiCallBudget: model(),
      trainingPreferenceState: model(null),
      weeklyFocus: model(),
      allowlistEntry: model(),
      researchConsent: model(),
    };

    const exported = await exportUserData(db as never, "u1");
    expect(exported.exportFormat).toBe("mainline-user-export/v2");
    expect(Object.keys(exported)).toEqual(
      expect.arrayContaining([
        "accounts",
        "sessions",
        "platformConnections",
        "chessProfileSnapshots",
        "importedGames",
        "assessment",
        "constraintSets",
        "programs",
        "activityEvents",
        "skillStates",
        "skillStateSnapshots",
        "scheduleStates",
        "practiceItems",
        "adaptationLogs",
        "rewardEvents",
        "notificationPref",
        "apiCallBudgets",
        "trainingPreferenceState",
        "weeklyFocuses",
        "claimedAllowlistEntries",
        "researchConsents",
      ]),
    );
    expect(
      db.importedGame.findMany.mock.calls[0]?.[0].select.analysis.select,
    ).toHaveProperty("rawFeatures", true);
    expect(db.practiceItem.findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: { userId: "u1" },
        select: expect.objectContaining({ userId: true, fen: true }),
      }),
    );
    const accountSelect = db.account.findMany.mock.calls[0]?.[0].select;
    const userSelect = db.user.findUnique.mock.calls[0]?.[0].select;
    expect(userSelect).not.toHaveProperty("deletionToken");
    expect(accountSelect).not.toHaveProperty("access_token");
    expect(accountSelect).not.toHaveProperty("refresh_token");
    expect(accountSelect).not.toHaveProperty("id_token");
    expect(accountSelect).not.toHaveProperty("session_state");
    expect(db.session.findMany.mock.calls[0]?.[0].select).not.toHaveProperty(
      "sessionToken",
    );
    expect(
      db.platformConnection.findMany.mock.calls[0]?.[0].select,
    ).not.toHaveProperty("accessToken");
    expect(
      db.platformConnection.findMany.mock.calls[0]?.[0].select,
    ).not.toHaveProperty("refreshToken");
    expect(
      db.allowlistEntry.findMany.mock.calls[0]?.[0].select,
    ).not.toHaveProperty("inviteCode");
  });

  it("runs export model queries sequentially", async () => {
    let activeQueries = 0;
    let maximumActiveQueries = 0;
    const query = vi.fn(async () => {
      activeQueries += 1;
      maximumActiveQueries = Math.max(maximumActiveQueries, activeQueries);
      await Promise.resolve();
      activeQueries -= 1;
      return [];
    });
    const model = { findMany: query, findUnique: query };
    const db = {
      user: model,
      account: model,
      session: model,
      platformConnection: model,
      chessProfileSnapshot: model,
      importedGame: model,
      assessment: model,
      constraintSet: model,
      program: model,
      activityEvent: model,
      skillState: model,
      skillStateSnapshot: model,
      scheduleState: model,
      practiceItem: model,
      adaptationLog: model,
      rewardEvent: model,
      notificationPref: model,
      apiCallBudget: model,
      trainingPreferenceState: model,
      weeklyFocus: model,
      allowlistEntry: model,
      researchConsent: model,
    };

    await exportUserData(db as never, "u1");

    expect(query).toHaveBeenCalledTimes(22);
    expect(maximumActiveQueries).toBe(1);
    expect(activeQueries).toBe(0);
  });

  it("atomically assigns one opaque token and one purge job, then reuses it", async () => {
    const tx = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ deletionToken: null })
          .mockResolvedValueOnce({ deletionToken: "opaque" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      accountPurgeLedger: { create: vi.fn().mockResolvedValue({}) },
      jobRun: { create: vi.fn().mockResolvedValue({}) },
    };
    const db = {
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    };
    const clock = fixedClock(Date.parse("2026-07-11T10:00:00Z"));
    const token = await requestAccountDeletion(
      db as never,
      "user-secret-id",
      clock,
    );
    expect(token).not.toContain("user-secret-id");
    expect(tx.jobRun.create.mock.calls[0]?.[0].data.key).toBe(
      `account_purge:${token}`,
    );
    expect(
      await requestAccountDeletion(db as never, "user-secret-id", clock),
    ).toBe("opaque");
    expect(tx.user.updateMany).toHaveBeenCalledOnce();
    expect(tx.jobRun.create).toHaveBeenCalledOnce();
  });

  it("purges identifiers and user rows transactionally, preserving only an opaque completed ledger", async () => {
    const ledgerFind = vi.fn().mockResolvedValue({ completedAt: null });
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u1",
          platformConnections: [{ id: "conn1" }],
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
      jobRun: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      accountPurgeLedger: { update: vi.fn().mockResolvedValue({}) },
    };
    const db = {
      accountPurgeLedger: { findUnique: ledgerFind },
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    };
    await expect(
      purgeAccountByToken(db as never, "opaque", fixedClock(1000)),
    ).resolves.toEqual({ alreadyPurged: false });
    expect(tx.jobRun.deleteMany.mock.calls[0]?.[0].where.OR).toEqual([
      { key: { endsWith: "u1" } },
      { key: { endsWith: "conn1" } },
    ]);
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(tx.accountPurgeLedger.update).toHaveBeenCalledWith({
      where: { token: "opaque" },
      data: { completedAt: new Date(1000) },
    });

    ledgerFind.mockResolvedValueOnce({ completedAt: new Date(1000) });
    await expect(
      purgeAccountByToken(db as never, "opaque", fixedClock(2000)),
    ).resolves.toEqual({ alreadyPurged: true });
  });

  it("recovers a crash after the User was already removed", async () => {
    const update = vi.fn().mockResolvedValue({});
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      accountPurgeLedger: { update },
    };
    const db = {
      accountPurgeLedger: {
        findUnique: vi.fn().mockResolvedValue({ completedAt: null }),
      },
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    };
    await expect(
      purgeAccountByToken(db as never, "opaque", fixedClock(3000)),
    ).resolves.toEqual({ alreadyPurged: false });
    expect(update).toHaveBeenCalledWith({
      where: { token: "opaque" },
      data: { completedAt: new Date(3000) },
    });
  });

  it("reclaims a queued purge through runJob and removes its successful key", async () => {
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint",
      { code: "P2002", clientVersion: "test" },
    );
    const rootDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      accountPurgeLedger: { update: vi.fn().mockResolvedValue({}) },
    };
    const db = {
      jobRun: {
        create: vi.fn().mockRejectedValue(uniqueConflict),
        findUnique: vi.fn().mockResolvedValue({
          status: "queued",
          attempt: 0,
          lockedUntil: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: rootDeleteMany,
      },
      accountPurgeLedger: {
        findUnique: vi.fn().mockResolvedValue({ completedAt: null }),
      },
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    };

    await expect(
      runAccountPurge(db as never, "opaque", fixedClock(4000)),
    ).resolves.toMatchObject({ state: "completed", attempt: 1 });
    expect(db.jobRun.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { key: "account_purge:opaque", attempt: 0 },
      data: { status: "running", attempt: 1 },
    });
    expect(rootDeleteMany).toHaveBeenCalledWith({
      where: { key: "account_purge:opaque" },
    });
  });
});
