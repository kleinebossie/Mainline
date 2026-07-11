import { beforeEach, describe, expect, it, vi } from "vitest";

import { CURRENT_DATA_USE_NOTICE } from "@/lib/research-consent";

const account = vi.hoisted(() => {
  class StaleDataUseNoticeError extends Error {}
  return {
    StaleDataUseNoticeError,
    consentStatus: vi.fn(),
    exportUserData: vi.fn(),
    grantResearchConsent: vi.fn(),
    requestAccountDeletion: vi.fn(),
    runAccountPurge: vi.fn(),
    withdrawResearchConsent: vi.fn(),
  };
});

vi.mock("@/server/account", () => account);

import { accountRouter } from "@/server/routers/account";

function caller() {
  return accountRouter.createCaller({
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

describe("account router privacy orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.requestAccountDeletion.mockResolvedValue("opaque");
  });

  it("records consent only for the exact notice displayed by the client", async () => {
    account.grantResearchConsent.mockResolvedValue({ id: "grant" });

    await expect(
      caller().grantResearchConsent({
        affirmOptional: true,
        displayedNoticeVersion: CURRENT_DATA_USE_NOTICE.id,
      }),
    ).resolves.toEqual({ id: "grant" });
    expect(account.grantResearchConsent).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      CURRENT_DATA_USE_NOTICE.id,
      expect.any(Date),
    );
  });

  it("returns a safe typed conflict for a stale displayed notice", async () => {
    account.grantResearchConsent.mockRejectedValue(
      new account.StaleDataUseNoticeError("internal detail"),
    );

    await expect(
      caller().grantResearchConsent({
        affirmOptional: true,
        displayedNoticeVersion: "research-data-use/old",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "The data-use notice changed. Review the current notice and try again.",
    });
  });

  it.each(["active", "superseded"] as const)(
    "keeps deletion queued when the purge job is skipped as %s",
    async (reason) => {
      account.runAccountPurge.mockResolvedValue({
        state: "skipped",
        reason,
      });
      await expect(caller().deleteAccount()).resolves.toEqual({
        ok: true,
        state: "queued",
      });
    },
  );

  it.each([
    { state: "completed", value: {}, attempt: 1 },
    { state: "skipped", reason: "complete" },
  ])("reports erased only for a completed purge %#", async (result) => {
    account.runAccountPurge.mockResolvedValue(result);
    await expect(caller().deleteAccount()).resolves.toEqual({
      ok: true,
      state: "erased",
    });
  });
});
