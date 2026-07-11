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
  redoFlowPolicy,
} from "@/methodology";
import { selectPuzzles } from "@/db/puzzles";
import { findPracticeItemsByIds } from "@/db/practice";
import { getTargetFocus } from "@/server/constraints";
import { lookupTablebase } from "@/server/tablebase";

/** A position the in-app board can solve/play — a Lichess puzzle, a personal blunder drill,
 *  or a curated endgame (M11/M12/M13) — normalised so the surface renders them uniformly. */
interface Solvable {
  id: string;
  kind: "puzzle" | "blunder_drill" | "endgame";
  fen: string;
  /** The solution line: a puzzle's raw Lichess UCI (moves[0] = opponent setup) or a drill's
   *  best-move line (already the player's move first). Empty for an endgame, which is PLAYED
   *  OUT vs the engine rather than matched to a fixed line. The `kind` tells the board which. */
  line: string[];
  rating: number | null;
  themes: string[];
  /** Endgame only: the technique target the play-out is judged against (Seam-4 config). */
  objective?: "win" | "draw";
  /** Endgame only: the curated position's name (e.g. "King + Rook vs King"). */
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

      // Historic items must render under the version that generated them.
      const cfg = loadMethodology(item.program.methodologyVersion);

      // Resolve theme, track, and other params
      const params = (item.params ?? {}) as Record<string, unknown>;
      const theme = (params.theme as string | null) ?? null;
      const targetRating = (params.targetRating as number | null) ?? 1500;
      const count = (params.count as number | null) ?? 5;

      let solvables: Solvable[] = [];

      if (item.activityType === "blunder_drill") {
        // M12: resolve the due personal blunder positions (PracticeItems) to solve on the board.
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
        // M13: resolve the due curated endgame positions (PracticeItems) to play out vs the
        // engine. Each position's OBJECTIVE (win / hold the draw) is resolved from the Seam-4
        // curriculum by its methodologyKey (the curriculum id) — config is the source of truth.
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
        // Fetch puzzles by their IDs
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
        throw new Error("This activity does not use the board trainer");
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

        const puzzles = await selectPuzzles(ctx.prisma, {
          theme: theme || "mix",
          ratingTarget: targetRating,
          ratingWindow: 150,
          count,
          excludePuzzleIds,
        });
        solvables = puzzles.map(toPuzzleSolvable);
      }

      // Convert to TodayItem
      const dimLabels = new Map(cfg.dimensions.map((d) => [d.id, d.label]));
      const ledger = new Map(cfg.evidenceLedger.map((l) => [l.key, l.source]));
      // Train items are always internal (delivery: internal → /train/...), so the external
      // play-link platform is irrelevant here — pass null.
      const todayItem = toTodayItem(item, cfg, dimLabels, ledger, null);

      // Seam 4 §4.4(c) — the board's interface-restriction affordances for this user, from
      // config (L1). The user's stored play medium (M14) gates arrows/hover; the band×focus
      // gating is config-driven.
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

      // §7.5 redo flow: the intra-session retest wait and its graded "why" come from config
      // (Seam 6), never hardcoded on the solving surface (L1). The provider fails closed
      // if a release does not supply the policy, including its compatibility overlay.
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
    await generateAndSaveProgram(ctx.prisma, ctx.userId);
    return getTodayProgram(ctx.prisma, ctx.userId);
  }),

  // M13: ground-truth tablebase result for an endgame position (cache-first, polite, capped
  // — §6.6/§12). Null when unavailable (> 7 pieces, no entry, or a rate-limit/network miss);
  // the endgame surface then falls back to engine-only judging.
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
