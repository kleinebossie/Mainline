import { beforeEach, describe, expect, it, vi } from "vitest";

const research = vi.hoisted(() => {
  class ResearchExportConfigurationError extends Error {}
  return {
    ResearchExportConfigurationError,
    MAX_RESEARCH_EXPORT_RECORDS: 1_000,
    exportControlledObservationalResearch: vi.fn(),
  };
});

vi.mock("@/server/research", () => research);

import { researchRouter } from "@/server/routers/research";

function caller(role: string) {
  return researchRouter.createCaller({
    session: { user: { id: "u1" }, expires: "2099-01-01" },
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          deletedAt: null,
          betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
          role,
        }),
      },
    },
  } as never);
}

const input = {
  from: new Date("2026-07-01T00:00:00Z"),
  to: new Date("2026-08-01T00:00:00Z"),
  maxRecords: 100,
};

describe("research router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEARCH_EXPORT_SECRET = "0123456789abcdef0123456789abcdef";
  });

  it("denies non-admin users", async () => {
    await expect(caller("user").controlledExport(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      research.exportControlledObservationalResearch,
    ).not.toHaveBeenCalled();
  });

  it("allows an admin and passes the configured secret", async () => {
    research.exportControlledObservationalResearch.mockResolvedValue({
      format: "mainline-controlled-research/v1",
      rows: [],
    });
    await expect(
      caller("admin").controlledExport(input),
    ).resolves.toMatchObject({
      format: "mainline-controlled-research/v1",
    });
    expect(research.exportControlledObservationalResearch).toHaveBeenCalledWith(
      expect.anything(),
      { ...input, secret: process.env.RESEARCH_EXPORT_SECRET },
    );
  });
});
