// Progress API. Returns one process-dashboard payload: consistency, completed work,
// review health, skill estimates, and rating uncertainty with methodology-graded copy.

import { getProgressSummary, getGuestProgressSummary } from "@/server/progress";
import { publicProcedure, router } from "@/server/trpc";

export const progressRouter = router({
  summary: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (userId) {
      return getProgressSummary(ctx.prisma, userId);
    }
    return getGuestProgressSummary();
  }),
});
