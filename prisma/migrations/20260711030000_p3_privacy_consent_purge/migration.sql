ALTER TABLE "User"
  ADD COLUMN "deletionToken" TEXT,
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_deletionToken_key" ON "User"("deletionToken");

CREATE TABLE "ResearchConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "noticeVersion" TEXT NOT NULL,
  "scopes" TEXT[],
  "grantedAt" TIMESTAMP(3) NOT NULL,
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchConsent_userId_grantedAt_idx"
  ON "ResearchConsent"("userId", "grantedAt");
CREATE INDEX "ResearchConsent_userId_noticeVersion_withdrawnAt_idx"
  ON "ResearchConsent"("userId", "noticeVersion", "withdrawnAt");
CREATE UNIQUE INDEX "ResearchConsent_one_active_grant_per_user"
  ON "ResearchConsent"("userId") WHERE "withdrawnAt" IS NULL;
ALTER TABLE "ResearchConsent" ADD CONSTRAINT "ResearchConsent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccountPurgeLedger" (
  "token" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountPurgeLedger_pkey" PRIMARY KEY ("token")
);
