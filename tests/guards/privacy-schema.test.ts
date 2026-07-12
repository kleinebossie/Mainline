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
const P4_MIGRATION = readFileSync(
  "prisma/migrations/20260711040000_p4_decision_state_skill_history/migration.sql",
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
      "SkillStateSnapshot",
      "ScheduleState",
      "PracticeItem",
      "AdaptationLog",
      "RewardEvent",
      "NotificationPref",
      "AllowlistEntry",
      "ApiCallBudget",
      "ResearchConsent",
      "TrainingPreferenceState",
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
    // P4: the new SkillStateSnapshot + TrainingPreferenceState cascade on User delete.
    expect(P4_MIGRATION).toMatch(
      /"SkillStateSnapshot_userId_fkey"[\s\S]*ON DELETE CASCADE/,
    );
    expect(P4_MIGRATION).toMatch(
      /"TrainingPreferenceState_userId_fkey"[\s\S]*ON DELETE CASCADE/,
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

  it("P4: SkillStateSnapshot is append-only history (no updatedAt, only capturedAt + runAt)", () => {
    const block = SCHEMA.match(
      new RegExp(`model SkillStateSnapshot \\{[\\s\\S]*?\\n\\}`),
    )?.[0];
    expect(block, "SkillStateSnapshot block").toBeTruthy();
    expect(block).toMatch(/methodologyVersion\s+String/);
    expect(block).toMatch(/runAt\s+DateTime/);
    expect(block).toMatch(/capturedAt\s+DateTime/);
    // No `updatedAt @updatedAt` — that would let an adaptation run rewrite a prior snapshot.
    expect(block).not.toMatch(/updatedAt\s+DateTime\s+@updatedAt/);
    // No unique constraint — every run may append a new row per dimension.
    expect(block).not.toMatch(/@@unique/);
  });

  it("P4: TrainingPreferenceState is one-row-per-user, cascade-on-delete, never a skill claim", () => {
    const block = SCHEMA.match(
      new RegExp(`model TrainingPreferenceState \\{[\\s\\S]*?\\n\\}`),
    )?.[0];
    expect(block, "TrainingPreferenceState block").toBeTruthy();
    // One-row-per-user: enforce via the unique constraint on userId.
    expect(block).toMatch(/userId\s+String\s+@unique/);
    // Cascade-on-delete so hard-deletion removes training-preference state.
    expect(block).toMatch(
      /user User @relation\([^\n]*onDelete:\s*Cascade\)/,
    );
    // The relation block above ("cascades every direct user relation") already covered
    // the cascade assertion separately; this test fixes the model in one place.
  });
});
