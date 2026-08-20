import {
  loadMethodology,
  bandForRating,
  type MethodologyConfig,
} from "@/methodology";
import { generateProgram, type ProgramItemDraft } from "@/engine/generator";
import { systemClock, type Clock } from "@/lib/clock";
import type { formatPrefsSchema, TargetFocus } from "@/lib/constraints";

export type FormatPreferences = import("zod").infer<typeof formatPrefsSchema>;

export const GUEST_STORAGE_KEY = "mainline_guest_session_data";

export interface GuestBaseline {
  username?: string;
  platform?: "lichess" | "chesscom";
  tacticalRatingEstimate: number;
  uncertainty: number;
  topBlindspot?: string;
  calibratedAt?: string;
}

export interface GuestConstraints {
  minutesPerDay: number;
  daysPerWeek: number;
  formatPrefs: FormatPreferences;
  goals: string[];
  ownedResources: Array<{ kind: string; label: string; externalRef?: string }>;
}

export interface GuestProgramItem {
  id: string;
  orderIndex: number;
  activityId: string;
  activityType: string;
  label: string;
  estMinutes: number;
  params: Record<string, unknown>;
  dimensionsTargeted: string[];
  rationaleKey: string;
  rationaleText: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  confidence: string;
  soften: boolean;
  status: "pending" | "done" | "skipped";
}

export interface GuestProgram {
  id: string;
  createdAt: string;
  scheduledDate: string;
  methodologyVersion: string;
  items: GuestProgramItem[];
}

export interface GuestActivityEvent {
  id: string;
  type: string;
  occurredAt: string;
  programItemId?: string;
  payload: Record<string, unknown>;
}

export interface GuestCalibrationResponse {
  track?: string;
  ratingShown: number;
  correct: boolean;
  puzzleId?: string;
}

export interface GuestConnection {
  id: string;
  platform: "lichess" | "chesscom";
  externalUsername: string;
  status: "active" | "revoked";
  connectedAt: string;
  lastSyncedAt?: string | null;
  ratings?: Record<string, { rating: number; rd?: number; games?: number }>;
}

export interface GuestSessionData {
  baseline: GuestBaseline | null;
  constraints: GuestConstraints | null;
  program: GuestProgram | null;
  activityEvents: GuestActivityEvent[];
  calibrationResponses?: GuestCalibrationResponse[];
  connections?: GuestConnection[];
  updatedAt: string;
}

export const DEFAULT_GUEST_CONSTRAINTS: GuestConstraints = {
  minutesPerDay: 20,
  daysPerWeek: 5,
  formatPrefs: {
    formats: ["rapid", "blitz"],
    preferredVariety: false,
    targetFocus: "online" as TargetFocus,
  },
  goals: ["improve_tactics", "blunder_reduction"],
  ownedResources: [],
};

export const DEFAULT_GUEST_BASELINE: GuestBaseline = {
  tacticalRatingEstimate: 1450,
  uncertainty: 350,
};

function createDefaultGuestSession(): GuestSessionData {
  return {
    baseline: null,
    constraints: null,
    program: null,
    activityEvents: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Read the guest session from browser storage. */
export function getGuestSession(): GuestSessionData {
  try {
    const storage =
      typeof window !== "undefined" && window.localStorage
        ? window.localStorage
        : typeof localStorage !== "undefined"
          ? localStorage
          : null;
    if (!storage) return createDefaultGuestSession();
    const raw = storage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return createDefaultGuestSession();
    return JSON.parse(raw) as GuestSessionData;
  } catch {
    return createDefaultGuestSession();
  }
}

/** Save updated guest session data to browser storage. */
export function saveGuestSession(data: GuestSessionData): void {
  try {
    const storage =
      typeof window !== "undefined" && window.localStorage
        ? window.localStorage
        : typeof localStorage !== "undefined"
          ? localStorage
          : null;
    if (!storage) return;
    data.updatedAt = new Date().toISOString();
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors.
  }
}

/** Check whether the user has stored guest data. */
export function hasGuestData(): boolean {
  try {
    const session = getGuestSession();
    return Boolean(
      session.baseline ||
      session.constraints ||
      session.program ||
      (session.connections && session.connections.length > 0),
    );
  } catch {
    return false;
  }
}

/** Check whether the current browser environment is in guest mode. */
export function isGuestSession(): boolean {
  try {
    const cookie =
      typeof document !== "undefined"
        ? document.cookie
        : typeof window !== "undefined" && window.document
          ? window.document.cookie
          : "";
    const hasGuestCookie = cookie.includes("mainline_guest=1");
    if (hasGuestCookie) return true;
    const hasAuthCookie =
      cookie.includes("authjs.session-token") ||
      cookie.includes("next-auth.session-token") ||
      cookie.includes("__Secure-authjs.session-token");
    if (hasAuthCookie) return false;
    return hasGuestData();
  } catch {
    return false;
  }
}

/** Save or update guest tactical baseline. */
export function saveGuestBaseline(
  baseline: Partial<GuestBaseline>,
): GuestSessionData {
  const current = getGuestSession();
  const nextBaseline: GuestBaseline = {
    ...(current.baseline ?? DEFAULT_GUEST_BASELINE),
    ...baseline,
  };
  const updated: GuestSessionData = {
    ...current,
    baseline: nextBaseline,
  };
  saveGuestSession(updated);
  return updated;
}

/** Save or update guest training constraints. */
export function saveGuestConstraints(
  constraints: GuestConstraints,
): GuestSessionData {
  const current = getGuestSession();
  const updated: GuestSessionData = {
    ...current,
    constraints,
  };
  saveGuestSession(updated);
  return updated;
}

/** Save updated calibration responses in guest session. */
export function saveGuestCalibrationResponses(
  responses: GuestCalibrationResponse[],
): GuestSessionData {
  const current = getGuestSession();
  const updated: GuestSessionData = {
    ...current,
    calibrationResponses: responses,
  };
  saveGuestSession(updated);
  return updated;
}

/** Clear guest calibration data upon retake. */
export function clearGuestCalibration(): GuestSessionData {
  const current = getGuestSession();
  const updated: GuestSessionData = {
    ...current,
    baseline: null,
    calibrationResponses: [],
  };
  saveGuestSession(updated);
  return updated;
}

/** Save a guest platform connection. */
export function saveGuestConnection(conn: GuestConnection): GuestSessionData {
  const current = getGuestSession();
  const existing = current.connections ?? [];
  const updatedConnections = [
    ...existing.filter((c) => c.platform !== conn.platform),
    conn,
  ];
  const updated: GuestSessionData = {
    ...current,
    connections: updatedConnections,
    baseline: {
      ...(current.baseline ?? DEFAULT_GUEST_BASELINE),
      username: conn.externalUsername,
      platform: conn.platform,
    },
  };
  saveGuestSession(updated);
  return updated;
}

/** Remove a guest platform connection. */
export function removeGuestConnection(platformOrId: string): GuestSessionData {
  const current = getGuestSession();
  const existing = current.connections ?? [];
  const updatedConnections = existing.filter(
    (c) => c.id !== platformOrId && c.platform !== platformOrId,
  );
  const updated: GuestSessionData = {
    ...current,
    connections: updatedConnections,
  };
  saveGuestSession(updated);
  return updated;
}

/** Record a completed training drill or outcome in guest session. */
export function recordGuestActivityEvent(
  event: Omit<GuestActivityEvent, "id" | "occurredAt">,
): GuestSessionData {
  const current = getGuestSession();
  const newEvent: GuestActivityEvent = {
    id: `guest_event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    occurredAt: new Date().toISOString(),
    ...event,
  };

  const updated: GuestSessionData = {
    ...current,
    activityEvents: [...current.activityEvents, newEvent],
  };

  if (event.programItemId && updated.program) {
    updated.program = {
      ...updated.program,
      items: updated.program.items.map((item) =>
        item.id === event.programItemId
          ? {
              ...item,
              status: event.type === "skip" ? "skipped" : "done",
            }
          : item,
      ),
    };
  }

  saveGuestSession(updated);
  return updated;
}

/** Update the status of a specific guest program item. */
export function updateGuestProgramItemStatus(
  itemId: string,
  status: "pending" | "done" | "skipped",
): GuestSessionData {
  const current = getGuestSession();
  if (!current.program) return current;

  const updated: GuestSessionData = {
    ...current,
    program: {
      ...current.program,
      items: current.program.items.map((it) =>
        it.id === itemId ? { ...it, status } : it,
      ),
    },
  };
  saveGuestSession(updated);
  return updated;
}

/** Clear all guest session data upon successful account migration. */
export function clearGuestSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    localStorage.removeItem("mainline_reveal_seen");
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Generate a pure deterministic daily program for guest mode (L2).
 * Uses versioned methodology config and generator packing.
 */
export function generateGuestProgram(
  clock: Clock = systemClock,
  methodologyLoader: (version?: string) => MethodologyConfig = loadMethodology,
): GuestProgram {
  const session = getGuestSession();
  const baseline = session.baseline ?? DEFAULT_GUEST_BASELINE;
  const constraints = session.constraints ?? DEFAULT_GUEST_CONSTRAINTS;
  const cfg = methodologyLoader();
  const band = bandForRating(baseline.tacticalRatingEstimate, cfg);

  const rawOutput = generateProgram({
    band,
    tacticalRating: baseline.tacticalRatingEstimate,
    weaknessSignals: [],
    dueItems: [],
    constraints: {
      minutesPerDay: constraints.minutesPerDay,
      formats: constraints.formatPrefs.formats,
      ownedRefs: constraints.ownedResources
        .map((r) => r.externalRef || r.label)
        .filter(Boolean),
    },
    clock,
    config: cfg,
  });

  const now = new Date(clock.now());
  const programId = `guest_program_${now.toISOString().split("T")[0]}`;

  const items: GuestProgramItem[] = rawOutput.items.map(
    (draft: ProgramItemDraft, index: number) => ({
      id: `guest_item_${index}_${draft.activityId}`,
      orderIndex: draft.orderIndex,
      activityId: draft.activityId,
      activityType: draft.activityType,
      label: draft.label,
      estMinutes: draft.estMinutes,
      params: (draft.params ?? {}) as unknown as Record<string, unknown>,
      dimensionsTargeted: draft.dimensionsTargeted,
      rationaleKey: draft.rationaleKey,
      rationaleText: draft.rationaleText,
      evidenceGrade: draft.evidenceGrade,
      evidenceTier: draft.evidenceTier,
      citationKey: draft.citationKey,
      confidence: draft.confidence,
      soften: draft.soften,
      status: "pending",
    }),
  );

  const guestProgram: GuestProgram = {
    id: programId,
    createdAt: now.toISOString(),
    scheduledDate: now.toISOString(),
    methodologyVersion: cfg.version,
    items,
  };

  const updatedSession: GuestSessionData = {
    ...session,
    program: guestProgram,
  };
  saveGuestSession(updatedSession);

  return guestProgram;
}

export const SEEN_ANALYSIS_INTRO_KEY = "mainline_seen_analysis_intro";

/** Check whether the user has already seen the one-time game analysis explanation. */
export function hasSeenAnalysisIntro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SEEN_ANALYSIS_INTRO_KEY) === "true";
  } catch {
    return false;
  }
}

/** Record that the user has seen the one-time game analysis explanation. */
export function markSeenAnalysisIntro(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEEN_ANALYSIS_INTRO_KEY, "true");
  } catch {
    // Ignore storage quota errors.
  }
}
