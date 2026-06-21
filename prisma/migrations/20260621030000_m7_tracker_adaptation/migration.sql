-- M7 — Tracker + adaptation (BUILD.md §5.5, §5.6). Append-only ActivityEvent log, the
-- per-dimension SkillState, the FSRS ScheduleState, and the AdaptationLog. Generated
-- offline via `prisma migrate diff` (no DB needed), as in M3–M6.

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programItemId" TEXT,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "estimate" DOUBLE PRECISION NOT NULL,
    "uncertainty" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemRef" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "fsrsState" JSONB NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "lastGrade" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'redo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "trigger" TEXT NOT NULL,
    "inputsSnapshot" JSONB NOT NULL,
    "decisions" JSONB NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_userId_occurredAt_idx" ON "ActivityEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "SkillState_userId_idx" ON "SkillState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillState_userId_dimension_key" ON "SkillState"("userId", "dimension");

-- CreateIndex
CREATE INDEX "ScheduleState_userId_due_idx" ON "ScheduleState"("userId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleState_userId_itemType_itemRef_key" ON "ScheduleState"("userId", "itemType", "itemRef");

-- CreateIndex
CREATE INDEX "AdaptationLog_userId_runAt_idx" ON "AdaptationLog"("userId", "runAt");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_programItemId_fkey" FOREIGN KEY ("programItemId") REFERENCES "ProgramItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillState" ADD CONSTRAINT "SkillState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleState" ADD CONSTRAINT "ScheduleState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptationLog" ADD CONSTRAINT "AdaptationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
