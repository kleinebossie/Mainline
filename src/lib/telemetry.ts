// Telemetry helper for Vercel Analytics custom funnel events (BETA_PRIORITIZATION_PLAN.md §3.4).
// Tracks key steps in the discovery, guest onboarding, and retention funnel.

import { track } from "@vercel/analytics";

export type FunnelEventName =
  | "landing_view"
  | "username_analyzed"
  | "sample_drill_solved"
  | "onboarding_completed"
  | "day1_session_started"
  | "day1_session_completed"
  | "guest_account_migrated"
  | "day2_session_started";

export interface FunnelEventProperties {
  landing_view?: { referrer?: string };
  username_analyzed?: {
    platform: string;
    hasGames: boolean;
    blunderCount?: number;
    rating?: number;
  };
  sample_drill_solved?: {
    attempts: number;
    solveTimeMs: number;
    source: "game" | "starter";
  };
  onboarding_completed?: {
    minutesPerDay: number;
    daysPerWeek: number;
    primaryFormat: string;
    isGuest: boolean;
  };
  day1_session_started?: { isGuest: boolean };
  day1_session_completed?: {
    isGuest: boolean;
    itemsCompleted: number;
    totalMinutes: number;
  };
  guest_account_migrated?: {
    itemsMigrated: number;
    hasAssessment: boolean;
    hasConstraints: boolean;
  };
  day2_session_started?: { isGuest: boolean };
}

/**
 * Record a funnel event safely.
 * Ignores failures when telemetry is blocked or in server context.
 */
export function trackFunnelEvent<E extends FunnelEventName>(
  event: E,
  properties?: FunnelEventProperties[E],
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (properties) {
      track(event, properties as Record<string, string | number | boolean>);
    } else {
      track(event);
    }
  } catch {
    // Ignore telemetry errors in client testing or blocked environments.
  }
}
