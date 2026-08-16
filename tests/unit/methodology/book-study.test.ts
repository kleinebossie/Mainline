import { describe, expect, it } from "vitest";

import { loadMethodology } from "@/methodology/loader";
import {
  bandForRating,
  bookDifficultyFeedback,
  nextAssignedBookChapter,
  recommendBooks,
  woodpeckerSchedule,
} from "@/methodology/provider";

// Golden tests for the Seam-4 §4.2–4.3 book-study layer (M14): the per-band recommendation
// lookup applies the cognitive-load block rule (low-band strategy/opening books suppressed),
// every recommendation is graded (L3), and the Woodpecker-cycle intervals + the 85%-rule
// verdict derive deterministically from config (L1/L2). Pinned to research-1.3.0.
const cfg = loadMethodology("research-1.3.0");
const u800 = bandForRating(500, cfg);
const b1200 = bandForRating(1400, cfg);
const b1600 = bandForRating(1800, cfg);

describe("recommendBooks (Seam 4 §4.3)", () => {
  it("suppresses strategy/opening (and more) books for beginners (cognitive-load rule)", () => {
    const recs = recommendBooks({ band: u800 }, cfg);
    expect(recs.length).toBeGreaterThan(0);
    // Beginners get tactics-only: no strategy, opening, calculation, or games books.
    for (const r of recs) expect(r.category).toBe("tactics");
    expect(recs.map((r) => r.category)).not.toContain("strategy");
    expect(recs.map((r) => r.category)).not.toContain("opening");
  });

  it("suppresses opening books at 1200–1600 but allows strategy + endgame", () => {
    const recs = recommendBooks({ band: b1200 }, cfg);
    const cats = recs.map((r) => r.category);
    expect(cats).not.toContain("opening");
    expect(cats).toContain("strategy");
    expect(cats).toContain("endgame");
  });

  it("does not block any category at 1600–2000", () => {
    const recs = recommendBooks({ band: b1600 }, cfg);
    // The full configured catalog is returned (nothing blocked at this band).
    expect(recs.length).toBe(cfg.bookStudy.catalogByBand[b1600]!.length);
  });

  it("carries graded evidence on every recommendation (L3)", () => {
    for (const r of recommendBooks({ band: b1600 }, cfg)) {
      expect(["A", "B", "C", "D"]).toContain(r.evidenceGrade);
      expect([1, 2]).toContain(r.evidenceTier);
      expect(r.citationKey.length).toBeGreaterThan(0);
      expect(r.why.length).toBeGreaterThan(0);
    }
  });

  it("flags books the user already owns (prefer what they can use)", () => {
    const recs = recommendBooks({ band: b1600 }, cfg);
    const target = recs[0]!;
    const owned = recommendBooks(
      { band: b1600, ownedRefs: [target.title] },
      cfg,
    );
    expect(owned.find((r) => r.id === target.id)?.owned).toBe(true);
    // A book the user does not own is not flagged.
    expect(recommendBooks({ band: b1600 }, cfg).every((r) => !r.owned)).toBe(
      true,
    );
  });
});

describe("woodpeckerSchedule (Seam 4 §4.2)", () => {
  it("derives the shrinking-interval cycle plan deterministically", () => {
    const w = woodpeckerSchedule(cfg);
    // firstCycleDays 28, decay 0.5, maxCycles 7 ⇒ 28,14,7,4,2,1,1 (rounded, floored at 1 day).
    expect(w.cycles.map((c) => c.intervalDays)).toEqual([
      28, 14, 7, 4, 2, 1, 1,
    ]);
    expect(w.cycles.map((c) => c.cycle)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(w.recommendedMinCycles).toBe(3);
  });

  it("carries graded evidence (B, smith_tikkanen2018)", () => {
    const w = woodpeckerSchedule(cfg);
    expect(w.evidenceGrade).toBe("B");
    expect(w.citationKey).toBe("smith_tikkanen2018");
  });
});

describe("bookDifficultyFeedback (Seam 4 §4.2 — the 85% rule)", () => {
  it("calls a high success rate too easy and a low one too hard", () => {
    expect(bookDifficultyFeedback({ successRate: 0.95 }, cfg).verdict).toBe(
      "too_easy",
    );
    expect(bookDifficultyFeedback({ successRate: 0.5 }, cfg).verdict).toBe(
      "too_hard",
    );
    expect(bookDifficultyFeedback({ successRate: 0.85 }, cfg).verdict).toBe(
      "calibrated",
    );
  });

  it("returns the configured target band and graded evidence", () => {
    const f = bookDifficultyFeedback({ successRate: 0.85 }, cfg);
    expect(f.targetSuccessRate).toBe(0.85);
    expect(f.lowerBound).toBe(0.75);
    expect(f.upperBound).toBe(0.9);
    expect(f.citationKey).toBe("wilson2019");
  });
});

describe("nextAssignedBookChapter (Seam 4 §4.2)", () => {
  it("returns null when book has no chapters", () => {
    const book = {
      id: "no_chapters_book",
      title: "No Chapters",
      author: "Author",
      category: "tactics",
      why: "Why",
      studyUnit: "exercises" as const,
      owned: true,
      evidenceGrade: "C" as const,
      evidenceTier: 1 as const,
      citationKey: "best_books",
    };
    expect(nextAssignedBookChapter(book)).toBeNull();
    expect(nextAssignedBookChapter({ ...book, chapters: [] })).toBeNull();
  });

  it("returns the first chapter when no previous position is recorded", () => {
    const recs = recommendBooks({ band: b1200 }, cfg);
    const yusupov = recs.find((r) => r.id === "yusupov_1");
    expect(yusupov).toBeDefined();
    expect(yusupov?.chapters).toBeDefined();

    const assigned = nextAssignedBookChapter(yusupov!, null);
    expect(assigned).toEqual({
      chapter: 1,
      title: "The Mating Net",
      estMinutes: 30,
    });
  });

  it("advances to the next chapter based on last recorded position", () => {
    const recs = recommendBooks({ band: b1200 }, cfg);
    const yusupov = recs.find((r) => r.id === "yusupov_1")!;

    const assigned = nextAssignedBookChapter(yusupov, { chapter: 3 });
    expect(assigned).toEqual({
      chapter: 4,
      title: "Pin Tactics",
      estMinutes: 30,
    });
  });

  it("cycles back to chapter 1 after completing the final chapter", () => {
    const recs = recommendBooks({ band: b1200 }, cfg);
    const yusupov = recs.find((r) => r.id === "yusupov_1")!;
    const maxChapter = yusupov.chapters![yusupov.chapters!.length - 1]!.chapter;

    const assigned = nextAssignedBookChapter(yusupov, { chapter: maxChapter });
    expect(assigned).toEqual({
      chapter: 1,
      title: "The Mating Net",
      estMinutes: 30,
    });
  });

  it("uses default 30 minutes when estMinutes is absent", () => {
    const book = {
      chapters: [{ chapter: 1, title: "Intro without estMinutes" }],
    };
    const assigned = nextAssignedBookChapter(book, null);
    expect(assigned).toEqual({
      chapter: 1,
      title: "Intro without estMinutes",
      estMinutes: 30,
    });
  });

  it("loads chapter metadata for curated books across configs", () => {
    const recs = recommendBooks({ band: b1600 }, cfg);
    const woodpecker = recs.find((r) => r.id === "smith_tikkanen_woodpecker");
    expect(woodpecker?.chapters?.length).toBeGreaterThan(0);
    expect(woodpecker?.chapters?.[0]?.title).toBe("Easy Exercises");
  });
});
