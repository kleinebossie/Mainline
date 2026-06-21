// Seed the ResourceRef catalog (BUILD.md M3 · §5.3). Idempotent: each entry has a
// deterministic id (lichess_theme_<theme>) so re-running upserts instead of
// duplicating. Seeds one resolvable Lichess training-page ResourceRef per trainable
// puzzle theme. Needs DATABASE_URL in .env.local.
//
// Usage:  npm run seed:resources

import { config as loadEnv } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

import { buildResourceCatalog } from "@/integrations/catalog";
import { LICHESS_PUZZLE_THEMES } from "@/integrations/puzzles/themes";

loadEnv({ path: ".env.local" });
loadEnv();

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const catalog = buildResourceCatalog(LICHESS_PUZZLE_THEMES);
  console.log(
    `Seeding ${catalog.length} ResourceRefs (idempotent upsert by id)…`,
  );
  try {
    for (const r of catalog) {
      const metadata = r.metadata as Prisma.InputJsonValue;
      const fields = {
        type: r.type,
        title: r.title,
        externalUrl: r.externalUrl,
        provider: r.provider,
        metadata,
        methodologyKey: r.methodologyKey,
      };
      await prisma.resourceRef.upsert({
        where: { id: r.id },
        create: { id: r.id, ...fields },
        update: fields,
      });
    }
    const count = await prisma.resourceRef.count();
    console.log(`Done. ResourceRef rows now: ${count}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
