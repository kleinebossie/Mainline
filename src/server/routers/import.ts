// Import & dashboard API (BUILD.md M2). `sync` runs an on-demand import for the
// signed-in user; `recentGames` and `latestProfiles` feed the dashboard. The router
// only orchestrates — the import logic lives in server/import.ts, and no
// chess/learning decision is made here (L1).

import { runImportForUser } from "@/server/import";
import {
  API_BUDGET_WINDOW_MS,
  apiBudgetWindowStart,
} from "@/server/api-budget";
import { systemClock } from "@/lib/clock";
import { protectedProcedure, router } from "@/server/trpc";

export function manualImportJobKey(userId: string, now: Date): string {
  const windowStart = apiBudgetWindowStart(now, API_BUDGET_WINDOW_MS);
  return `manual:${userId}:${windowStart.toISOString()}`;
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

  recentGames: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.importedGame.findMany({
      where: { userId: ctx.userId },
      orderBy: { playedAt: "desc" },
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
