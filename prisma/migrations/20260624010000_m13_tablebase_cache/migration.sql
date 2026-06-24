-- M13 — In-app endgame drills (BUILD.md §5.3, §6.6). Cached Lichess tablebase lookups
-- (TablebaseCache): endgame ground truth (WDL/DTZ + best move) is immutable for a given
-- FEN, so we fetch once and reuse forever — "respect the platform" (VISION §6, §12). `fen`
-- is the natural primary key; `result` holds the parsed tablebase payload. Global (not
-- user-owned). Generated offline to match `prisma migrate diff` output (no DB needed), as
-- in M3–M12.

-- CreateTable
CREATE TABLE "TablebaseCache" (
    "fen" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TablebaseCache_pkey" PRIMARY KEY ("fen")
);
