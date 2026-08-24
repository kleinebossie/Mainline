// Guest review-queue derivation (TEMP_ANALYSIS_QUEUE_PLAN §7 item 1). Pins the pure
// core: reviewed-id extraction, tier ordering, budget accounting, and the tier-3 scan
// candidate. No storage access — the localStorage readers are thin glue around this.

import { describe, expect, it } from "vitest";

import { buildGuestQueueData, reviewedGuestGameIds } from "@/app/analysis/session/guest-queue";
import type { GuestActivityEvent } from "@/lib/guest-session";
import type { GuestCachedGame } from "@/lib/guest-games";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const NOW = 1_700_000_000_000;
const DAY_START = NOW - 2 * HOUR_MS;

function game(partial: Partial<GuestCachedGame> & { id: string }): GuestCachedGame {
  return {
    platform: "chesscom",
    playedAt: null,
    color: "w",
    result: "win",
    pgn: '[White "Me"]\n[Black "Rival"]\n',
    analyzed: false,
    ...partial,
  };
}

function reviewedEvent(gameId: string, occurredAtMs = NOW): GuestActivityEvent {
  return {
    id: `ev-${gameId}`,
    type: "game_analysed",
    occurredAt: new Date(occurredAtMs).toISOString(),
    payload: { gameId, durationSeconds: 600 },
  };
}

const baseInput = {
  item: {
    id: "guest_item_4_analyse_own_games",
    activityType: "analyse",
    estMinutes: 15,
    params: {},
    status: "pending" as const,
  },
  events: [] as GuestActivityEvent[],
  dayStartMs: DAY_START,
  nowMs: NOW,
  avgReviewMinutes: 15,
  thresholds: { freshWindowMs: DAY_MS, recentWindowMs: 7 * DAY_MS },
  winShareTarget: null,
  promptRungOf: (ageMs: number | null) =>
    ageMs === null || ageMs >= DAY_MS ? ("old" as const) : ("fresh" as const),
};

describe("reviewedGuestGameIds", () => {
  it("collects game ids from game_analysed events only", () => {
    const ids = reviewedGuestGameIds([
      reviewedEvent("g1"),
      {
        id: "ev-2",
        type: "drill_done",
        occurredAt: new Date(NOW).toISOString(),
        payload: { gameId: "g2" },
      },
      {
        id: "ev-3",
        type: "game_analysed",
        occurredAt: new Date(NOW).toISOString(),
        payload: {},
      },
    ]);
    expect(ids).toEqual(new Set(["g1"]));
  });
});

describe("buildGuestQueueData", () => {
  it("orders scanned unreviewed games fresh first and skips reviewed ones", () => {
    const data = buildGuestQueueData({
      ...baseInput,
      games: [
        game({ id: "old", playedAt: new Date(NOW - 3 * DAY_MS).toISOString(), analyzed: true }),
        game({ id: "fresh", playedAt: new Date(NOW - HOUR_MS).toISOString(), analyzed: true }),
        game({ id: "reviewed", playedAt: new Date(NOW - HOUR_MS).toISOString(), analyzed: true }),
        game({ id: "unscanned", analyzed: false }),
      ],
      events: [reviewedEvent("reviewed")],
    });

    expect(data.games.map((g) => g.id)).toEqual(["fresh", "old"]);
    expect(data.completedReviews).toBe(1);
    expect(data.usedMinutes).toBe(10);
    expect(data.targetCount).toBe(1);
    // The block already meets its count target, so no scan candidate is offered.
    expect(data.scanCandidate).toBeNull();
  });

  it("offers the most recent unscanned game when nothing scanned is left (tier 3)", () => {
    const data = buildGuestQueueData({
      ...baseInput,
      item: { ...baseInput.item, params: { budgetMinutes: 30 } },
      games: [
        game({ id: "older-unscanned", analyzed: false, playedAt: new Date(NOW - 5 * DAY_MS).toISOString() }),
        game({ id: "recent-unscanned", analyzed: false, playedAt: new Date(NOW - 2 * DAY_MS).toISOString() }),
      ],
      events: [],
    });

    expect(data.games).toHaveLength(0);
    expect(data.completedReviews).toBe(0);
    expect(data.scanCandidate?.id).toBe("recent-unscanned");
  });

  it("offers no scan candidate once the budget is spent", () => {
    const data = buildGuestQueueData({
      ...baseInput,
      games: [game({ id: "unscanned", analyzed: false })],
      events: [reviewedEvent("spent", NOW - HOUR_MS)],
    });

    expect(data.completedReviews).toBe(1);
    expect(data.scanCandidate).toBeNull();
  });

  it("counts missing durations at the average and ignores reviews before the program day", () => {
    const data = buildGuestQueueData({
      ...baseInput,
      games: [],
      events: [
        {
          id: "ev-old",
          type: "game_analysed",
          occurredAt: new Date(DAY_START - 1).toISOString(),
          payload: { gameId: "gone" },
        },
        {
          id: "ev-today",
          type: "game_analysed",
          occurredAt: new Date(DAY_START + 1000).toISOString(),
          payload: { gameId: "today" },
        },
      ],
    });

    expect(data.completedReviews).toBe(1);
    expect(data.usedMinutes).toBe(15); // fallback to the average
  });

  it("assigns prompt rungs by age through the injected function", () => {
    const data = buildGuestQueueData({
      ...baseInput,
      games: [
        game({ id: "fresh-game", analyzed: true, playedAt: new Date(NOW - HOUR_MS).toISOString() }),
      ],
    });
    expect(data.games[0]?.promptRung).toBe("fresh");
    expect(data.games[0]?.opponent).toBe("Rival");
    expect(data.games[0]?.externalUrl).toContain("chess.com/game/live/");
  });
});
