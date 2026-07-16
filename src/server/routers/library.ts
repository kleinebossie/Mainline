// Library API (BUILD.md M14 · §4.2–4.4). `get` returns the band-appropriate book
// recommendations, the book-study protocol, and the 2D/3D modality + OTB guidance (gated by
// the user's play medium); `logSession` records an external book-study session — feeding the
// SAME adaptation loop as every in-app outcome (logOutcome) and returning the 85%-rule nudge.
// All graded logic is in the pure provider + library assembler; this router only orchestrates (L1).

import { z } from "zod";

import { getLibrary } from "@/server/library";
import { logOutcome } from "@/server/tracker";
import { resolveLibraryRating } from "@/server/profile";
import { getCurrentConstraints, getTargetFocus } from "@/server/constraints";
import {
  bookDifficultyFeedback,
  loadMethodology,
  rationaleFor,
} from "@/methodology";
import { bookPositionSchema } from "@/lib/tracker";
import { protectedProcedure, router } from "@/server/trpc";

export const libraryRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const cfg = loadMethodology();
    const rating = await resolveLibraryRating(ctx.prisma, ctx.userId, cfg);
    const targetFocus = await getTargetFocus(ctx.prisma, ctx.userId);
    const constraints = await getCurrentConstraints(ctx.prisma, ctx.userId);
    // Owned books/courses (by externalRef or label) let recommendBooks flag what the user has.
    const ownedRefs =
      constraints?.ownedResources.flatMap((r) =>
        r.externalRef ? [r.externalRef, r.label] : [r.label],
      ) ?? [];
    return getLibrary(ctx.prisma, ctx.userId, rating, targetFocus, ownedRefs);
  }),

  // Log one external book-study session. The self-reported success rate is used ONLY for the
  // 85% difficulty nudge — never skill (Seam 2). Outcomes feed the unchanged adaptation loop.
  logSession: protectedProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        programItemId: z.string().min(1).optional(),
        resourceRefId: z.string().min(1).max(200),
        durationMin: z.number().nonnegative().max(600).optional(),
        position: bookPositionSchema.extend({
          unitCount: z.number().int().positive().max(10_000),
        }),
        successRate: z.number().min(0).max(1).optional(),
        woodpeckerCycle: z.number().int().min(1).max(99).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const selfReport =
        input.successRate != null || input.woodpeckerCycle != null
          ? {
              successRate: input.successRate,
              woodpeckerCycle: input.woodpeckerCycle,
            }
          : undefined;
      const result = await logOutcome(ctx.prisma, ctx.userId, {
        requestId: input.requestId,
        programItemId: input.programItemId,
        type: "book_session",
        resourceRefId: input.resourceRefId,
        durationMin: input.durationMin,
        position: input.position,
        selfReport,
      });
      // The 85%-rule calibration nudge for the reported success rate (Seam 4 §4.2), shown now.
      const cfg = loadMethodology();
      const feedback =
        input.successRate != null
          ? bookDifficultyFeedback({ successRate: input.successRate }, cfg)
          : null;
      const copy = rationaleFor(cfg.bookStudy.calibrationRationaleKey, cfg);
      const citationSource =
        cfg.evidenceLedger.find((entry) => entry.key === copy.citationKey)
          ?.source ?? null;
      return {
        ...result,
        feedback,
        feedbackCopy: feedback
          ? {
              text: copy.value,
              grade: copy.grade,
              tier: copy.tier,
              citationKey: copy.citationKey,
              citationSource,
              soften: copy.soften,
              flag: copy.flag,
            }
          : null,
      };
    }),
});
