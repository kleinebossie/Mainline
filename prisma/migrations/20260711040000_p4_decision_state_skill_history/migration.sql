-- P4 — Decision-state and skill-history foundation (FEATURE_ROADMAP P4). Two new tables:
--   * SkillStateSnapshot — immutable append-only per-dimension skill history, written after
--     every adaptation pass. The latest state stays in the upserted SkillState row; the
--     snapshot is the longitudinal memory the generator assembler reads for genuine
--     personalisation. Cascade-delete with User (GDPR).
--   * TrainingPreferenceState — derived fit preferences only (never a skill estimate); a
--     single row per user. P4 ships the empty default and the reset surface; P8 feeds it
--     from TrainingFeedback. Cascade-delete with User (GDPR).
-- Generated via `prisma migrate diff --from-schema-datasource --to-schema-datamodel`.

-- CreateTable
CREATE TABLE "SkillStateSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "estimate" DOUBLE PRECISION NOT NULL,
    "uncertainty" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillStateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPreferenceState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferences" JSONB NOT NULL,
    "userOverride" JSONB,
    "resetAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingPreferenceState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillStateSnapshot_userId_dimension_runAt_idx" ON "SkillStateSnapshot"("userId", "dimension", "runAt");

-- CreateIndex
CREATE INDEX "SkillStateSnapshot_userId_runAt_idx" ON "SkillStateSnapshot"("userId", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPreferenceState_userId_key" ON "TrainingPreferenceState"("userId");

-- AddForeignKey
ALTER TABLE "SkillStateSnapshot" ADD CONSTRAINT "SkillStateSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPreferenceState" ADD CONSTRAINT "TrainingPreferenceState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;