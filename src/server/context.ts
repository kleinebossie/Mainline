// tRPC request context (BUILD.md §4: server/ is the typed API surface). Resolves
// the Auth.js session and hands the Prisma client to procedures. No business logic.

import { auth } from "@/server/auth";
import { prisma } from "@/db/client";

export async function createTRPCContext() {
  const session = await auth();
  return { session, prisma };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
