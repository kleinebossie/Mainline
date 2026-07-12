// Constraints API (BUILD.md M4 · §5.4). `getCurrent` returns the user's current
// ConstraintSet (or null); `save` validates and supersedes it (version bump). Input is
// validated by the shared lib/constraints Zod schema — the same schema the form uses.

import { TRPCError } from "@trpc/server";

import { constraintsInputSchema } from "@/lib/constraints";
import { getCurrentConstraints, saveConstraints } from "@/server/constraints";
import { protectedProcedure, router } from "@/server/trpc";

export const constraintsRouter = router({
  getCurrent: protectedProcedure.query(({ ctx }) =>
    getCurrentConstraints(ctx.prisma, ctx.userId),
  ),

  save: protectedProcedure
    .input(constraintsInputSchema)
    .mutation(({ ctx, input }) => {
      // Require at least one playing format so the generator has a format signal.
      // Enforced here (BAD_REQUEST) so the client gets a clear message, and again
      // in saveConstraints as defense-in-depth.
      if (input.formatPrefs.formats.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Select at least one format you play (bullet, blitz, rapid, or classical).",
        });
      }
      return saveConstraints(ctx.prisma, ctx.userId, input);
    }),
});
