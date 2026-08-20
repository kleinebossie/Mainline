import { z } from "zod";
import { Prisma } from "@prisma/client";
import { Chess } from "chess.js";

import {
  analysisCounts,
  gamesNeedingAnalysis,
  gamesNeedingAnalysisInWindow,
  saveAnalysisResult,
  userOwnsGame,
} from "@/db/analysis";
import { selectPuzzles } from "@/db/puzzles";
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
import { publicProcedure, router } from "@/server/trpc";
import { lichessAdapter } from "@/integrations/lichess/adapter";
import { chessComAdapter } from "@/integrations/chesscom/adapter";
import type { ImportedGameInput } from "@/integrations/adapter";
import { analyzePublicUsername } from "@/server/public-analysis";
import { expectedError } from "@/server/errors";
import { GAME_ANALYSED_ACTIVITY_EVENT_TYPE } from "@/lib/tracker";


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
  pending: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).optional(),
          platform: z.enum(ANALYSIS_SOURCES).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) return [];
      const cfg = loadMethodology();
      const games =
        input?.limit != null
          ? await gamesNeedingAnalysisInWindow(
              ctx.prisma,
              userId,
              input.limit,
              input.platform,
            )
          : await gamesNeedingAnalysis(
              ctx.prisma,
              userId,
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

  save: publicProcedure
    .input(
      z.object({
        gameId: z.string().min(1).max(191),
        engineVersion: z.string().min(1).max(64),
        depth: z.number().int().min(1).max(64),
        rawFeatures: rawGameFeaturesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return { saved: true as const };
      }
      const owns = await userOwnsGame(ctx.prisma, userId, input.gameId);
      if (!owns) {
        throw expectedError.notFound("Game does not exist.");
      }
      await saveAnalysisResult(ctx.prisma, {
        gameId: input.gameId,
        engineVersion: input.engineVersion,
        depth: input.depth,
        rawFeatures: input.rawFeatures,
      });
      return { saved: true as const };
    }),

  summary: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      return { total: 0, analysed: 0, unanalysed: 0 };
    }
    return analysisCounts(ctx.prisma, userId);
  }),

  suggestions: publicProcedure.query(async ({ ctx }) => {
    const cfg = loadMethodology();
    const userId = ctx.session?.user?.id;
    const playingRating = userId
      ? await resolvePlayingRating(ctx.prisma, userId, cfg)
      : 1450;
    const band = bandForRating(playingRating, cfg);

    return {
      ratio: gameSelectionRatioFor(band, cfg),
      ownGamesRationale: rationaleFor("analyse_own_games", cfg),
      successBiasRationale: rationaleFor("analysis_success_bias", cfg),
    };
  }),

  library: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      return {
        primaryPlatform: null,
        effectivePlatform: null,
        platforms: [],
        games: [],
      };
    }
    const [user, platformGames, manualGames] = await Promise.all([
      ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { primaryPlatform: true },
      }),
      ctx.prisma.importedGame.findMany({
        where: { userId, source: { not: "manual" } },
        orderBy: [
          { playedAt: { sort: "desc", nulls: "last" } },
          { importedAt: "desc" },
        ],
        take: 60,
        select: libraryGameSelect,
      }),
      ctx.prisma.importedGame.findMany({
        where: { userId, source: "manual" },
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
          pgn: g.pgn,
        };
      }),
    };
  }),

  fetchGuestGames: publicProcedure
    .input(
      z.object({
        platform: z.enum(["lichess", "chesscom"]),
        username: z.string().trim().min(1).max(50),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.platform === "lichess") {
        try {
          const games: ImportedGameInput[] = await lichessAdapter.fetchGames(
            { platform: "lichess", externalUsername: input.username },
            undefined,
            30,
          );
          return games.map((g) => {
            const id = gameIdentity(g.pgn, g.color ?? null);
            return {
              id: g.externalGameId,
              platform: "lichess" as const,
              playedAt: g.playedAt ? new Date(g.playedAt).toISOString() : null,
              color: g.color ?? null,
              result: g.result ?? null,
              timeControl: g.timeControl ?? null,
              opening: g.opening ?? null,
              opponentRating: g.opponentRating ?? null,
              userRatingAtGame: g.userRatingAtGame ?? null,
              pgn: g.pgn,
              opponent: id.opponent ?? id.black ?? id.white ?? "Opponent",
              event: id.event ?? null,
              you: input.username,
              analyzed: false,
            };
          });
        } catch {
          return [];
        }
      } else {
        try {
          const games: ImportedGameInput[] = await chessComAdapter.fetchGames(
            { platform: "chesscom", externalUsername: input.username },
            undefined,
            30,
          );
          return games.map((g) => {
            const id = gameIdentity(g.pgn, g.color ?? null);
            return {
              id: g.externalGameId,
              platform: "chesscom" as const,
              playedAt: g.playedAt ? new Date(g.playedAt).toISOString() : null,
              color: g.color ?? null,
              result: g.result ?? null,
              timeControl: g.timeControl ?? null,
              opening: g.opening ?? null,
              opponentRating: g.opponentRating ?? null,
              userRatingAtGame: g.userRatingAtGame ?? null,
              pgn: g.pgn,
              opponent: id.opponent ?? id.black ?? id.white ?? "Opponent",
              event: id.event ?? null,
              you: input.username,
              analyzed: false,
            };
          });
        } catch {
          return [];
        }
      }
    }),

  setPrimaryPlatform: publicProcedure
    .input(z.object({ platform: z.enum(PLATFORMS) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return { primaryPlatform: input.platform };
      }
      await ctx.prisma.user.update({
        where: { id: userId },
        data: { primaryPlatform: input.platform },
      });
      return { primaryPlatform: input.platform };
    }),

  session: publicProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) return null;

      const owns = await userOwnsGame(ctx.prisma, userId, input.gameId);
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
        userId,
        cfg,
        game.userRatingAtGame,
      );
      const band = bandForRating(playingRating, cfg);

      const recentAllGames = await ctx.prisma.importedGame.findMany({
        where: {
          userId,
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

  saveSession: publicProcedure
    .input(analysisSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        return {
          success: true as const,
          scheduledCount: 0,
        };
      }

      const existingEvent = await ctx.prisma.activityEvent.findUnique({
        where: {
          userId_requestId: {
            userId,
            requestId: input.requestId,
          },
        },
        select: { payload: true },
      });
      if (existingEvent) {
        return repeatedSessionResult(existingEvent.payload, input.gameId);
      }

      const owns = await userOwnsGame(ctx.prisma, userId, input.gameId);
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
              userId,
              requestId: input.requestId,
              type: GAME_ANALYSED_ACTIVITY_EVENT_TYPE,
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
                  userId,
                  sourceRef,
                },
              },
              create: {
                userId,
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
                  userId,
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
                  userId,
                  itemType,
                  itemRef,
                },
              },
              create: {
                userId,
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
                userId,
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
  gameSource: publicProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) return null;

      const game = await ctx.prisma.importedGame.findFirst({
        where: { id: input.gameId, userId },
        select: { id: true, pgn: true, color: true },
      });
      if (!game) {
        throw expectedError.notFound(
          "That game is no longer in your library. Return to Analysis and choose another game.",
        );
      }
      return game;
    }),

  // Public blunder analyzer for homepage visitor lead magnet (Sprint 1 §3.1).
  analyzePublicUsername: publicProcedure
    .input(
      z.object({
        platform: z.enum(["lichess", "chesscom"]),
        username: z.string().min(1).max(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      return analyzePublicUsername(input.platform, input.username, ctx.prisma);
    }),

  // Rated drill for reveal and onboarding fallback
  getPersonalizedDrill: publicProcedure
    .input(
      z.object({
        ratingTarget: z.number().int().min(400).max(3000),
        theme: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const candidates = await selectPuzzles(ctx.prisma, {
          theme: input.theme || "mix",
          ratingTarget: input.ratingTarget,
          count: 5,
        });

        for (const pz of candidates) {
          const rawMoves = pz.moves.trim().split(/\s+/);
          if (rawMoves.length >= 2) {
            const chess = new Chess(pz.fen);
            const oppMove = chess.move(rawMoves[0]!);
            if (oppMove) {
              return {
                fen: chess.fen(),
                solutionLine: rawMoves.slice(1),
                source: "starter" as const,
                title: `Tactical Drill (${pz.rating} rated)`,
                description: `A puzzle calibrated to your tactical level (${pz.rating}). Find the winning move.`,
                gameInfo: pz.gameUrl ?? undefined,
                rating: pz.rating,
              };
            }
          }
        }
        return null;
      } catch {
        return null;
      }
    }),
});

