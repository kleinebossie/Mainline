// Progress API. Returns one process-dashboard payload: consistency, completed work,
// review health, skill estimates, and rating uncertainty with methodology-graded copy.

import { getProgressSummary } from "@/server/progress";
import { protectedProcedure, router } from "@/server/trpc";

export const progressRouter = router({
  summary: protectedProcedure.query(({ ctx }) =>
    getProgressSummary(ctx.prisma, ctx.userId),
  ),
});
