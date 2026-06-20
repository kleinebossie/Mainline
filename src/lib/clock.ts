/**
 * The injected time source (BUILD.md §0.2, §2.4-L2).
 *
 * Decision code in `engine/` and `methodology/` must NEVER read the wall clock
 * directly — it receives a `Clock` so the generator and adaptation loop stay pure
 * and golden-testable. `systemClock` is the production implementation and lives
 * here in `lib/` (not a decision module), which is the only place `Date.now()` is
 * allowed. The L2 lint guard enforces the rest.
 */
export type EpochMs = number;

export interface Clock {
  now(): EpochMs;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** A frozen clock for deterministic tests. */
export function fixedClock(at: EpochMs): Clock {
  return { now: () => at };
}
