// Program API (BUILD.md M6 · §7.1). `getToday` returns the active generated session (or
// null), `generate` (re)generates it from current state and returns the fresh session. All
// graded logic is in the pure generator + provider; this router only orchestrates (L1).

import {
  generateAndSaveProgram,
  getGameSignals,
  getTodayProgram,
  resolveTacticalRating,
} from "@/server/program";
import { protectedProcedure, router } from "@/server/trpc";
import {
  loadMethodology,
  bandForRating,
  expectationForBand,
} from "@/methodology";

export const programRouter = router({
  getToday: protectedProcedure.query(({ ctx }) =>
    getTodayProgram(ctx.prisma, ctx.userId),
  ),

  gameSignals: protectedProcedure.query(({ ctx }) =>
    getGameSignals(ctx.prisma, ctx.userId),
  ),

  generate: protectedProcedure.mutation(async ({ ctx }) => {
    await generateAndSaveProgram(ctx.prisma, ctx.userId);
    return getTodayProgram(ctx.prisma, ctx.userId);
  }),

  bandExpectation: protectedProcedure.query(async ({ ctx }) => {
    const cfg = loadMethodology();
    const rating = await resolveTacticalRating(ctx.prisma, ctx.userId, cfg);
    const bandId = bandForRating(rating, cfg);
    return expectationForBand(bandId, cfg);
  }),
});
