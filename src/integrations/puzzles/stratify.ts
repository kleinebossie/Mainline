// Stratified sampling for the free-tier puzzle-DB subset (BUILD.md §6.4, §12). The
// full Lichess puzzle DB (~millions of rows) exceeds Supabase free (500 MB), so the
// ingest keeps a rating-×-theme-stratified subset with full band coverage rather than
// truncating. The numbers here are INFRASTRUCTURE budget knobs (storage ceiling,
// bucket width) — not chess/learning values (L1) — and are overridable from the
// ingest CLI/env. Deterministic (no clock, no randomness): the same input stream and
// options always keep the same rows, which keeps the ingest reproducible.

import type { LichessPuzzleInput } from "@/integrations/puzzles/parse";

export interface StratifyOptions {
  /** Rating bucket width in Elo (coverage granularity). */
  bucketSize: number;
  /** Soft cap of kept puzzles per (rating-bucket, theme) pair. */
  capPerBucketTheme: number;
  /** Hard ceiling on total kept rows (the free-tier budget). */
  maxRows: number;
  /** Optional quality floors to favour well-vetted puzzles. */
  minPopularity?: number;
  minNbPlays?: number;
}

// Conservative defaults: ~200k rows (well under the 500 MB free tier) with even
// coverage across rating buckets and themes. See the ingest script for the resulting
// on-disk ceiling estimate.
export const DEFAULT_STRATIFY: StratifyOptions = {
  bucketSize: 100,
  capPerBucketTheme: 150,
  maxRows: 200_000,
  minPopularity: 0,
};

/** Lower edge of a puzzle's rating bucket, e.g. ratingBucket(1234, 100) === 1200. */
export function ratingBucket(rating: number, size: number): number {
  return Math.floor(rating / size) * size;
}

/**
 * Greedy, order-stable stratified sampler. `consider(p)` returns true when the puzzle
 * is kept (and records it against each of its (bucket, theme) cells); it returns false
 * once every cell the puzzle would fill is at cap, the row ceiling is reached, or a
 * quality floor is missed. A puzzle is kept if ANY of its cells still has room, which
 * spreads coverage into under-represented bands rather than over-filling popular ones.
 */
export class StratifiedSampler {
  private readonly counts = new Map<string, number>();
  private keptCount = 0;

  constructor(private readonly opts: StratifyOptions) {}

  get kept(): number {
    return this.keptCount;
  }

  private cellsFor(p: LichessPuzzleInput): string[] {
    const bucket = ratingBucket(p.rating, this.opts.bucketSize);
    const themes = p.themes.length > 0 ? p.themes : ["_untagged"];
    return themes.map((t) => `${bucket}:${t}`);
  }

  consider(p: LichessPuzzleInput): boolean {
    if (this.keptCount >= this.opts.maxRows) return false;
    if (
      this.opts.minPopularity != null &&
      p.popularity < this.opts.minPopularity
    ) {
      return false;
    }
    if (this.opts.minNbPlays != null && p.nbPlays < this.opts.minNbPlays) {
      return false;
    }

    const cells = this.cellsFor(p);
    const hasRoom = cells.some(
      (c) => (this.counts.get(c) ?? 0) < this.opts.capPerBucketTheme,
    );
    if (!hasRoom) return false;

    for (const c of cells) this.counts.set(c, (this.counts.get(c) ?? 0) + 1);
    this.keptCount += 1;
    return true;
  }
}
