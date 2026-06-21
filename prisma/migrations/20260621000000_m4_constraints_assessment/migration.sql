-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "calibrationResponses" JSONB NOT NULL,
    "tacticalRatingEstimate" INTEGER,
    "uncertainty" INTEGER,
    "derivedSkillSeed" JSONB,
    "methodologyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstraintSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minutesPerDay" INTEGER NOT NULL,
    "daysPerWeek" INTEGER NOT NULL,
    "goals" JSONB NOT NULL,
    "ownedResources" TEXT[],
    "formatPrefs" JSONB NOT NULL,
    "ifThenPlan" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstraintSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_userId_key" ON "Assessment"("userId");

-- CreateIndex
CREATE INDEX "ConstraintSet_userId_isCurrent_idx" ON "ConstraintSet"("userId", "isCurrent");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstraintSet" ADD CONSTRAINT "ConstraintSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

