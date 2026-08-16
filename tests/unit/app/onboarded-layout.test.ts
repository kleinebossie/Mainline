import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireOnboardingComplete: vi.fn(),
  prisma: {} as never,
}));

vi.mock("@/server/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/server/onboarding", () => ({
  requireOnboardingComplete: mocks.requireOnboardingComplete,
}));

vi.mock("@/db/client", () => ({
  prisma: mocks.prisma,
}));

import OnboardedLayout from "@/app/(authenticated)/(onboarded)/layout";

describe("OnboardedLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no authenticated user session", async () => {
    mocks.getSession.mockResolvedValue(null);
    const result = await OnboardedLayout({ children: "content" });
    expect(result).toBeNull();
    expect(mocks.requireOnboardingComplete).not.toHaveBeenCalled();
  });

  it("bypasses database check when session user is already onboarded", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1", onboarded: true },
    });
    const result = await OnboardedLayout({ children: "content" });
    expect(result).toBe("content");
    expect(mocks.requireOnboardingComplete).not.toHaveBeenCalled();
  });

  it("calls requireOnboardingComplete when session user onboarded flag is false", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1", onboarded: false },
    });
    const result = await OnboardedLayout({ children: "content" });
    expect(result).toBe("content");
    expect(mocks.requireOnboardingComplete).toHaveBeenCalledWith(
      mocks.prisma,
      "user-1",
    );
  });

  it("calls requireOnboardingComplete when session user onboarded flag is undefined", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1" },
    });
    const result = await OnboardedLayout({ children: "content" });
    expect(result).toBe("content");
    expect(mocks.requireOnboardingComplete).toHaveBeenCalledWith(
      mocks.prisma,
      "user-1",
    );
  });
});
