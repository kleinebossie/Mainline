// The engagement event bus — PLUMBING ONLY (BUILD.md §9, M9). The Engine owns the mechanism
// (the taxonomy, the bus, persistence, the capped notification scheduler); the WHICH/WHEN/COPY
// is Seam 9 (engagementEventsFor). This module decides nothing graded (L1): it maps the seam's
// graded events to persistable drafts and clamps reminder cadence to the config ceiling. Pure
// (L2): no clock, no randomness — the server stamps occurredAt and does the I/O around it.

import {
  engagementEventsFor,
  type EngagementEvent,
  type EngagementStateChange,
  type MethodologyConfig,
} from "@/methodology";

/** A state change the bus reacts to (re-exported from the seam so callers import one place). */
export type StateChange = EngagementStateChange;

/** A RewardEvent ready to persist — the server stamps occurredAt + seen=false (§5.7). The
 *  copy/grade are resolved from `copyKey` at render time (Seam 8), never stripped (L3). */
export interface RewardEventDraft {
  type: string;
  copyKey: string;
  payload: Record<string, unknown>;
}

/**
 * `onStateChange` (§9) — turn a state change into the reward events to persist. Delegates the
 * graded which/when/copy to `engagementEventsFor` (Seam 9) and shapes the result for storage.
 * Forbidden mechanics can never appear here because the seam's event `type` is enum-bounded.
 */
export function onStateChange(
  change: StateChange,
  config: MethodologyConfig,
): RewardEventDraft[] {
  return engagementEventsFor(change, config).map((e: EngagementEvent) => ({
    type: e.type,
    copyKey: e.copyKey,
    payload: { ...e.payload },
  }));
}

/**
 * The capped notification scheduler's core (§9 anti-nag guardrail): clamp a user-requested
 * reminder cadence to the config ceiling (`reminderCadenceCapPerDay`). Generic clamp; the
 * ceiling is the methodology number, so the cap can never be exceeded no matter what a client
 * asks for. Negative / non-finite requests floor to 0 (reminders off).
 */
export function clampReminderCadence(
  requestedPerDay: number,
  config: MethodologyConfig,
): number {
  const cap = config.engagement.reminderCadenceCapPerDay.value;
  if (!Number.isFinite(requestedPerDay) || requestedPerDay <= 0) return 0;
  return Math.min(Math.floor(requestedPerDay), cap);
}
