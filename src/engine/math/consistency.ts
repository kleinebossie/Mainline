// Generic consistency math (BUILD.md §4: engine/math holds generic, science-free utilities).
// Day-bucketing for the engagement streak + the GitHub-style consistency grid. PURE epoch
// arithmetic over DAY_MS — no wall-clock construction, time is passed in (L2). It knows
// nothing about chess or motivation; the streak CAP and the window length are Seam-9 config.

import { DAY_MS } from "@/lib/clock";

/** The UTC day index an epoch falls in (epoch 0 = day 0). Stable, timezone-free bucketing. */
export function dayIndexOf(epoch: number): number {
  return Math.floor(epoch / DAY_MS);
}

/**
 * The consecutive active-day run ending at `today` — counting back while each day is present
 * in `activeDays`. Returns 0 when `today` itself is not active. (The Seam-9 cap that keeps the
 * displayed streak forgiving is applied downstream; this is the raw count.)
 */
export function consistencyStreak(
  activeDays: ReadonlySet<number>,
  today: number,
): number {
  let n = 0;
  let d = today;
  while (activeDays.has(d)) {
    n += 1;
    d -= 1;
  }
  return n;
}

export interface GridCell {
  dayIndex: number;
  active: boolean;
}

/**
 * The last `windowDays` day-indices (oldest → newest, inclusive of `today`) flagged
 * active/inactive — the data behind a GitHub-style consistency grid. Deterministic.
 */
export function consistencyGrid(
  activeDays: ReadonlySet<number>,
  today: number,
  windowDays: number,
): GridCell[] {
  const out: GridCell[] = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const d = today - i;
    out.push({ dayIndex: d, active: activeDays.has(d) });
  }
  return out;
}
