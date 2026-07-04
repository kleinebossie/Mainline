import { describe, expect, it } from "vitest";

import { Chess } from "chess.js";
import { fixedClock } from "@/lib/clock";
import { loadMethodology } from "@/methodology/loader";
import { generateProgram } from "@/engine/generator";

// M13 — the endgame curriculum is Seam-4 CONFIG (graded data), not engine code (L1), and the
// endgame_drill activity is due-gated like a blunder drill: it surfaces only when a curated
// endgame position is due (itemType "endgame"). These tests pin both ends.
const cfg = loadMethodology("stub-0.1.0");
const clock = fixedClock(1_700_000_000_000);
const bandIds = cfg.bands.map((b) => b.id);

describe("endgame curriculum (Seam-4 config)", () => {
  it("covers every band with curated positions", () => {
    for (const id of bandIds) {
      expect(cfg.endgameCurriculum.positionsByBand[id]).toBeDefined();
    }
  });

  it("every curated position is a legal, in-play FEN with a graded objective", () => {
    for (const positions of Object.values(
      cfg.endgameCurriculum.positionsByBand,
    )) {
      for (const pos of positions) {
        // Legal and not already over (a real drill to play out).
        const c = new Chess(pos.fen);
        expect(c.isGameOver()).toBe(false);
        // The objective is a graded leaf (L3): it carries grade + tier + citation.
        expect(["win", "draw"]).toContain(pos.objective.value);
        expect(["A", "B", "C", "D"]).toContain(pos.objective.grade);
        expect(pos.objective.citationKey.length).toBeGreaterThan(0);
      }
    }
  });

  it("ships an internal endgame_drill activity + a weakness rule that targets it", () => {
    const drill = cfg.activities.find((a) => a.id === "endgame_drill");
    expect(drill).toBeDefined();
    expect(drill?.activityType).toBe("endgame_drill");
    expect(drill?.delivery.value).toBe("internal");
    expect(drill?.dimensions).toContain("endgames");

    const rule = cfg.weaknessResourceRules.find(
      (r) => r.activityId === "endgame_drill",
    );
    expect(rule?.dimension).toBe("endgames");
  });
});

describe("generateProgram — endgame_drill due-gating", () => {
  const base = {
    band: "b1600_2000",
    tacticalRating: 1800,
    weaknessSignals: [],
    constraints: { minutesPerDay: 60 },
    clock,
    config: cfg,
  } as const;

  it("omits endgame_drill when no endgame position is due", () => {
    const { items } = generateProgram({ ...base, dueItems: [] });
    expect(
      items.find((i) => i.activityType === "endgame_drill"),
    ).toBeUndefined();
  });

  it("surfaces endgame_drill carrying the due endgame refs when one is due", () => {
    const { items } = generateProgram({
      ...base,
      dueItems: [{ itemRef: "pi-endgame-1", itemType: "endgame" }],
    });
    const eg = items.find((i) => i.activityType === "endgame_drill");
    expect(eg).toBeDefined();
    expect(eg?.params.dueItemRefs).toContain("pi-endgame-1");
    expect(eg?.estMinutes).toBe(15);
    expect(eg?.dimensionsTargeted).toContain("endgames");
  });
});
