// Program transport only. Graded logic remains in Engine and methodology functions.

import { z } from "zod";
import type { LichessPuzzle } from "@prisma/client";

import {
  generateAndSaveProgram,
  getGameSignals,
  getTodayProgram,
  prepareProgram,
  toTodayItem,
} from "@/server/program";
import { resolveTacticalRating } from "@/server/profile";
import { protectedProcedure, router } from "@/server/trpc";
import {
  loadMethodology,
  bandForRating,
  expectationForBand,
  interfaceAffordancesFor,
  rationaleFor,
  redoFlowPolicy,
} from "@/methodology";
import { selectPuzzles } from "@/db/puzzles";
import { findPracticeItemsByIds } from "@/db/practice";
import { getTargetFocus } from "@/server/constraints";
import { lookupTablebase } from "@/server/tablebase";
import {
  getWeeklyFocus,
  recommendationForPersistedFocus,
  selectPersistedFocusChoice,
} from "@/server/weekly-focus";
import {
  getForecast,
  getAvailabilityOverrides,
  getProgramRevisions,
  getWeeklyAvailability,
  hasStartedToday,
  refreshForecast,
  removeAvailabilityOverride,
  saveAvailabilityOverride,
  saveWeeklyAvailability,
} from "@/server/program-forecast";
import {
  availabilityOverrideInputSchema,
  programRevisionPageInputSchema,
  programRevisionPageSchema,
  weeklyAvailabilityInputSchema,
} from "@/lib/program-forecast";
import {
  programHistoryInputSchema,
  programHistoryPageSchema,
} from "@/lib/program-history";
import { getProgramHistory } from "@/server/program-history";
import { expectedError } from "@/server/errors";

/** Normalized position for the board trainer. */
interface Solvable {
  id: string;
  kind: "puzzle" | "blunder_drill" | "endgame";
  fen: string;
  // Puzzle lines include the opponent's setup move; drill lines start with the user move.
  // Endgames have no fixed line.
  line: string[];
  rating: number | null;
  themes: string[];
  objective?: "win" | "draw";
  label?: string;
}

function toPuzzleSolvable(p: LichessPuzzle): Solvable {
  return {
    id: p.puzzleId,
    kind: "puzzle",
    fen: p.fen,
    line: p.moves.trim().length > 0 ? p.moves.trim().split(/\s+/) : [],
    rating: p.rating,
    themes: p.themes,
  };
}

export const programRouter = router({
  getToday: protectedProcedure.query(({ ctx }) =>
    getTodayProgram(ctx.prisma, ctx.userId),
  ),

  getTrainItem: protectedProcedure
    .input(z.object({ programItemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.programItem.findUnique({
        where: { id: input.programItemId },
        include: {
          program: true,
          resourceRef: true,
        },
      });

      if (!item || item.program.userId !== ctx.userId) {
        throw expectedError.notFound(
          "This training block is no longer in your plan. Return to Today for the latest session.",
        );
      }

      // Historic items must render under the version that generated them.
      const cfg = loadMethodology(item.program.methodologyVersion);

      const params = (item.params ?? {}) as Record<string, unknown>;
      const theme = (params.theme as string | null) ?? null;
      const targetRating = (params.targetRating as number | null) ?? 1500;
      const count = (params.count as number | null) ?? 5;

      let solvables: Solvable[] = [];

      if (item.activityType === "blunder_drill") {
        const refs = (params.dueItemRefs as string[] | null) ?? [];
        const items = await findPracticeItemsByIds(
          ctx.prisma,
          ctx.userId,
          refs,
        );
        const order = new Map(refs.map((id, idx) => [id, idx]));
        solvables = items
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
          .map((pi) => ({
            id: pi.id,
            kind: "blunder_drill" as const,
            fen: pi.fen,
            line: pi.solutionLine,
            rating: null,
            themes: [],
          }));
      } else if (item.activityType === "endgame_drill") {
        // Resolve each objective from the methodology release that generated the item.
        const curriculumById = new Map(
          Object.values(cfg.endgameCurriculum.positionsByBand)
            .flat()
            .map((pos) => [pos.id, pos]),
        );
        const refs = (params.dueItemRefs as string[] | null) ?? [];
        const items = await findPracticeItemsByIds(
          ctx.prisma,
          ctx.userId,
          refs,
        );
        const order = new Map(refs.map((id, idx) => [id, idx]));
        solvables = items
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
          .map((pi) => {
            const pos = pi.methodologyKey
              ? curriculumById.get(pi.methodologyKey)
              : undefined;
            return {
              id: pi.id,
              kind: "endgame" as const,
              fen: pi.fen,
              line: [],
              rating: null,
              themes: [],
              objective: pos?.objective.value ?? "win",
              label: pos?.label ?? "Endgame",
            };
          });
      } else if (item.activityType === "spaced_review") {
        const dueIds = (params.dueItemRefs as string[] | null) ?? [];
        if (dueIds.length > 0) {
          const puzzles = await ctx.prisma.lichessPuzzle.findMany({
            where: { puzzleId: { in: dueIds } },
          });
          const orderMap = new Map<string, number>(
            dueIds.map((id: string, idx: number) => [id, idx]),
          );
          solvables = puzzles
            .sort(
              (a, b) =>
                (orderMap.get(a.puzzleId) ?? 0) -
                (orderMap.get(b.puzzleId) ?? 0),
            )
            .map(toPuzzleSolvable);
        }
      } else if (item.activityType !== "puzzle_theme") {
        throw expectedError.badRequest(
          "This activity does not open in the board trainer. Return to Today to start it.",
        );
      } else {
        const pastEvents = await ctx.prisma.activityEvent.findMany({
          where: { userId: ctx.userId, type: "puzzle_attempt" },
          select: { payload: true },
        });
        const excludePuzzleIds = pastEvents
          .map(
            (e) =>
              (e.payload as Record<string, unknown>)?.puzzleId as
                | string
                | undefined,
          )
          .filter((id): id is string => !!id);

        const puzzles = await selectPuzzles(ctx.prisma, {
          theme: theme || "mix",
          ratingTarget: targetRating,
          ratingWindow: 150,
          count,
          excludePuzzleIds,
        });
        solvables = puzzles.map(toPuzzleSolvable);
      }

      const dimLabels = new Map(cfg.dimensions.map((d) => [d.id, d.label]));
      const ledger = new Map(cfg.evidenceLedger.map((l) => [l.key, l.source]));
      // Board-trainer items never need an external play platform.
      const todayItem = toTodayItem(item, cfg, dimLabels, ledger, null);

      const tacticalRating = await resolveTacticalRating(
        ctx.prisma,
        ctx.userId,
        cfg,
      );
      const band = bandForRating(tacticalRating, cfg);
      const targetFocus = await getTargetFocus(ctx.prisma, ctx.userId);
      const affordances = interfaceAffordancesFor({ band, targetFocus }, cfg);
      const restrictionRationale = affordances.restricted
        ? rationaleFor(affordances.restrictionRationaleKey, cfg)
        : null;

      // Retest timing, hints, and rationale stay pinned to the item's methodology release.
      const retest = rationaleFor("redo_retest", cfg);
      const redoPolicy = redoFlowPolicy(cfg);
      const hintSource = cfg.evidenceLedger.find(
        (entry) => entry.key === redoPolicy.hint.citationKey,
      )?.source;
      const redoFlow = {
        retestDelaySec: redoPolicy.retestDelaySec,
        hint: {
          ...redoPolicy.hint,
          citationSource: hintSource ?? redoPolicy.hint.citationKey,
        },
        rationale: {
          value: retest.value,
          grade: retest.grade,
          tier: retest.tier,
        },
      };

      return {
        item: todayItem,
        solvables,
        affordances,
        restrictionRationale,
        redoFlow,
      };
    }),

  gameSignals: protectedProcedure.query(({ ctx }) =>
    getGameSignals(ctx.prisma, ctx.userId),
  ),

  generate: protectedProcedure.mutation(async ({ ctx }) => {
    await generateAndSaveProgram(ctx.prisma, ctx.userId, undefined, {
      preventStartedReplacement: true,
      reuseExistingDate: true,
      forecast: { trigger: "generation", preserveCommittedToday: false },
    });
    return getTodayProgram(ctx.prisma, ctx.userId);
  }),

  replan: protectedProcedure.mutation(async ({ ctx }) => {
    await generateAndSaveProgram(ctx.prisma, ctx.userId, undefined, {
      preserveCompletedToday: true,
      forecast: {
        trigger: "explicit_replan",
        preserveCommittedToday: false,
      },
    });
    return getTodayProgram(ctx.prisma, ctx.userId);
  }),

  forecast: protectedProcedure.query(({ ctx }) =>
    getForecast(ctx.prisma, ctx.userId),
  ),

  revisions: protectedProcedure
    .input(programRevisionPageInputSchema.optional())
    .output(programRevisionPageSchema)
    .query(({ ctx, input }) =>
      getProgramRevisions(
        ctx.prisma,
        ctx.userId,
        programRevisionPageInputSchema.parse(input ?? {}),
      ),
    ),

  history: protectedProcedure
    .input(programHistoryInputSchema.optional())
    .output(programHistoryPageSchema)
    .query(({ ctx, input }) =>
      getProgramHistory(
        ctx.prisma,
        ctx.userId,
        programHistoryInputSchema.parse(input ?? {}),
      ),
    ),

  availability: protectedProcedure.query(({ ctx }) =>
    getWeeklyAvailability(ctx.prisma, ctx.userId),
  ),

  availabilityOverrides: protectedProcedure.query(({ ctx }) =>
    getAvailabilityOverrides(ctx.prisma, ctx.userId),
  ),

  saveAvailability: protectedProcedure
    .input(weeklyAvailabilityInputSchema)
    .mutation(async ({ ctx, input }) => {
      await saveWeeklyAvailability(ctx.prisma, ctx.userId, input);
      const started = await hasStartedToday(ctx.prisma, ctx.userId);
      return refreshForecast(
        ctx.prisma,
        ctx.userId,
        undefined,
        "availability",
        started,
      );
    }),

  saveAvailabilityOverride: protectedProcedure
    .input(availabilityOverrideInputSchema)
    .mutation(async ({ ctx, input }) => {
      await saveAvailabilityOverride(ctx.prisma, ctx.userId, input);
      const started = await hasStartedToday(ctx.prisma, ctx.userId);
      return refreshForecast(
        ctx.prisma,
        ctx.userId,
        undefined,
        "availability_override",
        started,
      );
    }),

  removeAvailabilityOverride: protectedProcedure
    .input(z.object({ date: z.number().int() }).strict())
    .mutation(async ({ ctx, input }) => {
      await removeAvailabilityOverride(ctx.prisma, ctx.userId, input.date);
      const started = await hasStartedToday(ctx.prisma, ctx.userId);
      return refreshForecast(
        ctx.prisma,
        ctx.userId,
        undefined,
        "availability_override_removed",
        started,
      );
    }),

  weeklyFocus: protectedProcedure.query(async ({ ctx }) => {
    const focus = await getWeeklyFocus(ctx.prisma, ctx.userId);
    if (!focus) return null;
    const cfg = loadMethodology(focus.methodologyVersion);
    const recommendation = recommendationForPersistedFocus(focus, cfg);
    return {
      ...focus,
      recommendation: {
        focusAreas: recommendation.focusAreas,
        supportingSignals: recommendation.supportingSignals,
        rationale: recommendation.rationale,
      },
      focusLabels: Object.fromEntries(
        cfg.dimensions.map((dimension) => [dimension.id, dimension.label]),
      ),
    };
  }),

  selectFocus: protectedProcedure
    .input(
      z.object({
        weeklyFocusId: z.string().min(1).max(80),
        focusAreas: z.array(z.string().min(1).max(80)).min(1).max(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const selected = await selectPersistedFocusChoice(
        ctx.prisma,
        ctx.userId,
        input.weeklyFocusId,
        input.focusAreas,
      );
      let forecastUpdated = true;
      try {
        const started = await hasStartedToday(ctx.prisma, ctx.userId);
        if (started) {
          const prepared = await prepareProgram(ctx.prisma, ctx.userId);
          await refreshForecast(
            ctx.prisma,
            ctx.userId,
            undefined,
            "focus_choice",
            true,
            prepared.forecastSource,
          );
        } else {
          await generateAndSaveProgram(ctx.prisma, ctx.userId, undefined, {
            preventStartedReplacement: true,
            forecast: {
              trigger: "focus_choice",
              preserveCommittedToday: false,
            },
          });
        }
      } catch {
        // The focus write is already durable. Report the partial outcome instead of
        // falsely telling the user that their choice was rejected.
        forecastUpdated = false;
      }
      return { focus: selected, forecastUpdated };
    }),

  // Null means the client should fall back to chess-engine judging.
  probeTablebase: protectedProcedure
    .input(z.object({ fen: z.string().min(1) }))
    .query(({ ctx, input }) =>
      lookupTablebase(ctx.prisma, ctx.userId, input.fen),
    ),

  bandExpectation: protectedProcedure.query(async ({ ctx }) => {
    const cfg = loadMethodology();
    const rating = await resolveTacticalRating(ctx.prisma, ctx.userId, cfg);
    const bandId = bandForRating(rating, cfg);
    return expectationForBand(bandId, cfg);
  }),
});
