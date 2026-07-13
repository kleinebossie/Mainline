// Deterministic sampling for the storage-bounded puzzle subset. These options are
// infrastructure limits, not training methodology.

import type { LichessPuzzleInput } from "@/integrations/puzzles/parse";

export interface StratifyOptions {
  bucketSize: number;
  capPerBucketTheme: number;
  maxRows: number;
  minPopularity?: number;
  minNbPlays?: number;
}

// Conservative storage default with coverage across rating buckets and themes.
export const DEFAULT_STRATIFY: StratifyOptions = {
  bucketSize: 100,
  capPerBucketTheme: 150,
  maxRows: 200_000,
  minPopularity: 0,
};

export function ratingBucket(rating: number, size: number): number {
  return Math.floor(rating / size) * size;
}

/**
 * Greedy, order-stable sampler. A puzzle is kept when any of its bucket/theme cells
 * has room, which favors underrepresented cells without exceeding the row ceiling.
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
