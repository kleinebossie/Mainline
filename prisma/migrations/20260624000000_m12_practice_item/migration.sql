-- M12 — Interactive game review & personalised blunder drills (BUILD.md §5.3). The in-app
-- practice position (PracticeItem): a generated/curated FEN + its known solution line, spaced
-- via ScheduleState (itemType "blunder_drill"). `userId` is nullable (null = shared/curated),
-- so the (userId, sourceRef) unique index makes re-deriving the same blunder idempotent.
-- Generated offline to match `prisma migrate diff` output (no DB needed), as in M3–M9.

-- CreateTable
CREATE TABLE "PracticeItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "solutionLine" TEXT[],
    "sourceRef" TEXT,
    "methodologyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeItem_userId_kind_idx" ON "PracticeItem"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeItem_userId_sourceRef_key" ON "PracticeItem"("userId", "sourceRef");

-- AddForeignKey
ALTER TABLE "PracticeItem" ADD CONSTRAINT "PracticeItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
