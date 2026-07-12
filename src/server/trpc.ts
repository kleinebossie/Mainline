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

type AuthorizedUser = {
  deletedAt: Date | null;
  betaAccessGrantedAt: Date | null;
} | null;

// A batched tRPC request runs each procedure's middleware independently while
// sharing one context object. Keep the authorization read request-scoped so a
// page with several parallel queries does not repeat the same database lookup.
const authorizationByContext = new WeakMap<object, Promise<AuthorizedUser>>();

function authorizedUser(ctx: TRPCContext): Promise<AuthorizedUser> {
  const existing = authorizationByContext.get(ctx);
  if (existing) return existing;

  const userId = ctx.session?.user?.id;
  const pending = userId
    ? ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { deletedAt: true, betaAccessGrantedAt: true },
      })
    : Promise.resolve(null);
  authorizationByContext.set(ctx, pending);
  return pending;
}

/** Requires an authenticated session; narrows `ctx.userId` for downstream procedures. */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const userId = ctx.session?.user?.id;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const user = await authorizedUser(ctx);
  if (!user || user.deletedAt || !user.betaAccessGrantedAt) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId } });
});
