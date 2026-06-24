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
      if (perUnitMinutes <= 0 || maxUnits <= 0) continue;
      const units = Math.min(maxUnits, Math.floor(remaining / perUnitMinutes));
      if (units >= 1) {
        const allocatedMinutes = units * perUnitMinutes;
        picked.push({ item, units, allocatedMinutes });
        remaining -= allocatedMinutes;
      }
    } else if (item.estMinutes <= remaining) {
      picked.push({ item, units: null, allocatedMinutes: item.estMinutes });
      remaining -= item.estMinutes;
    }
  }
  // Non-empty floor: if nothing fit, keep the single highest-priority item at its minimum
  // (one unit if divisible, else the whole item). Only a sub-unit budget can exceed the
  // limit here — a documented, near-impossible edge given the 5-minute minimum budget.
  if (picked.length === 0 && ordered.length > 0) {
    const first = ordered[0]!;
    picked.push(
      first.divisible
        ? {
            item: first,
            units: 1,
            allocatedMinutes: first.divisible.perUnitMinutes,
          }
        : { item: first, units: null, allocatedMinutes: first.estMinutes },
    );
  }
  return picked;
}
