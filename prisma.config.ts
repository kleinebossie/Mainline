import path from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma's CLI — unlike Next.js — does NOT auto-load `.env.local`, so without this
// `prisma migrate`/`generate` report "Environment variable not found: DATABASE_URL".
// We load it explicitly. `.env.local` is the Next.js convention for local secrets;
// `.env` is an optional fallback. Both are gitignored (never commit secrets, VISION
// §7). Missing files are ignored by dotenv, so CI (which sets env directly) is fine.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
});
