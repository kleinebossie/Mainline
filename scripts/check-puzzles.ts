// Smoke + latency check for theme+rating selection against the live DB (BUILD.md M3
// DoD: "theme+rating query < target latency"). Run after ingesting. Needs
// DATABASE_URL in .env.local.
//
// Usage:  npm run check:puzzles -- [theme] [ratingTarget]
//   e.g.  npm run check:puzzles -- fork 1500

import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

import { selectPuzzles } from "@/db/puzzles";

loadEnv({ path: ".env.local" });
loadEnv();

async function main(): Promise<void> {
  const theme = process.argv[2] ?? "fork";
  const ratingTarget = Number(process.argv[3] ?? 1500);
  const prisma = new PrismaClient();
  try {
    const t0 = performance.now();
    const puzzles = await selectPuzzles(prisma, {
      theme,
      ratingTarget,
      ratingWindow: 150,
      count: 10,
    });
    const ms = performance.now() - t0;
    console.log(
      `Selected ${puzzles.length} '${theme}' puzzles near ${ratingTarget} in ${ms.toFixed(1)} ms:`,
    );
    for (const p of puzzles) {
      console.log(
        `  ${p.puzzleId}  rating ${p.rating}  [${p.themes.join(" ")}]  https://lichess.org/training/${p.puzzleId}`,
      );
    }
    if (puzzles.length === 0) {
      console.log(
        "No puzzles found — has the ingest run for this theme/rating band?",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
