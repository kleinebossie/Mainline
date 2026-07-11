import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");
const INVITE_CASCADE_MIGRATION = readFileSync(
  "prisma/migrations/20260711020000_m15_invite_claim_cascade/migration.sql",
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
});
