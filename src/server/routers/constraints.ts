// Constraints API (BUILD.md M4 · §5.4). `getCurrent` returns the user's current
// ConstraintSet (or null); `save` validates and supersedes it (version bump). Input is
// validated by the shared lib/constraints Zod schema — the same schema the form uses.

import { constraintsInputSchema } from "@/lib/constraints";
import { getCurrentConstraints, saveConstraints } from "@/server/constraints";
import { protectedProcedure, router } from "@/server/trpc";

export const constraintsRouter = router({
  getCurrent: protectedProcedure.query(({ ctx }) =>
    getCurrentConstraints(ctx.prisma, ctx.userId),
  ),

  save: protectedProcedure
    .input(constraintsInputSchema)
    .mutation(({ ctx, input }) =>
      saveConstraints(ctx.prisma, ctx.userId, input),
    ),
});
