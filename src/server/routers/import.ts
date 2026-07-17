// Import & dashboard API (BUILD.md M2). `sync` runs an on-demand import for the
// signed-in user; `recentGames` and `latestProfiles` feed the dashboard. The router
// only orchestrates — the import logic lives in server/import.ts, and no
// chess/learning decision is made here (L1).

import { runImportForUser } from "@/server/import";
import {
  ApiCallBudgetExceededError,
  API_BUDGET_WINDOW_MS,
  apiBudgetWindowStart,
  assertApiCallBudget,
} from "@/server/api-budget";
import { systemClock } from "@/lib/clock";
import {
  manualPgnImportInputSchema,
  manualPgnTextSchema,
} from "@/lib/manual-import";
import {
  importManualPgnBatchWithinQuota,
  ManualGameQuotaExceededError,
  ManualImportContentionError,
  previewManualPgn,
} from "@/server/manual-import";
import { captureOperationalEvent } from "@/server/observability";
import { expectedError } from "@/server/errors";
import { protectedProcedure, router } from "@/server/trpc";

export function manualImportJobKey(userId: string, now: Date): string {
  const windowStart = apiBudgetWindowStart(now, API_BUDGET_WINDOW_MS);
  return `manual:${userId}:${windowStart.toISOString()}`;
}

async function assertManualImportRequestBudget(
  db: Parameters<typeof assertApiCallBudget>[0],
  userId: string,
): Promise<void> {
  try {
    await assertApiCallBudget(
      db,
      userId,
      "manual",
      new Date(systemClock.now()),
    );
  } catch (error) {
    if (error instanceof ApiCallBudgetExceededError) {
      throw expectedError.tooManyRequests(
        "Manual PGN checks and imports are limited each hour. Wait, then try again.",
        error,
      );
    }
    throw error;
  }
}

export const importRouter = router({
  // Coalesce manual retries inside the external API budget window. Failed jobs reuse
  // the same ledger row, while the next window permits a fresh sync.
  sync: protectedProcedure.mutation(async ({ ctx }) => {
    const summary = await runImportForUser(
      ctx.prisma,
      ctx.userId,
      manualImportJobKey(ctx.userId, new Date(systemClock.now())),
    );
    return summary;
  }),

  manualPreview: protectedProcedure
    .input(manualPgnTextSchema)
    .mutation(async ({ ctx, input }) => {
      await assertManualImportRequestBudget(ctx.prisma, ctx.userId);
      return previewManualPgn(input);
    }),

  manualCreate: protectedProcedure
    .input(manualPgnImportInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertManualImportRequestBudget(ctx.prisma, ctx.userId);
      let result;
      try {
        result = await importManualPgnBatchWithinQuota(
          ctx.prisma,
          ctx.userId,
          input.pgnText,
          input.games,
        );
      } catch (error) {
        if (error instanceof ManualGameQuotaExceededError) {
          throw expectedError.tooManyRequests(
            `A manual game library can hold up to ${error.limit} games. Import a smaller batch if space remains.`,
            error,
          );
        }
        if (error instanceof ManualImportContentionError) {
          throw expectedError.tooManyRequests(
            "Another manual import is still finishing. Wait, then try again.",
            error,
          );
        }
        throw error;
      }
      captureOperationalEvent({
        operation: "import",
        status: result.ok ? "success" : "blocked",
        count: result.imported,
      });
      return result;
    }),

  recentGames: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.importedGame.findMany({
      where: { userId: ctx.userId },
      orderBy: [
        { playedAt: { sort: "desc", nulls: "last" } },
        { importedAt: "desc" },
      ],
      take: 50,
      select: {
        id: true,
        platform: true,
        playedAt: true,
        timeControl: true,
        color: true,
        result: true,
        userRatingAtGame: true,
        opponentRating: true,
        opening: true,
      },
    }),
  ),

  // Most recent snapshot per platform (the dashboard shows current ratings).
  latestProfiles: protectedProcedure.query(async ({ ctx }) => {
    const snaps = await ctx.prisma.chessProfileSnapshot.findMany({
      where: { userId: ctx.userId },
      orderBy: { capturedAt: "desc" },
      select: {
        platform: true,
        capturedAt: true,
        ratings: true,
        totalGames: true,
      },
    });
    const latest = new Map<string, (typeof snaps)[number]>();
    for (const s of snaps)
      if (!latest.has(s.platform)) latest.set(s.platform, s);
    return [...latest.values()];
  }),
});
