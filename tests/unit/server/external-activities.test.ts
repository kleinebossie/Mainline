import { describe, expect, it } from "vitest";

import { toTodayItem } from "@/server/program";
import { loadMethodology } from "@/methodology/loader";

// M14 — the deliberately-external layer must stay external. `toTodayItem` resolves a
// `play_games` activity to a one-click deep-link out to the user's platform, NEVER an internal
// /train route (game-play is not internalised; M2 import picks up the result). A `book`
// activity is external too (content is never hosted). Pinned to stub-0.1.0.
const cfg = loadMethodology("stub-0.1.0");
const dimLabels = new Map(cfg.dimensions.map((d) => [d.id, d.label]));
const ledger = new Map(cfg.evidenceLedger.map((a) => [a.key, a.source]));

type Item = Parameters<typeof toTodayItem>[0];

function item(overrides: Partial<Item>): Item {
  return {
    id: "i1",
    orderIndex: 0,
    activityId: "play_games",
    activityType: "play_game",
    resourceRef: null,
    params: { theme: null, track: null },
    dimensionsTargeted: [],
    rationaleKey: "play_games",
    rationaleText: "why",
    evidenceGrade: "B",
    evidenceTier: 1,
    citationKey: "howard2012",
    confidence: "low",
    soften: false,
    status: "pending",
    ...overrides,
  } as Item;
}

describe("toTodayItem — external activities stay external (M14)", () => {
  it("play_games resolves to a platform deep-link, never an internal /train route", () => {
    const t = toTodayItem(item({}), cfg, dimLabels, ledger, "lichess");
    expect(t.delivery).toBe("external");
    expect(t.externalUrl).toBe("https://lichess.org/");
    expect(t.url).toBe("https://lichess.org/");
    expect(t.url ?? "").not.toContain("/train");
    expect(t.externalLabel).toMatch(/Lichess/);
  });

  it("play_games points at chess.com when that is the user's platform", () => {
    const t = toTodayItem(item({}), cfg, dimLabels, ledger, "chesscom");
    expect(t.url).toBe("https://www.chess.com/play/online");
    expect(t.url ?? "").not.toContain("/train");
  });

  it("the book activity is external (content is never hosted) and not a /train route", () => {
    const t = toTodayItem(
      item({ id: "b1", activityId: "book_study", activityType: "book" }),
      cfg,
      dimLabels,
      ledger,
      "lichess",
    );
    expect(t.delivery).toBe("external");
    expect(t.url ?? "").not.toContain("/train");
  });
});
