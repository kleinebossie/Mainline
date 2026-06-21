-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "rawFeatures" JSONB NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_gameId_key" ON "AnalysisResult"("gameId");

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "ImportedGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
