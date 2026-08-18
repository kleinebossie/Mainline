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
import { protectedProcedure, publicProcedure, router } from "@/server/trpc";
import {
  guestMigrationInputSchema,
  migrateGuestSession,
} from "@/server/guest-migration";

export const accountRouter = router({
  exportData: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      return {
        exportedAt: new Date().toISOString(),
        guestMode: true,
        user: { id: "guest", role: "guest" },
        connections: [],
        constraintSets: [],
        programs: [],
        skillStates: [],
        activityEvents: [],
      };
    }
    return exportUserData(ctx.prisma, userId);
  }),

  researchConsent: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      return {
        isEligible: false,
        hasActiveGrant: false,
        notice: null,
      };
    }
    return consentStatus(ctx.prisma, userId);
  }),

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

  // Seamless guest session migration upon OAuth authentication (Sprint 1 §3.3).
  migrateGuestSession: publicProcedure
    .input(guestMigrationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return {
          migrated: false as const,
          itemsMigrated: 0,
          hasAssessment: false,
          hasConstraints: false,
        };
      }
      const result = await migrateGuestSession(ctx.prisma, userId, input);
      return {
        migrated: true as const,
        ...result,
      };
    }),

  markRevealSeen: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (userId) {
      await ctx.prisma.user.updateMany({
        where: { id: userId, setupRevealSeenAt: null },
        data: { setupRevealSeenAt: new Date() },
      });
    }
    return { ok: true as const };
  }),
});

