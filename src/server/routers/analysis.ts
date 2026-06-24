import { z } from "zod";
import type { Prisma } from "@prisma/client";

import {
  analysisCounts,
  gamesNeedingAnalysis,
  gamesNeedingAnalysisInWindow,
  saveAnalysisResult,
  userOwnsGame,
} from "@/db/analysis";
import { rawGameFeaturesSchema, type RawGameFeatures } from "@/lib/raw-features";
import {
  loadMethodology,
  bandForRating,
  gameAnalysisProtocol,
  rationaleFor,
  gameSelectionRatioFor,
  scheduleReview,
  type FsrsState,
} from "@/methodology";
import { resolvePlayingRating } from "@/server/program";
import { gameIdentity } from "@/server/game-identity";
import { systemClock } from "@/lib/clock";
import { protectedProcedure, router } from "@/server/trpc";

const PLATFORMS = ["lichess", "chesscom"] as const;

export const analysisRouter = router({
  // The instant-eval work queue. With no input: the most-recent unanalysed games, capped at
  // the Seam-2 instant-eval budget (config, M4's deferred `instantEvalGames`) — unchanged
  // default used by the /settings maintenance runner. With `limit`: the `limit` most recent
  // games (optionally platform-scoped) that aren't analysed yet — "analyse my last N games",
  // used by the analysis dashboard's batch buttons.
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

  // The honest win:loss analysis-ratio recommendation (Seam 4.1 §Step5) for the dashboard. No
  // curated game list — the player picks from their own recent games directly, with no lock
  // or cooldown (tilt detection lives only in the per-game `session` flow's calibration step).
  suggestions: protectedProcedure.query(async ({ ctx }) => {
    const cfg = loadMethodology();
    // The win:loss recommendation keys off PLAYING strength, not the inflated puzzle rating.
    const playingRating = await resolvePlayingRating(ctx.prisma, ctx.userId, cfg);
    const band = bandForRating(playingRating, cfg);

    return {
      ratio: gameSelectionRatioFor(band, cfg),
      rationale: rationaleFor("analysis_success_bias", cfg),
    };
  }),

  // The game library: the user's recent games (most-recent-first) for self-directed pick-a-
  // game analysis, plus the resolved primary platform that defaults the picker.
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
    // Prefer the explicit choice (if it still has games); otherwise fall back to the platform
    // of the most recent game so the picker is useful before any preference is set.
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

  // Set the user's home platform (defaults the game picker + analysis surfaces).
  setPrimaryPlatform: protectedProcedure
    .input(z.object({ platform: z.enum(PLATFORMS) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { primaryPlatform: input.platform },
      });
      return { primaryPlatform: input.platform };
    }),

  // Retrieve/setup analysis session for a specific game
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
      // The analysis band reflects how the user PLAYS — the rating they had in THIS game
      // (falling back to a recent playing-format rating, then the calibration estimate) —
      // not their puzzle rating, which would over-promote a beginner into a strict band.
      const playingRating = await resolvePlayingRating(
        ctx.prisma,
        ctx.userId,
        cfg,
        game.userRatingAtGame,
      );
      const band = bandForRating(playingRating, cfg);

      // Fetch recent results for tilt detection
      const recentAllGames = await ctx.prisma.importedGame.findMany({
        where: { userId: ctx.userId },
        orderBy: { playedAt: "desc" },
        take: 20,
      });

      const recentResults = recentAllGames.map((g) => ({
        playedAt: g.playedAt,
        result: g.result,
      }));

      const parsedGame = {
        id: game.id,
        pgn: game.pgn,
        playedAt: game.playedAt,
        result: game.result,
        color: game.color,
        userRatingAtGame: game.userRatingAtGame,
        rawFeatures: game.analysis?.rawFeatures as unknown as RawGameFeatures | null,
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
          analyse_own_games: rationaleFor("analyse_own_games", cfg),
          analysis_tilt_pause: rationaleFor("analysis_tilt_pause", cfg),
          analysis_engine_delay: rationaleFor("analysis_engine_delay", cfg),
          analysis_rpl_filter: rationaleFor("analysis_rpl_filter", cfg),
          analysis_guess_tolerance: rationaleFor("analysis_guess_tolerance", cfg),
          analysis_entropy: rationaleFor("analysis_entropy", cfg),
          analysis_srs_puzzle: rationaleFor("analysis_srs_puzzle", cfg),
        },
      };
    }),

  // M12 — the interactive game review: the game + its raw per-move evals + blunders, for the
  // step-through eval-graph board (projected client-side via @/engine/review). Lighter than
  // `session` (no 5-step protocol); also backs the onboarding "reveal".
  review: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const owns = await userOwnsGame(ctx.prisma, ctx.userId, input.gameId);
      if (!owns) throw new Error("Unauthorized");

      const game = await ctx.prisma.importedGame.findUnique({
        where: { id: input.gameId },
        include: { analysis: true },
      });
      if (!game) throw new Error("Game not found");

      const parsed = game.analysis
        ? rawGameFeaturesSchema.safeParse(game.analysis.rawFeatures)
        : null;
      const rawFeatures: RawGameFeatures | null =
        parsed && parsed.success ? parsed.data : null;

      const cfg = loadMethodology();
      return {
        game: {
          id: game.id,
          pgn: game.pgn,
          color: game.color,
          result: game.result,
          platform: game.platform,
          playedAt: game.playedAt,
          timeControl: game.timeControl,
          opening: game.opening,
          eco: game.eco,
          opponentRating: game.opponentRating,
          userRating: game.userRatingAtGame,
          ...gameIdentity(game.pgn, game.color),
        },
        analyzed: rawFeatures !== null,
        moveEvals: rawFeatures?.moveEvals ?? [],
        blunders: rawFeatures?.blunders ?? [],
        rationale: rationaleFor("analyse_own_games", cfg),
      };
    }),

  // Submit session outcomes and schedule review states
  saveSession: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        reflectionNote: z.string(),
        outcomes: z.array(
          z.object({
            ply: z.number().int(),
            correct: z.boolean(),
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

      const rawFeatures = game.analysis.rawFeatures as unknown as RawGameFeatures;
      const cfg = loadMethodology();
      const now = Date.now();

      // Log the game_analysed activity event
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
        const blunder = rawFeatures.blunders?.find((b) => b.ply === outcome.ply);
        const fen = blunder?.fen;
        if (!fen) continue;

        const itemType = "mistake_puzzle";
        const itemRef = `${input.gameId}:${outcome.ply}`;

        const existing = await ctx.prisma.scheduleState.findUnique({
          where: {
            userId_itemType_itemRef: {
              userId: ctx.userId,
              itemType,
              itemRef,
            },
          },
        });

        const fsrsState = existing ? (existing.fsrsState as unknown as FsrsState) : null;
        const grade = outcome.correct ? 3 : 1; // Good vs Again

        const { newState } = scheduleReview(
          { grade, fsrsState, now },
          cfg,
        );

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
            source: "redo",
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

  // Source PGN + the user's side, for running the engine on ONE specific game (the per-game
  // "Engine analysis" button). Ownership-scoped; returns only what the client needs to
  // analyse the game with Stockfish and persist its raw features via `save`.
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
