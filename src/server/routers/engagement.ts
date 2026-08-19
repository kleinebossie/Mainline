// Engagement API (BUILD.md §9, M9). The dashboard reads the consistency grid + capped streak
// + recent recognition, dismisses nudges, and sets (capped) reminders. All graded logic lives
// in the pure provider/engine; this router only orchestrates (L1).

import { z } from "zod";

import {
  getEngagementSummary,
  saveNotificationPref,
} from "@/server/engagement";
import { markRewardEventsSeen } from "@/db/engagement";
import { publicProcedure, protectedProcedure, router } from "@/server/trpc";
import { notificationPrefInputSchema } from "@/lib/engagement";

export const engagementRouter = router({
  summary: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (userId) {
      return getEngagementSummary(ctx.prisma, userId);
    }
    return {
      streak: { activeDayCount: 0, day: 0, cap: 28, windowDays: 28 },
      grid: [],
      latestUnseenRecovery: null,
    };
  }),

  markSeen: publicProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (userId) {
        return markRewardEventsSeen(ctx.prisma, userId, input.ids);
      }
      return { count: 0 };
    }),

  saveNotificationPref: protectedProcedure
    .input(notificationPrefInputSchema)
    .mutation(({ ctx, input }) =>
      saveNotificationPref(ctx.prisma, ctx.userId, input),
    ),
});
