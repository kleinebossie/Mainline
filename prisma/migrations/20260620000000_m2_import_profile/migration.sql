-- CreateTable
CREATE TABLE "ChessProfileSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "ratings" JSONB NOT NULL,
    "totalGames" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChessProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalGameId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "pgn" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "timeControl" TEXT,
    "color" TEXT,
    "result" TEXT,
    "userRatingAtGame" INTEGER,
    "opponentRating" INTEGER,
    "eco" TEXT,
    "opening" TEXT,
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChessProfileSnapshot_userId_platform_capturedAt_idx" ON "ChessProfileSnapshot"("userId", "platform", "capturedAt");

-- CreateIndex
CREATE INDEX "ImportedGame_userId_playedAt_idx" ON "ImportedGame"("userId", "playedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedGame_userId_dedupeKey_key" ON "ImportedGame"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_key_key" ON "JobRun"("key");

-- AddForeignKey
ALTER TABLE "ChessProfileSnapshot" ADD CONSTRAINT "ChessProfileSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedGame" ADD CONSTRAINT "ImportedGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

