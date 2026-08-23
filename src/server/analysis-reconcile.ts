// Reconciles pending today-program analysis blocks with recorded reviews.
// Completes blocks path-independently when target count or budget is reached.

import type { PrismaClient } from "@prisma/client";

import type { MethodologyConfig } from "@/methodology";
import type { Clock } from "@/lib/clock";
import {
  calculateTargetCount,
  calculateUsedReviewMinutes,
  isAnalysisBlockComplete,
} from "@/engine/interactive/analysis-queue";
import { GAME_ANALYSED_ACTIVITY_EVENT_TYPE } from "@/lib/tracker";
import { completeProgramItem } from "@/server/tracker";
import { ExpectedError } from "@/server/errors";

export type ReconcileDb = Pick<
  PrismaClient,
  | "activityEvent"
  | "notificationPref"
  | "programItem"
  | "rewardEvent"
  | "$transaction"
>;

export interface ReconcilableProgramItem {
  id: string;
  activityType: string;
  status: string;
  params: unknown;
  estMinutes?: number | null;
}

export interface ReconcilableProgram {
  id: string;
  scheduledDate: Date;
  items: ReconcilableProgramItem[];
}

/**
 * Reconcile pending analysis program items for today against recorded reviews.
 * If review count or duration requirements are met, complete the program item.
 * Mutates `item.status` in-place so downstream callers see the updated status.
 */
export async function reconcileAnalysisItems(
  db: ReconcileDb,
  userId: string,
  program: ReconcilableProgram,
  cfg: MethodologyConfig,
  clock: Clock,
): Promise<void> {
  const pendingAnalyseItems = program.items.filter(
    (item) => item.activityType === "analyse" && item.status === "pending",
  );
  if (pendingAnalyseItems.length === 0) return;

  const analyseActivity = cfg.activities.find(
    (a) => a.activityType === "analyse" || a.id === "analyse_own_games",
  );
  const avgReviewMinutes = analyseActivity?.estMinutes?.value;
  if (!avgReviewMinutes || avgReviewMinutes <= 0) return;

  const scheduledDate = program.scheduledDate;
  const startOfDayUTC = new Date(
    Date.UTC(
      scheduledDate.getUTCFullYear(),
      scheduledDate.getUTCMonth(),
      scheduledDate.getUTCDate(),
    ),
  );

  const events = await db.activityEvent.findMany({
    where: {
      userId,
      type: GAME_ANALYSED_ACTIVITY_EVENT_TYPE,
      occurredAt: { gte: startOfDayUTC },
    },
    select: { payload: true },
  });

  const durations = events.map((event) => {
    if (
      event.payload &&
      typeof event.payload === "object" &&
      "durationSeconds" in event.payload &&
      typeof (event.payload as { durationSeconds?: unknown })
        .durationSeconds === "number"
    ) {
      return {
        durationSeconds: (event.payload as { durationSeconds: number })
          .durationSeconds,
      };
    }
    return { durationSeconds: null };
  });

  const completedReviews = events.length;
  const usedMinutes = calculateUsedReviewMinutes(durations, avgReviewMinutes);

  for (const item of pendingAnalyseItems) {
    const rawParams = (
      item.params && typeof item.params === "object" ? item.params : {}
    ) as Record<string, unknown>;

    const budgetMinutes =
      (typeof rawParams.budgetMinutes === "number"
        ? rawParams.budgetMinutes
        : null) ??
      (typeof rawParams.estMinutes === "number"
        ? rawParams.estMinutes
        : null) ??
      item.estMinutes ??
      avgReviewMinutes;

    const targetCount = calculateTargetCount(budgetMinutes, avgReviewMinutes);

    if (
      isAnalysisBlockComplete(
        completedReviews,
        usedMinutes,
        targetCount,
        budgetMinutes,
      )
    ) {
      try {
        await completeProgramItem(
          db,
          userId,
          {
            requestId: crypto.randomUUID(),
            programItemId: item.id,
          },
          clock,
        );
        item.status = "done";
      } catch (error) {
        if (error instanceof ExpectedError && error.code === "CONFLICT") {
          item.status = "done";
          continue;
        }
        throw error;
      }
    }
  }
}
