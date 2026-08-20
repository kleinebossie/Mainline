import { loadMethodology } from "@/methodology";
import { EMPTY_TRAINING_PREFERENCES } from "@/lib/decision-input";
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
import { protectedProcedure, publicProcedure, router } from "@/server/trpc";

export const feedbackRouter = router({
  settings: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      const cfg = loadMethodology();
      return {
        state: {
          preferences: {
            ...EMPTY_TRAINING_PREFERENCES,
            ...(cfg.version ? { methodologyVersion: cfg.version } : {}),
          },
          preferredActivity: null,
          resetAt: null,
          updatedAt: 0,
        },
        activeProgramId: null,
        recentItems: [],
        activities: [
          ...new Set(cfg.activities.map((item) => item.activityType)),
        ]
          .sort()
          .map((activityType) => ({
            activityType,
            label:
              cfg.activities.find((item) => item.activityType === activityType)
                ?.label ?? activityType,
          })),
        frictionTags: (cfg.trainingFit?.frictionTags ?? []).map((tag) => ({
          value: tag.id,
          label: tag.label,
        })),
        boundary: {
          text: cfg.trainingFit?.boundaryExplanation.value ?? "",
          grade: cfg.trainingFit?.boundaryExplanation.grade ?? "B",
          tier: cfg.trainingFit?.boundaryExplanation.tier ?? 2,
          citationKey:
            cfg.trainingFit?.boundaryExplanation.citationKey ?? "de_groot_1965",
          soften:
            cfg.trainingFit?.boundaryExplanation.grade === "C" ||
            cfg.trainingFit?.boundaryExplanation.grade === "D",
        },
      };
    }
    return getFeedbackSettings(ctx.prisma, userId);
  }),
  claimPrompt: protectedProcedure.mutation(({ ctx }) =>
    claimTrainingFeedbackPrompt(ctx.prisma, ctx.userId),
  ),
  submitTraining: publicProcedure
    .input(trainingFeedbackInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return {
          id: `guest_training_fb_${Date.now()}`,
          userId: "guest",
          programId: input.programId ?? null,
          programItemId: input.programItemId ?? null,
          scope: input.scope,
          source: input.source,
          relevance: input.relevance,
          enjoyment: input.enjoyment,
          timeFit: input.timeFit,
          frictionTags: input.frictionTags,
          comment: input.comment ?? null,
          createdAt: new Date(),
        };
      }
      return submitTrainingFeedback(ctx.prisma, userId, input);
    }),
  submitProduct: publicProcedure
    .input(productFeedbackInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return {
          id: `guest_prod_fb_${Date.now()}`,
          userId: "guest",
          category: input.category,
          message: input.message,
          contactAllowed: input.contactAllowed,
          createdAt: new Date(),
        };
      }
      return submitProductFeedback(ctx.prisma, userId, input);
    }),
  setPositivePreference: publicProcedure
    .input(preferenceOverrideInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return { ok: true as const, activityType: input.activityType };
      }
      return setPositiveTrainingPreference(ctx.prisma, userId, input);
    }),
  resetPreferences: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      return { ok: true as const };
    }
    return resetTrainingPreferences(ctx.prisma, userId);
  }),
});
