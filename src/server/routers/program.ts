// Program API (BUILD.md M6 · §7.1). `getToday` returns the active generated session (or
// null), `generate` (re)generates it from current state and returns the fresh session. All
// graded logic is in the pure generator + provider; this router only orchestrates (L1).

import { generateAndSaveProgram, getTodayProgram } from "@/server/program";
import { protectedProcedure, router } from "@/server/trpc";

export const programRouter = router({
  getToday: protectedProcedure.query(({ ctx }) =>
    getTodayProgram(ctx.prisma, ctx.userId),
  ),

  generate: protectedProcedure.mutation(async ({ ctx }) => {
    await generateAndSaveProgram(ctx.prisma, ctx.userId);
    return getTodayProgram(ctx.prisma, ctx.userId);
  }),
});
