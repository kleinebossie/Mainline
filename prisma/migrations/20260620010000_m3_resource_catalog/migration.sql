-- CreateTable
CREATE TABLE "LichessPuzzle" (
    "puzzleId" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "moves" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "ratingDeviation" INTEGER NOT NULL,
    "popularity" INTEGER NOT NULL,
    "nbPlays" INTEGER NOT NULL,
    "themes" TEXT[],
    "gameUrl" TEXT,
    "openingTags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LichessPuzzle_pkey" PRIMARY KEY ("puzzleId")
);

-- CreateTable
CREATE TABLE "ResourceRef" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "externalUrl" TEXT,
    "provider" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "methodologyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LichessPuzzle_rating_idx" ON "LichessPuzzle"("rating");

-- CreateIndex
CREATE INDEX "LichessPuzzle_themes_idx" ON "LichessPuzzle" USING GIN ("themes");

-- CreateIndex
CREATE INDEX "ResourceRef_type_idx" ON "ResourceRef"("type");
