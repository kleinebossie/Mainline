import {
  preferenceOverrideInputSchema,
  productFeedbackInputSchema,
  trainingFeedbackInputSchema,
} from "@/lib/feedback";
import {
  claimTrainingFeedbackPrompt,
  getFeedbackSettings,
  resetTrainingPreferences,
  setPositiveTrainingPreference,
  submitProductFeedback,
  submitTrainingFeedback,
} from "@/server/feedback";
import { protectedProcedure, router } from "@/server/trpc";

export const feedbackRouter = router({
  settings: protectedProcedure.query(({ ctx }) =>
    getFeedbackSettings(ctx.prisma, ctx.userId),
  ),
  claimPrompt: protectedProcedure.mutation(({ ctx }) =>
    claimTrainingFeedbackPrompt(ctx.prisma, ctx.userId),
  ),
  submitTraining: protectedProcedure
    .input(trainingFeedbackInputSchema)
    .mutation(({ ctx, input }) =>
      submitTrainingFeedback(ctx.prisma, ctx.userId, input),
    ),
  submitProduct: protectedProcedure
    .input(productFeedbackInputSchema)
    .mutation(({ ctx, input }) =>
      submitProductFeedback(ctx.prisma, ctx.userId, input),
    ),
  setPositivePreference: protectedProcedure
    .input(preferenceOverrideInputSchema)
    .mutation(({ ctx, input }) =>
      setPositiveTrainingPreference(ctx.prisma, ctx.userId, input),
    ),
  resetPreferences: protectedProcedure.mutation(({ ctx }) =>
    resetTrainingPreferences(ctx.prisma, ctx.userId),
  ),
});
