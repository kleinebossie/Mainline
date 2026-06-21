// Analysis API (BUILD.md M5 · §6.5). The chess engine runs CLIENT-SIDE; the server only
// hands out the work queue and persists what the browser computes (zero server compute,
// §12). RAW features only (L1): `save` validates the payload against rawGameFeaturesSchema,
// whose `.strict()` shape REJECTS any interpreted/graded field before it can be stored —
// interpretation is Seam 3 (M6). This router orchestrates; it decides nothing graded.

import { z } from "zod";

import {
  analysisCounts,
  gamesNeedingAnalysis,
  saveAnalysisResult,
  userOwnsGame,
} from "@/db/analysis";
import { rawGameFeaturesSchema } from "@/lib/raw-features";
import { loadMethodology } from "@/methodology";
import { protectedProcedure, router } from "@/server/trpc";

export const analysisRouter = router({
  // The instant-eval work queue: the most-recent unanalysed games, capped at the Seam-2
  // instant-eval budget (config, M4's deferred `instantEvalGames`). The rest is backfill.
  pending: protectedProcedure.query(async ({ ctx }) => {
    const cfg = loadMethodology();
    const limit = cfg.assessment.instantEvalGames.value;
    const games = await gamesNeedingAnalysis(ctx.prisma, ctx.userId, limit);
    return games.map((g) => ({
      id: g.id,
      pgn: g.pgn,
      color: g.color, // "w" | "b" | null — the user's side, for user-centric aggregates
      platform: g.platform,
      playedAt: g.playedAt,
      opening: g.opening,
      result: g.result,
    }));
  }),

  // Persist one game's raw features. The payload is fully validated (strict) and the game
  // is checked to belong to the caller before anything is written.
  save: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        engineVersion: z.string().min(1).max(64),
        depth: z.number().int().min(1).max(99),
        rawFeatures: rawGameFeaturesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const owns = await userOwnsGame(ctx.prisma, ctx.userId, input.gameId);
      if (!owns) return { saved: false as const };
      await saveAnalysisResult(ctx.prisma, input);
      return { saved: true as const };
    }),

  // Progress for the dashboard (how many games have raw features yet).
  summary: protectedProcedure.query(({ ctx }) =>
    analysisCounts(ctx.prisma, ctx.userId),
  ),
});
