import { z } from "zod";

import {
  applyCalibrationResponse,
  applyGuestCalibrationResponse,
  getCalibrationState,
  getGuestCalibrationState,
} from "@/server/assessment";
import { publicProcedure, router } from "@/server/trpc";

const guestResponseSchema = z.object({
  track: z.string().optional(),
  ratingShown: z.number().int(),
  correct: z.boolean(),
  puzzleId: z.string().optional(),
});

export const assessmentRouter = router({
  state: publicProcedure
    .input(
      z
        .object({
          guestResponses: z.array(guestResponseSchema).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (userId) {
        return getCalibrationState(ctx.prisma, userId);
      }
      return getGuestCalibrationState(ctx.prisma, input?.guestResponses ?? []);
    }),

  submit: publicProcedure
    .input(
      z.object({
        ratingShown: z.number().int(),
        correct: z.boolean(),
        puzzleId: z.string().optional(),
        guestResponses: z.array(guestResponseSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (userId) {
        return applyCalibrationResponse(ctx.prisma, userId, input, new Date());
      }
      return applyGuestCalibrationResponse(ctx.prisma, input);
    }),

  reset: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (userId) {
      await ctx.prisma.assessment.deleteMany({ where: { userId } });
      return getCalibrationState(ctx.prisma, userId);
    }
    return getGuestCalibrationState(ctx.prisma, []);
  }),
});
