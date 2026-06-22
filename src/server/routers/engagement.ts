// Engagement API (BUILD.md §9, M9). The dashboard reads the consistency grid + capped streak
// + recent recognition, dismisses nudges, and sets (capped) reminders. All graded logic lives
// in the pure provider/engine; this router only orchestrates (L1).

import { z } from "zod";

import {
  getEngagementSummary,
  saveNotificationPref,
} from "@/server/engagement";
import { markRewardEventsSeen } from "@/db/engagement";
import { protectedProcedure, router } from "@/server/trpc";
import { notificationPrefInputSchema } from "@/lib/engagement";

export const engagementRouter = router({
  summary: protectedProcedure.query(({ ctx }) =>
    getEngagementSummary(ctx.prisma, ctx.userId),
  ),

  markSeen: protectedProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).max(50) }))
    .mutation(({ ctx, input }) =>
      markRewardEventsSeen(ctx.prisma, ctx.userId, input.ids),
    ),

  saveNotificationPref: protectedProcedure
    .input(notificationPrefInputSchema)
    .mutation(({ ctx, input }) =>
      saveNotificationPref(ctx.prisma, ctx.userId, input),
    ),
});
