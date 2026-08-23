// Pure analysis queue selection and reconciliation math (BUILD.md §0.1, L2).
// Science constants enter through methodology parameters only (L1).
// No wall-clock or randomness here.

export interface QueueGame {
  id: string;
  playedAtMs: number | null;
  result: string | null;
}

export interface QueueThresholds {
  freshWindowMs: number;
}

/**
 * Calculate the number of game reviews needed to satisfy a budget.
 */
export function calculateTargetCount(
  budgetMinutes: number,
  avgReviewMinutes: number,
): number {
  if (avgReviewMinutes <= 0) return 1;
  return Math.max(1, Math.round(budgetMinutes / avgReviewMinutes));
}

/**
 * Calculate total used minutes from review events.
 * Missing durations fall back to the average review duration.
 */
export function calculateUsedReviewMinutes(
  events: readonly { durationSeconds?: number | null }[],
  avgReviewMinutes: number,
): number {
  let totalMinutes = 0;
  for (const event of events) {
    if (
      typeof event.durationSeconds === "number" &&
      event.durationSeconds >= 0
    ) {
      totalMinutes += event.durationSeconds / 60;
    } else {
      totalMinutes += avgReviewMinutes;
    }
  }
  return totalMinutes;
}

/**
 * Determine if an analysis block is complete.
 * Completes when target count is reached or budget minutes are met with at least one review.
 */
export function isAnalysisBlockComplete(
  completedReviews: number,
  usedMinutes: number,
  targetCount: number,
  budgetMinutes: number,
): boolean {
  if (completedReviews >= targetCount) return true;
  return completedReviews >= 1 && usedMinutes >= budgetMinutes;
}

/**
 * Partition games into fresh and older tiers, sorted by playedAt descending.
 * Games without a playedAt timestamp sort to the end of the older tier.
 */
export function selectAnalysisQueue(
  games: readonly QueueGame[],
  nowMs: number,
  thresholds: QueueThresholds,
): QueueGame[] {
  const fresh: QueueGame[] = [];
  const older: QueueGame[] = [];

  for (const game of games) {
    if (
      game.playedAtMs !== null &&
      nowMs - game.playedAtMs < thresholds.freshWindowMs &&
      nowMs >= game.playedAtMs
    ) {
      fresh.push(game);
    } else {
      older.push(game);
    }
  }

  const sortByPlayedAtDesc = (a: QueueGame, b: QueueGame) => {
    if (a.playedAtMs === null && b.playedAtMs === null) return 0;
    if (a.playedAtMs === null) return 1;
    if (b.playedAtMs === null) return -1;
    return b.playedAtMs - a.playedAtMs;
  };

  fresh.sort(sortByPlayedAtDesc);
  older.sort(sortByPlayedAtDesc);

  return [...fresh, ...older];
}
