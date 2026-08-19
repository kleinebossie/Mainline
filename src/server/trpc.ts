// tRPC initialisation (BUILD.md §3: tRPC + Zod, end-to-end typed). `protectedProcedure`
// is the auth gate used by every user-owned domain router. superjson preserves Date
// across the wire (needed for connectedAt/lastSyncedAt etc.).

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import type { TRPCContext } from "@/server/context";
import { ExpectedError, safeTRPCErrorMessage } from "@/server/errors";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const data = { ...shape.data };
    delete data.stack;
    return {
      ...shape,
      message: safeTRPCErrorMessage(error, shape.message),
      data,
    };
  },
});

export const router = t.router;

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

const mapExpectedErrors = t.middleware(async ({ next }) => {
  const result = await next();
  const expected = result.ok ? null : result.error.cause;
  if (expected instanceof ExpectedError) {
    throw new TRPCError({
      code: expected.code,
      message: expected.message,
      cause: expected.cause,
    });
  }
  return result;
});

/** Public procedure without authentication requirement. */
export const publicProcedure = t.procedure.use(mapExpectedErrors);

/** Requires an authenticated session; narrows `ctx.userId` for downstream procedures. */
export const protectedProcedure = t.procedure
  .use(mapExpectedErrors)
  .use(async ({ ctx, next }) => {
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
