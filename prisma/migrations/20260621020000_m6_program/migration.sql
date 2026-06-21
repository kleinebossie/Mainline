-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "generationInput" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramItem" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "resourceRefId" TEXT,
    "params" JSONB NOT NULL,
    "dimensionsTargeted" TEXT[],
    "rationaleKey" TEXT NOT NULL,
    "rationaleText" TEXT NOT NULL,
    "evidenceGrade" TEXT NOT NULL,
    "evidenceTier" INTEGER NOT NULL,
    "citationKey" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "soften" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Program_userId_status_idx" ON "Program"("userId", "status");

-- CreateIndex
CREATE INDEX "ProgramItem_programId_date_orderIndex_idx" ON "ProgramItem"("programId", "date", "orderIndex");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramItem" ADD CONSTRAINT "ProgramItem_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramItem" ADD CONSTRAINT "ProgramItem_resourceRefId_fkey" FOREIGN KEY ("resourceRefId") REFERENCES "ResourceRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;
