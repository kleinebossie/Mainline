// Program API (BUILD.md M6 · §7.1). `getToday` returns the active generated session (or
// null), `generate` (re)generates it from current state and returns the fresh session. All
// graded logic is in the pure generator + provider; this router only orchestrates (L1).

import { z } from "zod";
import type { LichessPuzzle } from "@prisma/client";

import {
  generateAndSaveProgram,
  getGameSignals,
  getTodayProgram,
  resolveTacticalRating,
  toTodayItem,
} from "@/server/program";
import { protectedProcedure, router } from "@/server/trpc";
import {
  loadMethodology,
  bandForRating,
  expectationForBand,
  interfaceAffordancesFor,
  rationaleFor,
  type TargetFocus,
} from "@/methodology";
import { selectPuzzles } from "@/db/puzzles";

export const programRouter = router({
  getToday: protectedProcedure.query(({ ctx }) =>
    getTodayProgram(ctx.prisma, ctx.userId),
  ),

  getTrainItem: protectedProcedure
    .input(z.object({ programItemId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 1. Fetch program item
      const item = await ctx.prisma.programItem.findUnique({
        where: { id: input.programItemId },
        include: {
          program: true,
          resourceRef: true,
        },
      });

      if (!item || item.program.userId !== ctx.userId) {
        throw new Error("Program item not found");
      }

      // Load methodology config
      const cfg = loadMethodology();

      // Resolve theme, track, and other params
      const params = (item.params ?? {}) as Record<string, unknown>;
      const theme = (params.theme as string | null) ?? null;
      const targetRating = (params.targetRating as number | null) ?? 1500;
      const count = (params.count as number | null) ?? 5;

      let puzzles: LichessPuzzle[] = [];

      if (item.activityType === "spaced_review") {
        // Fetch puzzles by their IDs
        const dueIds = (params.dueItemRefs as string[] | null) ?? [];
        if (dueIds.length > 0) {
          puzzles = await ctx.prisma.lichessPuzzle.findMany({
            where: { puzzleId: { in: dueIds } },
          });
          // Sort to match order of dueIds
          const orderMap = new Map<string, number>(
            dueIds.map((id: string, idx: number) => [id, idx]),
          );
          puzzles.sort(
            (a, b) =>
              (orderMap.get(a.puzzleId) ?? 0) - (orderMap.get(b.puzzleId) ?? 0),
          );
        }
      } else {
        // Query past puzzle attempts to get excludePuzzleIds
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

        puzzles = await selectPuzzles(ctx.prisma, {
          theme: theme || "mix",
          ratingTarget: targetRating,
          ratingWindow: 150,
          count,
          excludePuzzleIds,
        });
      }

      // Convert to TodayItem
      const dimLabels = new Map(cfg.dimensions.map((d) => [d.id, d.label]));
      const ledger = new Map(cfg.evidenceLedger.map((l) => [l.key, l.source]));
      // Train items are always internal (delivery: internal → /train/...), so the external
      // play-link platform is irrelevant here — pass null.
      const todayItem = toTodayItem(item, cfg, dimLabels, ledger, null);

      // Seam 4 §4.4(c) — the board's interface-restriction affordances for this user, from
      // config (L1). `targetFocus` defaults to "online" until the constraints form captures
      // it (M14); the band×focus gating is already config-driven and ready.
      const tacticalRating = await resolveTacticalRating(
        ctx.prisma,
        ctx.userId,
        cfg,
      );
      const band = bandForRating(tacticalRating, cfg);
      const targetFocus: TargetFocus = "online";
      const affordances = interfaceAffordancesFor({ band, targetFocus }, cfg);
      const restrictionRationale = affordances.restricted
        ? rationaleFor(affordances.restrictionRationaleKey, cfg)
        : null;

      return {
        item: todayItem,
        puzzles,
        affordances,
        restrictionRationale,
      };
    }),

  gameSignals: protectedProcedure.query(({ ctx }) =>
    getGameSignals(ctx.prisma, ctx.userId),
  ),

  generate: protectedProcedure.mutation(async ({ ctx }) => {
    await generateAndSaveProgram(ctx.prisma, ctx.userId);
    return getTodayProgram(ctx.prisma, ctx.userId);
  }),

  bandExpectation: protectedProcedure.query(async ({ ctx }) => {
    const cfg = loadMethodology();
    const rating = await resolveTacticalRating(ctx.prisma, ctx.userId, cfg);
    const bandId = bandForRating(rating, cfg);
    return expectationForBand(bandId, cfg);
  }),
});
