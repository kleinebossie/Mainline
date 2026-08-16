import { PrismaClient } from "@prisma/client";

// Prisma client singleton (BUILD.md §4: db/ holds the client + typed query helpers,
// NO business logic). Avoids exhausting connections during dev hot-reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const DEFAULT_CONNECTION_LIMIT = "5";

export function withBoundedConnectionPool(
  databaseUrl: string | undefined,
): string | undefined {
  if (!databaseUrl) return undefined;

  try {
    const url = new URL(databaseUrl);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", DEFAULT_CONNECTION_LIMIT);
    }
    return url.toString();
  } catch {
    // Let Prisma report malformed connection strings with its normal diagnostics.
    return databaseUrl;
  }
}

const datasourceUrl = withBoundedConnectionPool(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

globalForPrisma.prisma = prisma;
