import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");
const INVITE_CASCADE_MIGRATION = readFileSync(
  "prisma/migrations/20260711020000_m15_invite_claim_cascade/migration.sql",
  "utf8",
);
const P3_MIGRATION = readFileSync(
  "prisma/migrations/20260711030000_p3_privacy_consent_purge/migration.sql",
  "utf8",
);

describe("privacy schema guards", () => {
  it("deletes claimed invitations with an erased account", () => {
    expect(SCHEMA).toMatch(
      /usedByUser\s+User\?\s+@relation\([^\n]*onDelete:\s*Cascade\)/,
    );
    expect(INVITE_CASCADE_MIGRATION).toContain(
      'DROP CONSTRAINT "AllowlistEntry_usedByUserId_fkey"',
    );
    expect(INVITE_CASCADE_MIGRATION).toMatch(
      /FOREIGN KEY \("usedByUserId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/,
    );
  });

  it("cascades every direct user relation, including consent and personal practice", () => {
    const relationBlocks = [
      "Account",
      "Session",
      "PlatformConnection",
      "ChessProfileSnapshot",
      "ImportedGame",
      "Assessment",
      "ConstraintSet",
      "Program",
      "ActivityEvent",
      "SkillState",
      "ScheduleState",
      "PracticeItem",
      "AdaptationLog",
      "RewardEvent",
      "NotificationPref",
      "AllowlistEntry",
      "ApiCallBudget",
      "ResearchConsent",
    ];
    for (const model of relationBlocks) {
      const block = SCHEMA.match(
        new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`),
      )?.[0];
      expect(block, model).toMatch(/@relation\([^\n]*onDelete:\s*Cascade\)/);
    }
    expect(P3_MIGRATION).toMatch(
      /ResearchConsent_userId_fkey[\s\S]*ON DELETE CASCADE/,
    );
  });

  it("keeps global catalogs and the opaque purge ledger outside User relations", () => {
    for (const model of [
      "LichessPuzzle",
      "ResourceRef",
      "TablebaseCache",
      "AccountPurgeLedger",
    ]) {
      const block = SCHEMA.match(
        new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`),
      )?.[0];
      expect(block, model).not.toMatch(/\buserId\b|\bUser\??\b/);
    }
  });

  it("cascades indirect analysis and program descendants", () => {
    for (const model of ["AnalysisResult", "ProgramItem"]) {
      const block = SCHEMA.match(
        new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`),
      )?.[0];
      expect(block, model).toMatch(/@relation\([^\n]*onDelete:\s*Cascade\)/);
    }
  });
});
