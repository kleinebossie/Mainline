// Streaming, idempotent ingest of the Lichess open puzzle DB into LichessPuzzle
// (BUILD.md M3 · §6.4 · §12). The full CC0 DB (~millions of rows) exceeds the
// Supabase free 500 MB tier, so this keeps a rating-×-theme-stratified subset with
// full band coverage (see src/integrations/puzzles/stratify.ts). All knobs here are
// INFRASTRUCTURE budget numbers (storage ceiling, bucket width), overridable on the
// CLI — never chess/learning values (L1). Re-running is safe: createMany+skipDuplicates
// dedupes on the puzzleId primary key.
//
// Usage:
//   1. Download + decompress the DB:
//        curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
//        unzstd lichess_db_puzzle.csv.zst        # → lichess_db_puzzle.csv
//   2. Dry run (no DB writes, just parse + stratify counts):
//        npm run ingest:puzzles -- ./lichess_db_puzzle.csv --dry-run
//   3. Real ingest (needs DATABASE_URL in .env.local):
//        npm run ingest:puzzles -- ./lichess_db_puzzle.csv
//   Flags: --max-rows N --bucket-size N --cap N --min-popularity N --min-plays N

import { config as loadEnv } from "dotenv";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

import {
  type LichessPuzzleInput,
  parsePuzzleCsvLine,
} from "@/integrations/puzzles/parse";
import {
  DEFAULT_STRATIFY,
  StratifiedSampler,
  type StratifyOptions,
} from "@/integrations/puzzles/stratify";

loadEnv({ path: ".env.local" });
loadEnv();

function intArg(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  if (i >= 0) {
    const v = Number(process.argv[i + 1]);
    if (Number.isFinite(v)) return v;
  }
  return fallback;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvPath = args.find((a) => !a.startsWith("--"));
  if (!csvPath) {
    console.error(
      "Usage: npm run ingest:puzzles -- <path-to-lichess_db_puzzle.csv> [--dry-run] [--max-rows N] [--bucket-size N] [--cap N] [--min-popularity N] [--min-plays N]",
    );
    process.exitCode = 1;
    return;
  }

  const opts: StratifyOptions = {
    bucketSize: intArg("--bucket-size", DEFAULT_STRATIFY.bucketSize),
    capPerBucketTheme: intArg("--cap", DEFAULT_STRATIFY.capPerBucketTheme),
    maxRows: intArg("--max-rows", DEFAULT_STRATIFY.maxRows),
    minPopularity: intArg(
      "--min-popularity",
      DEFAULT_STRATIFY.minPopularity ?? 0,
    ),
    minNbPlays: intArg("--min-plays", 0),
  };

  console.log(
    `Ingesting ${csvPath}${dryRun ? "  (dry run — no DB writes)" : ""}`,
  );
  console.log(`Options: ${JSON.stringify(opts)}`);

  const prisma = dryRun ? null : new PrismaClient();
  const sampler = new StratifiedSampler(opts);
  const BATCH = 1000;
  let batch: LichessPuzzleInput[] = [];
  let read = 0;
  let kept = 0;
  let written = 0;

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    if (prisma) {
      const res = await prisma.lichessPuzzle.createMany({
        data: batch,
        skipDuplicates: true,
      });
      written += res.count;
    }
    batch = [];
  };

  const rl = createInterface({
    input: createReadStream(csvPath, "utf8"),
    crlfDelay: Infinity,
  });
  try {
    for await (const line of rl) {
      const puzzle = parsePuzzleCsvLine(line);
      if (!puzzle) continue;
      read += 1;
      if (read % 250_000 === 0) console.log(`  …read ${read}, kept ${kept}`);
      if (sampler.consider(puzzle)) {
        kept += 1;
        batch.push(puzzle);
        if (batch.length >= BATCH) await flush();
      }
      if (sampler.kept >= opts.maxRows) break;
    }
    await flush();
  } finally {
    rl.close();
    if (prisma) await prisma.$disconnect();
  }

  console.log(
    `Done. Parsed ${read} valid rows; kept ${kept} (stratified)${
      dryRun ? "." : `; wrote ${written} new (existing skipped — idempotent).`
    }`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
