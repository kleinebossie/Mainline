// Tracker API (BUILD.md M7 · §7.3, §7.4). `logOutcome` appends one immutable outcome and
// runs the adaptation loop (the loop closes); `dueReviews` reports how many spaced reviews
// are due now (for a UI nudge). All graded logic is in the pure adaptation core + provider;
// this router only orchestrates (L1).

import { completeProgramItem, logOutcome, undoSkip } from "@/server/tracker";
import {
  countDueScheduleStates,
  findDueScheduleStates,
  findSkillStates,
} from "@/db/tracker";
import { protectedProcedure, publicProcedure, router } from "@/server/trpc";
import {
  completeProgramItemInputSchema,
  logOutcomeInputSchema,
} from "@/lib/tracker";

export const trackerRouter = router({
  logOutcome: publicProcedure
    .input(logOutcomeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return {
          scheduledReviews: 0,
          rewardEvents: [],
        };
      }
      return logOutcome(ctx.prisma, userId, input);
    }),

  completeProgramItem: publicProcedure
    .input(completeProgramItemInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return { ok: true as const };
      }
      return completeProgramItem(ctx.prisma, userId, input);
    }),

  undoSkip: publicProcedure
    .input(logOutcomeInputSchema.pick({ programItemId: true }).required())
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return { ok: true as const };
      }
      return undoSkip(ctx.prisma, userId, input.programItemId);
    }),

  dueReviews: publicProcedure.query(({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) return 0;
    return countDueScheduleStates(ctx.prisma, userId, new Date());
  }),

  skillStates: protectedProcedure.query(({ ctx }) =>
    findSkillStates(ctx.prisma, ctx.userId),
  ),

  dueScheduleStates: protectedProcedure.query(({ ctx }) =>
    findDueScheduleStates(ctx.prisma, ctx.userId, new Date()),
  ),

  adaptationLogs: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.adaptationLog.findMany({
      where: { userId: ctx.userId },
      orderBy: { runAt: "desc" },
      take: 10,
    }),
  ),
});
