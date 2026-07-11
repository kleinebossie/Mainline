-- Closed-beta admission entries.
ALTER TABLE "User" ADD COLUMN "betaAccessGrantedAt" TIMESTAMP(3);

UPDATE "User"
SET "betaAccessGrantedAt" = CURRENT_TIMESTAMP
WHERE "deletedAt" IS NULL;

CREATE TABLE "AllowlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "inviteCode" TEXT,
    "usedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowlistEntry_target_check" CHECK ("email" IS NOT NULL OR "inviteCode" IS NOT NULL),
    CONSTRAINT "AllowlistEntry_pkey" PRIMARY KEY ("id")
);

-- Per-user external API request buckets.
CREATE TABLE "ApiCallBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCallBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AllowlistEntry_inviteCode_key" ON "AllowlistEntry"("inviteCode");
CREATE INDEX "AllowlistEntry_email_idx" ON "AllowlistEntry"("email");
CREATE INDEX "AllowlistEntry_usedByUserId_idx" ON "AllowlistEntry"("usedByUserId");
CREATE UNIQUE INDEX "ApiCallBudget_userId_platform_windowStart_key" ON "ApiCallBudget"("userId", "platform", "windowStart");
CREATE INDEX "ApiCallBudget_userId_windowStart_idx" ON "ApiCallBudget"("userId", "windowStart");

ALTER TABLE "AllowlistEntry" ADD CONSTRAINT "AllowlistEntry_usedByUserId_fkey"
    FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiCallBudget" ADD CONSTRAINT "ApiCallBudget_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
