import { z } from "zod";
import type { Prisma } from "@prisma/client";

import {
  analysisCounts,
  gamesNeedingAnalysis,
  gamesNeedingAnalysisInWindow,
  saveAnalysisResult,
  userOwnsGame,
} from "@/db/analysis";
import { rawGameFeaturesSchema } from "@/lib/raw-features";
import { fsrsStateSchema } from "@/lib/tracker";
import {
  loadMethodology,
  bandForRating,
  gameAnalysisProtocol,
  rationaleFor,
  gameSelectionRatioFor,
  gradeFromOutcome,
  scheduleReview,
} from "@/methodology";
import { resolvePlayingRating } from "@/server/program";
import { gameIdentity } from "@/server/game-identity";
import { systemClock } from "@/lib/clock";
import { protectedProcedure, router } from "@/server/trpc";
import { captureOperationalEvent } from "@/server/observability";

const PLATFORMS = ["lichess", "chesscom"] as const;

export const analysisRouter = router({
  // The default queue uses the methodology cap; callers may request a bounded window.
  pending: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).optional(),
          platform: z.enum(PLATFORMS).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const cfg = loadMethodology();
      const games =
        input?.limit != null
          ? await gamesNeedingAnalysisInWindow(
              ctx.prisma,
              ctx.userId,
              input.limit,
              input.platform,
            )
          : await gamesNeedingAnalysis(
              ctx.prisma,
              ctx.userId,
              cfg.assessment.instantEvalGames.value,
              input?.platform,
            );
      return games.map((g) => ({
        id: g.id,
        pgn: g.pgn,
        color: g.color,
        platform: g.platform,
        playedAt: g.playedAt,
        opening: g.opening,
        result: g.result,
      }));
    }),

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
      captureOperationalEvent({
        operation: "analysis_handoff",
        status: "success",
        count: 1,
      });
      return { saved: true as const };
    }),

  summary: protectedProcedure.query(({ ctx }) =>
    analysisCounts(ctx.prisma, ctx.userId),
  ),

  suggestions: protectedProcedure.query(async ({ ctx }) => {
    const cfg = loadMethodology();
    const playingRating = await resolvePlayingRating(
      ctx.prisma,
      ctx.userId,
      cfg,
    );
    const band = bandForRating(playingRating, cfg);

    return {
      ratio: gameSelectionRatioFor(band, cfg),
      ownGamesRationale: rationaleFor("analyse_own_games", cfg),
      successBiasRationale: rationaleFor("analysis_success_bias", cfg),
    };
  }),

  library: protectedProcedure.query(async ({ ctx }) => {
    const [user, games] = await Promise.all([
      ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { primaryPlatform: true },
      }),
      ctx.prisma.importedGame.findMany({
        where: { userId: ctx.userId },
        orderBy: { playedAt: "desc" },
        take: 60,
        select: {
          id: true,
          platform: true,
          playedAt: true,
          color: true,
          result: true,
          timeControl: true,
          opening: true,
          opponentRating: true,
          userRatingAtGame: true,
          pgn: true,
          analysis: { select: { id: true } },
        },
      }),
    ]);

    const platforms = [...new Set(games.map((g) => g.platform))];
    const primaryPlatform = user?.primaryPlatform ?? null;
    // Ignore a stale preference when it no longer has imported games.
    const effectivePlatform =
      primaryPlatform && platforms.includes(primaryPlatform)
        ? primaryPlatform
        : (games[0]?.platform ?? primaryPlatform ?? null);

    return {
      primaryPlatform,
      effectivePlatform,
      platforms,
      games: games.map((g) => {
        const id = gameIdentity(g.pgn, g.color);
        return {
          id: g.id,
          platform: g.platform,
          playedAt: g.playedAt,
          color: g.color,
          result: g.result,
          timeControl: g.timeControl,
          opening: g.opening,
          opponent: id.opponent ?? id.black ?? id.white ?? null,
          opponentRating: g.opponentRating,
          you: id.you ?? null,
          userRating: g.userRatingAtGame,
          analyzed: g.analysis !== null,
        };
      }),
    };
  }),

  setPrimaryPlatform: protectedProcedure
    .input(z.object({ platform: z.enum(PLATFORMS) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { primaryPlatform: input.platform },
      });
      return { primaryPlatform: input.platform };
    }),

  session: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const owns = await userOwnsGame(ctx.prisma, ctx.userId, input.gameId);
      if (!owns) throw new Error("Unauthorized");

      const game = await ctx.prisma.importedGame.findUnique({
        where: { id: input.gameId },
        include: { analysis: true },
      });
      if (!game) throw new Error("Game not found");

      const cfg = loadMethodology();
      // Use playing strength for the analysis band, never puzzle rating.
      const playingRating = await resolvePlayingRating(
        ctx.prisma,
        ctx.userId,
        cfg,
        game.userRatingAtGame,
      );
      const band = bandForRating(playingRating, cfg);

      const recentAllGames = await ctx.prisma.importedGame.findMany({
        where: { userId: ctx.userId },
        orderBy: { playedAt: "desc" },
        take: 20,
      });

      const recentResults = recentAllGames.map((g) => ({
        playedAt: g.playedAt,
        result: g.result,
      }));

      const storedFeatures = game.analysis
        ? rawGameFeaturesSchema.safeParse(game.analysis.rawFeatures)
        : null;
      const parsedGame = {
        id: game.id,
        pgn: game.pgn,
        playedAt: game.playedAt,
        result: game.result,
        color: game.color,
        userRatingAtGame: game.userRatingAtGame,
        rawFeatures: storedFeatures?.success ? storedFeatures.data : null,
      };

      const session = gameAnalysisProtocol(parsedGame, band, cfg, {
        recentResults,
        clock: systemClock,
      });

      return {
        session,
        game: {
          id: game.id,
          pgn: game.pgn,
          playedAt: game.playedAt,
          result: game.result,
          color: game.color,
          platform: game.platform,
          timeControl: game.timeControl,
          opening: game.opening,
          eco: game.eco,
          opponentRating: game.opponentRating,
          userRating: game.userRatingAtGame,
          ...gameIdentity(game.pgn, game.color),
        },
        rationales: {
          analysis_tilt_pause: rationaleFor("analysis_tilt_pause", cfg),
          analysis_engine_delay: rationaleFor("analysis_engine_delay", cfg),
          analysis_rpl_filter: rationaleFor("analysis_rpl_filter", cfg),
          analysis_guess_tolerance: rationaleFor(
            "analysis_guess_tolerance",
            cfg,
          ),
          analysis_srs_puzzle: rationaleFor("analysis_srs_puzzle", cfg),
        },
      };
    }),

  saveSession: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        reflectionNote: z.string(),
        outcomes: z.array(
          z.object({
            ply: z.number().int(),
            correct: z.boolean(),
            bestUci: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const owns = await userOwnsGame(ctx.prisma, ctx.userId, input.gameId);
      if (!owns) throw new Error("Unauthorized");

      const game = await ctx.prisma.importedGame.findUnique({
        where: { id: input.gameId },
        include: { analysis: true },
      });
      if (!game || !game.analysis) throw new Error("Game analysis not found");

      const rawFeatures = rawGameFeaturesSchema.parse(
        game.analysis.rawFeatures,
      );
      const cfg = loadMethodology();
      const now = systemClock.now();

      await ctx.prisma.activityEvent.create({
        data: {
          userId: ctx.userId,
          type: "game_analysed",
          occurredAt: new Date(now),
          payload: {
            gameId: input.gameId,
            reflectionNote: input.reflectionNote,
            outcomes: input.outcomes,
          } as unknown as Prisma.InputJsonValue,
          source: "user",
        },
      });

      let scheduledCount = 0;

      for (const outcome of input.outcomes) {
        const blunder = rawFeatures.blunders.find((b) => b.ply === outcome.ply);
        const fen = blunder?.fen;
        if (!fen || !outcome.bestUci) continue;

        const sourceRef = `blunder:${input.gameId}:${outcome.ply}`;
        const item = await ctx.prisma.practiceItem.upsert({
          where: {
            userId_sourceRef: {
              userId: ctx.userId,
              sourceRef,
            },
          },
          create: {
            userId: ctx.userId,
            kind: "blunder_drill",
            fen,
            solutionLine: [outcome.bestUci],
            sourceRef,
          },
          update: {
            fen,
            solutionLine: [outcome.bestUci],
          },
        });

        const itemType = "blunder_drill";
        const itemRef = item.id;

        const existing = await ctx.prisma.scheduleState.findUnique({
          where: {
            userId_itemType_itemRef: {
              userId: ctx.userId,
              itemType,
              itemRef,
            },
          },
        });

        const fsrsState = existing
          ? fsrsStateSchema.parse(existing.fsrsState)
          : null;
        const grade = gradeFromOutcome({ correct: outcome.correct }, cfg);

        const { newState } = scheduleReview({ grade, fsrsState, now }, cfg);

        await ctx.prisma.scheduleState.upsert({
          where: {
            userId_itemType_itemRef: {
              userId: ctx.userId,
              itemType,
              itemRef,
            },
          },
          create: {
            userId: ctx.userId,
            itemType,
            itemRef,
            fsrsState: newState as unknown as Prisma.InputJsonValue,
            due: new Date(newState.due),
            lastGrade: grade,
            source: "drill",
          },
          update: {
            fsrsState: newState as unknown as Prisma.InputJsonValue,
            due: new Date(newState.due),
            lastGrade: grade,
          },
        });

        scheduledCount++;
      }

      return { success: true, scheduledCount };
    }),

  // Ownership-scoped source for client-side analysis.
  gameSource: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const game = await ctx.prisma.importedGame.findFirst({
        where: { id: input.gameId, userId: ctx.userId },
        select: { id: true, pgn: true, color: true },
      });
      if (!game) throw new Error("Game not found");
      return game;
    }),
});
