// Constraints API (BUILD.md M4 · §5.4). `getCurrent` returns the user's current
// ConstraintSet (or null); `save` validates and supersedes it (version bump). Input is
// validated by the shared lib/constraints Zod schema — the same schema the form uses.

import { constraintsInputSchema } from "@/lib/constraints";
import { getCurrentConstraints, saveConstraints } from "@/server/constraints";
import { expectedError } from "@/server/errors";
import { publicProcedure, router } from "@/server/trpc";

export const constraintsRouter = router({
  getCurrent: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) return null;
    return getCurrentConstraints(ctx.prisma, userId);
  }),

  save: publicProcedure
    .input(constraintsInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.formatPrefs.formats.length === 0) {
        throw expectedError.badRequest(
          "Select at least one format you play: bullet, blitz, rapid, or classical.",
        );
      }
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return {
          id: `guest_constraints_${Date.now()}`,
          userId: "guest",
          version: 1,
          createdAt: new Date(),
          isCurrent: true,
          ...input,
        };
      }
      return saveConstraints(ctx.prisma, userId, input);
    }),
});
