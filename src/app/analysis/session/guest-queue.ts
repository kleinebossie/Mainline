// Guest-side guided review queue (TEMP_ANALYSIS_QUEUE_PLAN §7 item 1). The queue is
// derived, never persisted: reviewed ids come from guest activity events, candidates
// from the scanned games in the local cache. The pure core below is unit-tested; the
// thin localStorage readers around it treat storage as a boundary.

import {
  analysisPromptRungFor,
  analysisReviewThresholds,
  bandForRating,
  gameSelectionRatioFor,
  loadMethodology,
  type AnalysisPromptRung,
  type AnalysisReviewThresholds,
} from "@/methodology";
import {
  applySuccessBiasTiebreak,
  calculateTargetCount,
  calculateUsedReviewMinutes,
  selectAnalysisQueue,
} from "@/engine/interactive/analysis-queue";
import { pgnTag } from "@/integrations/pgn";
import { platformGameUrl } from "@/integrations/catalog";
import { getGuestSession, type GuestActivityEvent } from "@/lib/guest-session";
import {
  readGuestGamesCache,
  type GuestCachedGame,
} from "@/lib/guest-games";
import type {
  QueueGameView,
  QueueScanCandidate,
  ReviewQueueData,
} from "@/app/analysis/session/queue-shared";

export interface GuestQueueProgramItem {
  id: string;
  activityType: string;
  estMinutes: number;
  params: Record<string, unknown>;
  status: "pending" | "done" | "skipped";
}

function opponentFromPgn(pgn: string, color: string | null): string | null {
  const white = pgnTag(pgn, "White");
  const black = pgnTag(pgn, "Black");
  if (!color) return black ?? white ?? null;
  return color === "w" ? (black ?? null) : (white ?? null);
}

function playedAtMsOf(playedAt: string | null): number | null {
  if (!playedAt) return null;
  const ms = Date.parse(playedAt);
  return Number.isNaN(ms) ? null : ms;
}

/** Game ids the guest has already reviewed through a `game_analysed` event. */
export function reviewedGuestGameIds(
  events: readonly GuestActivityEvent[],
): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.type !== "game_analysed") continue;
    const gameId = event.payload?.gameId;
    if (typeof gameId === "string" && gameId.length > 0) ids.add(gameId);
  }
  return ids;
}

export interface GuestQueueInput {
  item: GuestQueueProgramItem;
  games: readonly GuestCachedGame[];
  events: readonly GuestActivityEvent[];
  /** Start of the program day in UTC (budget accounting window). */
  dayStartMs: number;
  nowMs: number;
  avgReviewMinutes: number;
  thresholds: AnalysisReviewThresholds;
  winShareTarget: number | null;
  /** Assigns the prompt rung by game age; injected so the core stays config-free. */
  promptRungOf: (gameAgeMs: number | null) => AnalysisPromptRung;
}

/** Pure derivation of the guest review queue. Same math as the server procedure. */
export function buildGuestQueueData(input: GuestQueueInput): ReviewQueueData {
  const { item, games, events, dayStartMs, nowMs } = input;
  const budgetMinutes =
    (typeof item.params.budgetMinutes === "number" &&
    item.params.budgetMinutes > 0
      ? item.params.budgetMinutes
      : null) ?? Math.max(1, Math.round(item.estMinutes));
  const targetCount = calculateTargetCount(
    budgetMinutes,
    input.avgReviewMinutes,
  );

  const todayReviews = events.filter(
    (event) =>
      event.type === "game_analysed" &&
      Date.parse(event.occurredAt) >= dayStartMs,
  );
  const completedReviews = todayReviews.length;
  const usedMinutes = calculateUsedReviewMinutes(
    todayReviews.map((event) => ({
      durationSeconds:
        typeof event.payload?.durationSeconds === "number"
          ? event.payload.durationSeconds
          : null,
    })),
    input.avgReviewMinutes,
  );

  const reviewed = reviewedGuestGameIds(events);
  const scannedUnreviewed = games.filter(
    (game) => game.analyzed && !reviewed.has(game.id),
  );
  let ordered = selectAnalysisQueue(
    scannedUnreviewed.map((game) => ({
      id: game.id,
      playedAtMs: playedAtMsOf(game.playedAt),
      result: game.result ?? null,
    })),
    nowMs,
    input.thresholds,
  );
  // Success-bias ratio breaks ties between same-day games (locked decision 2).
  if (input.winShareTarget !== null) {
    ordered = applySuccessBiasTiebreak(ordered, input.winShareTarget);
  }
  const byId = new Map(scannedUnreviewed.map((game) => [game.id, game]));

  const budgetRemains =
    completedReviews < targetCount &&
    !(completedReviews >= 1 && usedMinutes >= budgetMinutes);

  // Tier 3: when nothing scanned is left and the budget still allows work, offer to
  // scan the most recent unscanned game.
  let scanCandidate: QueueScanCandidate | null = null;
  if (ordered.length === 0 && budgetRemains) {
    const candidate = games
      .filter((game) => !game.analyzed)
      .sort((a, b) => {
        const aMs = playedAtMsOf(a.playedAt);
        const bMs = playedAtMsOf(b.playedAt);
        if (aMs === null && bMs === null) return 0;
        if (aMs === null) return 1;
        if (bMs === null) return -1;
        return bMs - aMs;
      })[0];
    if (candidate) {
      scanCandidate = {
        id: candidate.id,
        playedAt: candidate.playedAt,
        result: candidate.result ?? null,
        opponent: candidate.opponent ?? opponentFromPgn(candidate.pgn, candidate.color ?? null),
      };
    }
  }

  return {
    budgetMinutes,
    usedMinutes,
    completedReviews,
    targetCount,
    games: ordered.flatMap((queued): QueueGameView[] => {
      const game = byId.get(queued.id);
      if (!game) return [];
      return [
        {
          id: game.id,
          playedAt: game.playedAt,
          color: game.color ?? null,
          result: game.result ?? null,
          timeControl: game.timeControl ?? null,
          opening: game.opening ?? null,
          opponent:
            game.opponent ??
            opponentFromPgn(game.pgn, game.color ?? null),
          opponentRating: game.opponentRating ?? null,
          platform: game.platform,
          externalGameId: game.id,
          promptRung: input.promptRungOf(
            playedAtMsOf(game.playedAt) === null
              ? null
              : nowMs - playedAtMsOf(game.playedAt)!,
          ),
          externalUrl: platformGameUrl(game.platform, game.id),
        },
      ];
    }),
    scanCandidate,
  };
}

/**
 * Derive this guest's queue from localStorage for one program item. Returns null when
 * the item does not exist locally or is not an analyse block.
 */
export function deriveGuestQueue(
  programItemId: string,
  nowMs: number,
): ReviewQueueData | null {
  const session = getGuestSession();
  const item = session.program?.items.find((it) => it.id === programItemId);
  if (!item || item.activityType !== "analyse") return null;

  const cfg = loadMethodology();
  const analyseActivity = cfg.activities.find(
    (a) => a.id === "analyse_own_games",
  );
  const avgReviewMinutes = analyseActivity?.estMinutes.value;
  if (!avgReviewMinutes || avgReviewMinutes <= 0) {
    return {
      budgetMinutes: 0,
      usedMinutes: 0,
      completedReviews: 0,
      targetCount: 0,
      games: [],
      scanCandidate: null,
    };
  }

  const scheduledDate = session.program?.scheduledDate
    ? Date.parse(session.program.scheduledDate)
    : nowMs;
  const day = new Date(scheduledDate);
  const dayStartMs = Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
  );

  const baseline = session.baseline;
  const band = bandForRating(
    baseline?.tacticalRatingEstimate ?? cfg.assessment.calibration.startRating.value,
    cfg,
  );
  const ratio = gameSelectionRatioFor(band, cfg);

  return buildGuestQueueData({
    item: {
      id: item.id,
      activityType: item.activityType,
      estMinutes: item.estMinutes,
      params: item.params,
      status: item.status,
    },
    games: readGuestGamesCache(),
    events: session.activityEvents,
    dayStartMs,
    nowMs,
    avgReviewMinutes,
    thresholds: analysisReviewThresholds(cfg),
    winShareTarget: ratio ? ratio.winPct / 100 : null,
    promptRungOf: (ageMs) => analysisPromptRungFor(ageMs, cfg),
  });
}

/** True while any unreviewed cached game is younger than the fresh window (nudge). */
export function guestHasFreshUnreviewed(nowMs: number): boolean {
  const session = getGuestSession();
  const reviewed = reviewedGuestGameIds(session.activityEvents);
  const thresholds = analysisReviewThresholds(loadMethodology());
  return readGuestGamesCache().some((game) => {
    if (reviewed.has(game.id)) return false;
    const playedMs = playedAtMsOf(game.playedAt);
    return (
      playedMs !== null &&
      nowMs >= playedMs &&
      nowMs - playedMs < thresholds.freshWindowMs
    );
  });
}
