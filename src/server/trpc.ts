// tRPC initialisation (BUILD.md §3: tRPC + Zod, end-to-end typed). `protectedProcedure`
// is the auth gate used by every user-owned domain router. superjson preserves Date
// across the wire (needed for connectedAt/lastSyncedAt etc.).

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import type { TRPCContext } from "@/server/context";

const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

/** Requires an authenticated session; narrows `ctx.userId` for downstream procedures. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  const userId = ctx.session?.user?.id;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId } });
});
