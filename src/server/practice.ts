// Blunder-drill orchestration (BUILD.md M12). The graded DECISIONS live in the pure engine
// (deriveBlunderDrills) + the methodology (the blunder threshold, the FSRS step); this module
// only gathers state, calls them, and persists (L1: server orchestrates, never decides). The
// injected Clock keeps it reproducible (L2) — the router passes the system clock, tests a
// fixed one.

import type { Prisma, PrismaClient } from "@prisma/client";

import { deriveBlunderDrills } from "@/engine/interactive/blunder-drill";
import {
  loadMethodology,
  scheduleReview,
  type Band,
  type MethodologyConfig,
} from "@/methodology";
import { upsertPracticeItem } from "@/db/practice";
import { findScheduleStates, upsertScheduleState } from "@/db/tracker";
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

type EndgameDb = Pick<PrismaClient, "practiceItem" | "scheduleState">;

/**
 * Seed the band's curated endgame curriculum (Seam-4 config, M13) as personal PracticeItems
 * + FSRS schedules, so they surface in `/today` as `endgame_drill` items (due-gated like
 * blunder drills). Idempotent: re-generation re-uses the same positions (unique sourceRef
 * `endgame:<id>`) and never resets a drill already moving through the FSRS queue. New drills
 * are seeded due NOW so they reach the next session, then space out as the user replays them.
 *
 * The curriculum (which endgames, win or hold) is the methodology's call (config); this only
 * gathers + persists (L1). Pure decisions stay in the provider; reproducible via the Clock (L2).
 */
export async function ensureEndgameDrills(
  db: EndgameDb,
  userId: string,
  band: Band,
  cfg: MethodologyConfig,
  clock: Clock = systemClock,
): Promise<{ created: number }> {
  const positions = cfg.endgameCurriculum.positionsByBand[band] ?? [];
  if (positions.length === 0) return { created: 0 };

  const now = clock.now();
  let created = 0;
  for (const pos of positions) {
    const item = await upsertPracticeItem(db, {
      userId,
      kind: "endgame",
      fen: pos.fen,
      // An endgame is PLAYED OUT vs the engine — there is no fixed solution line; the
      // objective + scoring live in config + the engine scorer, not on this row.
      solutionLine: [],
      sourceRef: `endgame:${pos.id}`,
      methodologyKey: pos.id,
    });

    const existing = await findScheduleStates(db, userId, [
      { itemType: "endgame", itemRef: item.id },
    ]);
    if (existing.length > 0) continue;

    // Curated learning items (not failures) → seed as Grade 3 (Good) but force due NOW so the
    // drill appears in the first session; subsequent reviews space out via FSRS.
    const { newState } = scheduleReview(
      { grade: 3, fsrsState: null, now },
      cfg,
    );
    await upsertScheduleState(db, {
      userId,
      itemRef: item.id,
      itemType: "endgame",
      fsrsState: newState as unknown as Prisma.InputJsonValue,
      due: new Date(now),
      lastGrade: 3,
      source: "drill",
    });
    created++;
  }

  return { created };
}
