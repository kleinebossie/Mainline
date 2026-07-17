import { z } from "zod";
import { Prisma } from "@prisma/client";

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
import { resolvePlayingRating } from "@/server/profile";
import { gameIdentity } from "@/server/game-identity";
import { systemClock } from "@/lib/clock";
import { protectedProcedure, router } from "@/server/trpc";
import { captureOperationalEvent } from "@/server/observability";
import { expectedError } from "@/server/errors";

const PLATFORMS = ["lichess", "chesscom"] as const;
const ANALYSIS_SOURCES = ["lichess", "chesscom", "manual"] as const;
export const MAX_SESSION_OUTCOMES = 80;
const MAX_REFLECTION_NOTE_LENGTH = 4_000;

const libraryGameSelect = {
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
} as const;

const analysisOutcomeSchema = z
  .object({
    ply: z.number().int(),
    correct: z.boolean(),
    bestUci: z.string().min(1).max(16).optional(),
  })
  .strict();

const analysisOutcomesSchema = z
  .array(analysisOutcomeSchema)
  .max(MAX_SESSION_OUTCOMES)
  .superRefine((outcomes, ctx) => {
    const seen = new Set<number>();
    for (const [index, outcome] of outcomes.entries()) {
      if (seen.has(outcome.ply)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each reviewed ply may appear only once.",
          path: [index, "ply"],
        });
      }
      seen.add(outcome.ply);
    }
  });

export const analysisSessionInputSchema = z
  .object({
    gameId: z.string().min(1).max(191),
    requestId: z.string().uuid(),
    reflectionNote: z.string().max(MAX_REFLECTION_NOTE_LENGTH),
    outcomes: analysisOutcomesSchema,
  })
  .strict();

const savedAnalysisSessionPayloadSchema = z
  .object({
    gameId: z.string(),
    scheduledCount: z.number().int().nonnegative(),
  })
  .passthrough();

function repeatedSessionResult(payload: Prisma.JsonValue, gameId: string) {
  const saved = savedAnalysisSessionPayloadSchema.safeParse(payload);
  if (!saved.success || saved.data.gameId !== gameId) {
    throw expectedError.conflict(
      "This save request was already used. Reload the review and try again.",
    );
  }
  return {
    success: true as const,
    scheduledCount: saved.data.scheduledCount,
  };
}

export const analysisRouter = router({
  // The default queue uses the methodology cap; callers may request a bounded window.
  pending: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).optional(),
          platform: z.enum(ANALYSIS_SOURCES).optional(),
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
    const [user, platformGames, manualGames] = await Promise.all([
      ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { primaryPlatform: true },
      }),
      ctx.prisma.importedGame.findMany({
        where: { userId: ctx.userId, source: { not: "manual" } },
        orderBy: [
          { playedAt: { sort: "desc", nulls: "last" } },
          { importedAt: "desc" },
        ],
        take: 60,
        select: libraryGameSelect,
      }),
      ctx.prisma.importedGame.findMany({
        where: { userId: ctx.userId, source: "manual" },
        orderBy: { importedAt: "desc" },
        take: 60,
        select: libraryGameSelect,
      }),
    ]);

    const games = [...manualGames, ...platformGames];
    const platforms = [...new Set(games.map((g) => g.platform))];
    const primaryPlatform = user?.primaryPlatform ?? null;
    // Ignore a stale preference when it no longer has imported games.
    const effectivePlatform =
      primaryPlatform && platforms.includes(primaryPlatform)
        ? primaryPlatform
        : (platformGames[0]?.platform ??
          manualGames[0]?.platform ??
          primaryPlatform ??
          null);

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
          event: id.event ?? null,
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
      if (!owns) {
        throw expectedError.notFound(
          "That game is no longer in your library. Return to Analysis and choose another game.",
        );
      }

      const game = await ctx.prisma.importedGame.findUnique({
        where: { id: input.gameId },
        include: { analysis: true },
      });
      if (!game) {
        throw expectedError.notFound(
          "That game is no longer in your library. Return to Analysis and choose another game.",
        );
      }

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
        where: {
          userId: ctx.userId,
          source: { not: "manual" },
          playedAt: { not: null },
        },
        orderBy: { playedAt: { sort: "desc", nulls: "last" } },
        take: 20,
      });

      const recentResults = recentAllGames.flatMap((g) =>
        g.playedAt ? [{ playedAt: g.playedAt, result: g.result }] : [],
      );

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
    .input(analysisSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existingEvent = await ctx.prisma.activityEvent.findUnique({
        where: {
          userId_requestId: {
            userId: ctx.userId,
            requestId: input.requestId,
          },
        },
        select: { payload: true },
      });
      if (existingEvent) {
        return repeatedSessionResult(existingEvent.payload, input.gameId);
      }

      const owns = await userOwnsGame(ctx.prisma, ctx.userId, input.gameId);
      if (!owns) {
        throw expectedError.notFound(
          "That game is no longer in your library. Return to Analysis and choose another game.",
        );
      }

      const game = await ctx.prisma.importedGame.findUnique({
        where: { id: input.gameId },
        include: { analysis: true },
      });
      if (!game || !game.analysis) {
        throw expectedError.notFound(
          "This game has no saved analysis. Return to Analysis and scan it again.",
        );
      }

      const rawFeatures = rawGameFeaturesSchema.parse(
        game.analysis.rawFeatures,
      );
      const analysedPlies = new Set(
        rawFeatures.moveEvals.map((move) => move.ply),
      );
      if (input.outcomes.some((outcome) => !analysedPlies.has(outcome.ply))) {
        throw expectedError.badRequest(
          "The review contains a position that is not in the saved analysis.",
        );
      }

      const blundersByPly = new Map(
        rawFeatures.blunders.map((blunder) => [blunder.ply, blunder]),
      );
      const schedulableOutcomes = input.outcomes.flatMap((outcome) => {
        const blunder = blundersByPly.get(outcome.ply);
        return blunder && outcome.bestUci ? [{ outcome, blunder }] : [];
      });
      const cfg = loadMethodology();
      const now = systemClock.now();

      try {
        return await ctx.prisma.$transaction(async (tx) => {
          await tx.activityEvent.create({
            data: {
              userId: ctx.userId,
              requestId: input.requestId,
              type: "game_analysed",
              occurredAt: new Date(now),
              payload: {
                gameId: input.gameId,
                reflectionNote: input.reflectionNote,
                outcomes: input.outcomes,
                scheduledCount: schedulableOutcomes.length,
              } as unknown as Prisma.InputJsonValue,
              source: "user",
            },
          });

          for (const { outcome, blunder } of schedulableOutcomes) {
            const sourceRef = `blunder:${input.gameId}:${outcome.ply}`;
            const item = await tx.practiceItem.upsert({
              where: {
                userId_sourceRef: {
                  userId: ctx.userId,
                  sourceRef,
                },
              },
              create: {
                userId: ctx.userId,
                kind: "blunder_drill",
                fen: blunder.fen,
                solutionLine: [outcome.bestUci!],
                sourceRef,
              },
              update: {
                fen: blunder.fen,
                solutionLine: [outcome.bestUci!],
              },
            });

            const itemType = "blunder_drill";
            const itemRef = item.id;
            const existing = await tx.scheduleState.findUnique({
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

            await tx.scheduleState.upsert({
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
          }

          return {
            success: true as const,
            scheduledCount: schedulableOutcomes.length,
          };
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const repeated = await ctx.prisma.activityEvent.findUnique({
            where: {
              userId_requestId: {
                userId: ctx.userId,
                requestId: input.requestId,
              },
            },
            select: { payload: true },
          });
          if (repeated) {
            return repeatedSessionResult(repeated.payload, input.gameId);
          }
        }
        throw error;
      }
    }),

  // Ownership-scoped source for client-side analysis.
  gameSource: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const game = await ctx.prisma.importedGame.findFirst({
        where: { id: input.gameId, userId: ctx.userId },
        select: { id: true, pgn: true, color: true },
      });
      if (!game) {
        throw expectedError.notFound(
          "That game is no longer in your library. Return to Analysis and choose another game.",
        );
      }
      return game;
    }),
});
