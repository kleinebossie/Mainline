// Generic greedy time-budget packing (BUILD.md §7.1 step 5: "the only place the Engine
// 'decides,' and it decides only fit/packing — never chess merit"). Pure + deterministic
// (L2), science-free (L1): it knows nothing about what an item is, only its minute cost.
//
// Items arrive already ordered by priority (Seam 7). We keep every item that still fits
// the remaining budget, in priority order — so a cheaper lower-priority item can fill a
// gap a pricier one left. At least the single highest-priority item is always kept, so a
// tiny budget still yields a non-empty session (it may then exceed the budget by that one
// item — a deliberate, documented floor).

export interface Packable {
  estMinutes: number;
}

export function packToBudget<T extends Packable>(
  ordered: readonly T[],
  budgetMinutes: number,
): T[] {
  const picked: T[] = [];
  let total = 0;
  for (const item of ordered) {
    if (total + item.estMinutes <= budgetMinutes) {
      picked.push(item);
      total += item.estMinutes;
    }
  }
  if (picked.length === 0 && ordered.length > 0) picked.push(ordered[0]!);
  return picked;
}
