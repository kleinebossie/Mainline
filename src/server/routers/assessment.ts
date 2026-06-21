// Assessment API (BUILD.md M4 · Seam 2). The adaptive tactical calibration: `state`
// returns the next item + a live graded estimate, `submit` records one solve/miss
// outcome (behavioural only — never self-reported skill), `reset` lets the user retake.
// All graded logic is in the pure methodology fns; this router only orchestrates (L1).

import { z } from "zod";

import {
  applyCalibrationResponse,
  getCalibrationState,
} from "@/server/assessment";
import { protectedProcedure, router } from "@/server/trpc";

export const assessmentRouter = router({
  state: protectedProcedure.query(({ ctx }) =>
    getCalibrationState(ctx.prisma, ctx.userId),
  ),

  submit: protectedProcedure
    .input(z.object({ ratingShown: z.number().int(), correct: z.boolean() }))
    .mutation(({ ctx, input }) =>
      applyCalibrationResponse(ctx.prisma, ctx.userId, input),
    ),

  reset: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.assessment.deleteMany({ where: { userId: ctx.userId } });
    return getCalibrationState(ctx.prisma, ctx.userId);
  }),
});
