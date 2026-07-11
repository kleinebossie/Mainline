ALTER TABLE "JobRun"
    ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "lockedUntil" TIMESTAMP(3),
    ADD COLUMN "errorCode" TEXT;

UPDATE "JobRun"
SET "status" = 'error',
    "finishedAt" = COALESCE("finishedAt", CURRENT_TIMESTAMP),
    "error" = 'Job failed. Retry is safe.',
    "errorCode" = 'legacy_stale'
WHERE "status" = 'running';

UPDATE "JobRun"
SET "error" = 'Job failed. Retry is safe.',
    "errorCode" = COALESCE("errorCode", 'legacy_error')
WHERE "status" = 'error';

CREATE INDEX "JobRun_status_startedAt_idx" ON "JobRun"("status", "startedAt");
CREATE INDEX "JobRun_kind_status_idx" ON "JobRun"("kind", "status");
