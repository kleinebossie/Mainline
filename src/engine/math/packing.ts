// Generic time-budget packing (BUILD.md §7.1 step 5: "the only place the Engine 'decides,'
// and it decides only fit/packing — never chess merit"). Pure + deterministic (L2),
// science-free (L1): it knows nothing about what an item is, only its minute cost.
//
// HARD TIME LIMIT (Goal 1): the session is sized to a hard minute budget and never exceeds
// it. Items arrive already ordered by priority (Seam 7). A FIXED item (a whole activity) is
// kept only if it still fits the remaining budget. A DIVISIBLE item (puzzles, games) is
// sized to the remaining time: its unit count = min(its cap, how many units fit) — so a
// faster-to-solve unit naturally yields more of them, and the running total stays ≤ budget.
// The per-unit minutes and caps are supplied by the caller (from config); the packer only
// does the arithmetic.

export interface Divisible {
  /** Minutes per unit (one puzzle / one game) — the cost the budget is divided by. */
  perUnitMinutes: number;
  /** Hard cap on units regardless of budget (the dose / max-games cap). */
  maxUnits: number;
  /** Smallest increment exposed as allotted time. Supplied by methodology/caller. */
  allocationGranularityMinutes?: number;
}

export interface Packable {
  /** Whole-item cost, used when the item is not divisible (a fixed activity). */
  estMinutes: number;
  /** Present when the item's size scales with time (puzzles, games). */
  divisible?: Divisible;
}

export interface PackedItem<T> {
  item: T;
  /** Units chosen for a divisible item (puzzles/games); null for a fixed item. */
  units: number | null;
  /** Minutes this item is allotted (its contribution to the budget). */
  allocatedMinutes: number;
}

export function packToBudget<T extends Packable>(
  ordered: readonly T[],
  budgetMinutes: number,
): PackedItem<T>[] {
  const picked: PackedItem<T>[] = [];
  let remaining = budgetMinutes;
  for (const item of ordered) {
    if (item.divisible) {
      const { perUnitMinutes, maxUnits } = item.divisible;
      const granularity = item.divisible.allocationGranularityMinutes ?? 0;
      if (perUnitMinutes <= 0 || maxUnits <= 0) continue;
      if (granularity < 0) continue;

      let units = 0;
      let allocatedMinutes = 0;
      for (let next = 1; next <= maxUnits; next += 1) {
        const nextAllocated =
          granularity > 0
            ? Math.ceil((next * perUnitMinutes) / granularity) * granularity
            : next * perUnitMinutes;
        if (nextAllocated > remaining) break;
        units = next;
        allocatedMinutes = nextAllocated;
      }
      if (units >= 1) {
        picked.push({ item, units, allocatedMinutes });
        remaining -= allocatedMinutes;
      }
    } else if (item.estMinutes <= remaining) {
      picked.push({ item, units: null, allocatedMinutes: item.estMinutes });
      remaining -= item.estMinutes;
    }
  }
  return picked;
}
