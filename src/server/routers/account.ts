// Account API (VISION §7 — data export & erase). `exportData` returns the user's own data
// for a client-side JSON download; `deleteAccount` soft-deletes (the client then signs out).

import { exportUserData, softDeleteUser } from "@/server/account";
import { protectedProcedure, router } from "@/server/trpc";

export const accountRouter = router({
  exportData: protectedProcedure.query(({ ctx }) =>
    exportUserData(ctx.prisma, ctx.userId),
  ),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await softDeleteUser(ctx.prisma, ctx.userId, new Date());
    return { ok: true as const };
  }),
});
