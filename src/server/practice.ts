// Persists personal practice items and schedules. Engine and methodology own decisions.
// Schedule seeding uses an injected clock for reproducibility.

import type { Prisma, PrismaClient } from "@prisma/client";

import { deriveBlunderDrills } from "@/engine/interactive/blunder-drill";
import {
  gradeFromOutcome,
  loadMethodology,
  newItemScheduleGrade,
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

/** Client-resolved source for a personal blunder drill. */
export interface BlunderDrillInputItem {
  ply: number;
  fen: string;
  bestUci: string;
  cpLoss: number;
}

/** Re-reviewing a game reuses source refs and preserves existing review progress. */
export async function createBlunderDrillsFromGame(
  db: Db,
  userId: string,
  input: { gameId: string; drills: readonly BlunderDrillInputItem[] },
  clock: Clock = systemClock,
): Promise<{ created: number }> {
  const owns = await userOwnsGame(db, userId, input.gameId);
  if (!owns) throw new Error("Unauthorized");

  const cfg = loadMethodology();
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

    // Never reset an existing review schedule.
    const existing = await findScheduleStates(db, userId, [
      { itemType: "blunder_drill", itemRef: item.id },
    ]);
    if (existing.length > 0) continue;

    const grade = gradeFromOutcome({ correct: false }, cfg);
    const { newState } = scheduleReview({ grade, fsrsState: null, now }, cfg);
    await upsertScheduleState(db, {
      userId,
      itemRef: item.id,
      itemType: "blunder_drill",
      fsrsState: newState as unknown as Prisma.InputJsonValue,
      due: new Date(now),
      lastGrade: grade,
      source: "drill",
    });
    created++;
  }

  return { created };
}

type EndgameDb = Pick<PrismaClient, "practiceItem" | "scheduleState">;

/** Reuse curated position source refs and preserve existing review progress. */
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
      // Endgames are played out, so they have no fixed solution line.
      solutionLine: [],
      sourceRef: `endgame:${pos.id}`,
      methodologyKey: pos.id,
    });

    const existing = await findScheduleStates(db, userId, [
      { itemType: "endgame", itemRef: item.id },
    ]);
    if (existing.length > 0) continue;

    const grade = newItemScheduleGrade(cfg);
    const { newState } = scheduleReview({ grade, fsrsState: null, now }, cfg);
    await upsertScheduleState(db, {
      userId,
      itemRef: item.id,
      itemType: "endgame",
      fsrsState: newState as unknown as Prisma.InputJsonValue,
      due: new Date(now),
      lastGrade: grade,
      source: "drill",
    });
    created++;
  }

  return { created };
}
