// Tracker API (BUILD.md M7 · §7.3, §7.4). `logOutcome` appends one immutable outcome and
// runs the adaptation loop (the loop closes); `dueReviews` reports how many spaced reviews
// are due now (for a UI nudge). All graded logic is in the pure adaptation core + provider;
// this router only orchestrates (L1).

import { logOutcome } from "@/server/tracker";
import { countDueScheduleStates } from "@/db/tracker";
import { protectedProcedure, router } from "@/server/trpc";
import { logOutcomeInputSchema } from "@/lib/tracker";

export const trackerRouter = router({
  logOutcome: protectedProcedure
    .input(logOutcomeInputSchema)
    .mutation(({ ctx, input }) => logOutcome(ctx.prisma, ctx.userId, input)),

  dueReviews: protectedProcedure.query(({ ctx }) =>
    countDueScheduleStates(ctx.prisma, ctx.userId, new Date()),
  ),
});
