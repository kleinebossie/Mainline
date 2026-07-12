CREATE TABLE "WeeklyFocus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "focusAreas" TEXT[],
    "supportingSignals" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rationaleSnapshots" JSONB NOT NULL,
    "alternatives" JSONB NOT NULL,
    "selectedAlternative" TEXT,
    "revisionTrigger" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyFocus_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WeeklyFocus_userId_status_weekStart_idx" ON "WeeklyFocus"("userId", "status", "weekStart");
CREATE INDEX "WeeklyFocus_userId_createdAt_idx" ON "WeeklyFocus"("userId", "createdAt");
CREATE UNIQUE INDEX "WeeklyFocus_one_active_per_user_idx" ON "WeeklyFocus"("userId") WHERE "status" = 'active';
ALTER TABLE "WeeklyFocus" ADD CONSTRAINT "WeeklyFocus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
