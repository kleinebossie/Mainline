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
import { protectedProcedure, router } from "@/server/trpc";
import {
  completeProgramItemInputSchema,
  logOutcomeInputSchema,
} from "@/lib/tracker";

export const trackerRouter = router({
  logOutcome: protectedProcedure
    .input(logOutcomeInputSchema)
    .mutation(({ ctx, input }) => logOutcome(ctx.prisma, ctx.userId, input)),

  completeProgramItem: protectedProcedure
    .input(completeProgramItemInputSchema)
    .mutation(({ ctx, input }) =>
      completeProgramItem(ctx.prisma, ctx.userId, input),
    ),

  undoSkip: protectedProcedure
    .input(logOutcomeInputSchema.pick({ programItemId: true }).required())
    .mutation(({ ctx, input }) =>
      undoSkip(ctx.prisma, ctx.userId, input.programItemId),
    ),

  dueReviews: protectedProcedure.query(({ ctx }) =>
    countDueScheduleStates(ctx.prisma, ctx.userId, new Date()),
  ),

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
