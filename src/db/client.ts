import { PrismaClient } from "@prisma/client";

// Prisma client singleton (BUILD.md §4: db/ holds the client + typed query helpers,
// NO business logic). Avoids exhausting connections during dev hot-reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
