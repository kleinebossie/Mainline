// Account API (VISION §7 — data export & erase). `exportData` returns the user's own data
// for a client-side JSON download; `deleteAccount` soft-deletes (the client then signs out).

import { z } from "zod";

import {
  consentStatus,
  exportUserData,
  grantResearchConsent,
  requestAccountDeletion,
  runAccountPurge,
  StaleDataUseNoticeError,
  withdrawResearchConsent,
} from "@/server/account";
import { expectedError } from "@/server/errors";
import { protectedProcedure, router } from "@/server/trpc";

export const accountRouter = router({
  exportData: protectedProcedure.query(({ ctx }) =>
    exportUserData(ctx.prisma, ctx.userId),
  ),

  researchConsent: protectedProcedure.query(({ ctx }) =>
    consentStatus(ctx.prisma, ctx.userId),
  ),

  grantResearchConsent: protectedProcedure
    .input(
      z.object({
        affirmOptional: z.literal(true),
        displayedNoticeVersion: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await grantResearchConsent(
          ctx.prisma,
          ctx.userId,
          input.displayedNoticeVersion,
          new Date(),
        );
      } catch (error) {
        if (error instanceof StaleDataUseNoticeError) {
          throw expectedError.conflict(
            "The data-use notice changed. Review the current notice and try again.",
            error,
          );
        }
        throw error;
      }
    }),

  withdrawResearchConsent: protectedProcedure.mutation(({ ctx }) =>
    withdrawResearchConsent(ctx.prisma, ctx.userId, new Date()),
  ),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const token = await requestAccountDeletion(ctx.prisma, ctx.userId);
    try {
      const result = await runAccountPurge(ctx.prisma, token);
      return {
        ok: true as const,
        state:
          result.state === "completed" || result.reason === "complete"
            ? ("erased" as const)
            : ("queued" as const),
      };
    } catch {
      return { ok: true as const, state: "queued" as const };
    }
  }),
});
