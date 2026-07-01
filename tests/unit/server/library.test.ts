import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { buildLibrary, getResourceProgress } from "@/server/library";
import { loadMethodology } from "@/methodology/loader";
import { bandForRating } from "@/methodology/provider";

// M14 server orchestration: buildLibrary assembles the deliberately-external layer from the
// pure providers (graded books with the block rule applied, the protocol, the modality split
// gated by play medium), and getResourceProgress rolls up the immutable book_session log into
// the derived ResourceProgress (no table, no migration). Pinned to stub-0.1.0.
const cfg = loadMethodology("stub-0.1.0");
const u800 = bandForRating(500, cfg);
const b1600 = bandForRating(1800, cfg);

describe("buildLibrary (Seam 4 §4.2–4.4)", () => {
  it("blocks low-band overload books and surfaces only tactics for beginners", () => {
    const view = buildLibrary(
      { band: u800, targetFocus: "online", ownedRefs: [], progress: [] },
      cfg,
    );
    expect(view.books.length).toBeGreaterThan(0);
    for (const b of view.books) expect(b.category).toBe("tactics");
    // Each book carries its graded "why" + a resolved source (L3).
    for (const b of view.books) {
      expect(["A", "B", "C", "D"]).toContain(b.evidenceGrade);
      expect(b.citationSource).not.toBeNull();
    }
  });

  it("gates physical-board / OTB guidance by the user's play medium", () => {
    const online = buildLibrary(
      { band: b1600, targetFocus: "online", ownedRefs: [], progress: [] },
      cfg,
    );
    expect(online.modality.surfacePhysical).toBe(false);

    const otb = buildLibrary(
      { band: b1600, targetFocus: "otb", ownedRefs: [], progress: [] },
      cfg,
    );
    expect(otb.modality.surfacePhysical).toBe(true);
    expect(otb.modality.otbCadence.length).toBeGreaterThan(0);
    expect(otb.modality.split.text.length).toBeGreaterThan(0);
    expect(otb.modality.otb.text.length).toBeGreaterThan(0);
  });

  it("surfaces the graded book-study protocol (active recall / 85% / Woodpecker)", () => {
    const view = buildLibrary(
      { band: b1600, targetFocus: "online", ownedRefs: [], progress: [] },
      cfg,
    );
    expect(view.protocol.activeRecall.text.length).toBeGreaterThan(0);
    expect(view.protocol.calibration.targetPct).toBe(85);
    expect(view.protocol.woodpecker.cycles.length).toBeGreaterThan(0);
    // The Woodpecker copy is graded honestly (B/1) — never a rating promise.
    expect(["A", "B", "C", "D"]).toContain(view.protocol.woodpecker.grade);
  });

  it("marks owned books and passes progress through", () => {
    const target = buildLibrary(
      { band: b1600, targetFocus: "online", ownedRefs: [], progress: [] },
      cfg,
    ).books[0]!;
    const view = buildLibrary(
      {
        band: b1600,
        targetFocus: "online",
        ownedRefs: [target.title],
        progress: [
          {
            resourceRefId: target.id,
            title: target.title,
            studyUnit: target.studyUnit,
            position: { chapter: 2 },
            lastSuccessRate: 0.8,
            woodpeckerCycle: null,
            sessions: 3,
            totalMinutes: 75,
            lastSessionAt: 1,
          },
        ],
      },
      cfg,
    );
    expect(view.books.find((b) => b.id === target.id)?.owned).toBe(true);
    expect(view.progress).toHaveLength(1);
    expect(view.progress[0]!.sessions).toBe(3);
  });
});

describe("getResourceProgress (ResourceProgress roll-up §5.5)", () => {
  const ev = (at: number, payload: unknown) => ({
    occurredAt: new Date(at),
    payload,
  });
  const fakeDb = (rows: ReturnType<typeof ev>[]) =>
    ({
      activityEvent: { findMany: async () => rows },
    }) as unknown as Pick<PrismaClient, "activityEvent">;

  it("rolls up the latest position/success/cycle and totals, newest first", async () => {
    const rows = [
      ev(1000, {
        resourceRefId: "silman_reassess_your_chess",
        durationMin: 20,
        position: { chapter: 1 },
        selfReport: { successRate: 0.7 },
      }),
      ev(2000, {
        resourceRefId: "silman_reassess_your_chess",
        durationMin: 25,
        position: { chapter: 3 },
        selfReport: { successRate: 0.85, woodpeckerCycle: 2 },
      }),
      ev(1500, {
        resourceRefId: "smith_tikkanen_woodpecker",
        durationMin: 15,
        selfReport: { successRate: 0.9, woodpeckerCycle: 1 },
      }),
    ];
    const out = await getResourceProgress(fakeDb(rows), "u1", cfg);

    expect(out).toHaveLength(2);
    // Sorted newest-first: the Reassess book's last session (t=2000) leads.
    const reassess = out[0]!;
    expect(reassess.resourceRefId).toBe("silman_reassess_your_chess");
    expect(reassess.title).toBe("How to Reassess Your Chess (4th ed.)");
    expect(reassess.sessions).toBe(2);
    expect(reassess.totalMinutes).toBe(45);
    expect(reassess.position?.chapter).toBe(3); // latest wins
    expect(reassess.lastSuccessRate).toBe(0.85);
    expect(reassess.woodpeckerCycle).toBe(2);
  });

  it("ignores events without a resourceRefId", async () => {
    const out = await getResourceProgress(
      fakeDb([ev(1000, { selfReport: { successRate: 0.8 } })]),
      "u1",
      cfg,
    );
    expect(out).toEqual([]);
  });
});
