// Blunder-drill orchestration (BUILD.md M12). The graded DECISIONS live in the pure engine
// (deriveBlunderDrills) + the methodology (the blunder threshold, the FSRS step); this module
// only gathers state, calls them, and persists (L1: server orchestrates, never decides). The
// injected Clock keeps it reproducible (L2) — the router passes the system clock, tests a
// fixed one.

import type { Prisma, PrismaClient } from "@prisma/client";

import { deriveBlunderDrills } from "@/engine/interactive/blunder-drill";
import { loadMethodology, scheduleReview } from "@/methodology";
import { upsertPracticeItem } from "@/db/practice";
import {
  findScheduleStates,
  upsertScheduleState,
} from "@/db/tracker";
import { userOwnsGame } from "@/db/analysis";
import { systemClock, type Clock } from "@/lib/clock";

type Db = Pick<
  PrismaClient,
  "practiceItem" | "scheduleState" | "importedGame" | "analysisResult"
>;

/** One blundered position the client resolved (the FEN it faced + the engine's best move,
 *  computed client-side) — the raw material a drill is built from. */
export interface BlunderDrillInputItem {
  ply: number;
  fen: string;
  /** The engine's best move here, UCI (computed by client-side Stockfish). */
  bestUci: string;
  cpLoss: number;
}

/**
 * Derive personal blunder drills from one of the user's games and persist them as spaced
 * PracticeItems. Idempotent: re-reviewing a game re-derives the same drills (unique sourceRef)
 * and never resets a drill already moving through the FSRS queue. New drills are seeded due
 * immediately (so they reach the next /today) and then space out as the user re-solves them.
 */
export async function createBlunderDrillsFromGame(
  db: Db,
  userId: string,
  input: { gameId: string; drills: readonly BlunderDrillInputItem[] },
  clock: Clock = systemClock,
): Promise<{ created: number }> {
  const owns = await userOwnsGame(db, userId, input.gameId);
  if (!owns) throw new Error("Unauthorized");

  const cfg = loadMethodology();
  // The severity floor is the methodology's blunder threshold (Seam 3) — the engine takes the
  // number, never owns it (L1).
  const minCpLoss = cfg.interpretation.thresholds.blunderCpLoss.value;

  const drafts = deriveBlunderDrills(
    {
      gameId: input.gameId,
      blunders: input.drills.map((d) => ({
        ply: d.ply,
        fen: d.fen,
        cpLoss: d.cpLoss,
      })),
      bestMoveByPly: Object.fromEntries(
        input.drills.map((d) => [d.ply, d.bestUci]),
      ),
    },
    { minCpLoss },
  );

  const now = clock.now();
  let created = 0;
  for (const draft of drafts) {
    const item = await upsertPracticeItem(db, {
      userId,
      kind: draft.kind,
      fen: draft.fen,
      solutionLine: draft.solutionLine,
      sourceRef: draft.sourceRef,
    });

    // Don't reset a drill already in the FSRS queue (preserve its spaced progress). Only seed
    // a schedule for a brand-new drill.
    const existing = await findScheduleStates(db, userId, [
      { itemType: "blunder_drill", itemRef: item.id },
    ]);
    if (existing.length > 0) continue;

    // Seed as a fresh lapse (Again) — these are positions the user just got wrong — but due
    // NOW so the drill surfaces in the next session; subsequent reviews space out via FSRS.
    const { newState } = scheduleReview(
      { grade: 1, fsrsState: null, now },
      cfg,
    );
    await upsertScheduleState(db, {
      userId,
      itemRef: item.id,
      itemType: "blunder_drill",
      fsrsState: newState as unknown as Prisma.InputJsonValue,
      due: new Date(now),
      lastGrade: 1,
      source: "drill",
    });
    created++;
  }

  return { created };
}
