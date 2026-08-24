// Per-game review progress autosave (TEMP_ANALYSIS_QUEUE_PLAN §4.5). localStorage only:
// the queue itself is derived, never persisted; this stores one player's unfinished
// moments so a reload resumes instead of replaying. Works identically for signed-in
// users and guests because keys are scoped by gameId. Validated on read (boundary):
// corrupt or foreign-shaped entries are dropped, never surfaced.

export const REVIEW_PROGRESS_PREFIX = "mainline_review_progress:";
const REVIEW_PROGRESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReviewProgressOutcome {
  ply: number;
  correct: boolean;
  bestUci?: string;
}

export interface ReviewProgress {
  reflectionNote: string;
  outcomes: ReviewProgressOutcome[];
  stepIndex: number;
  savedAt: string;
}

function keyFor(gameId: string): string {
  return `${REVIEW_PROGRESS_PREFIX}${gameId}`;
}

function parseProgress(raw: string): ReviewProgress | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<ReviewProgress>;
    if (typeof candidate.reflectionNote !== "string") return null;
    if (!Array.isArray(candidate.outcomes)) return null;
    if (typeof candidate.stepIndex !== "number") return null;
    if (typeof candidate.savedAt !== "string") return null;
    const outcomes: ReviewProgressOutcome[] = [];
    for (const outcome of candidate.outcomes) {
      if (
        !outcome ||
        typeof outcome !== "object" ||
        typeof (outcome as ReviewProgressOutcome).ply !== "number" ||
        typeof (outcome as ReviewProgressOutcome).correct !== "boolean"
      ) {
        return null;
      }
      const typed = outcome as ReviewProgressOutcome;
      outcomes.push({
        ply: typed.ply,
        correct: typed.correct,
        ...(typeof typed.bestUci === "string"
          ? { bestUci: typed.bestUci }
          : {}),
      });
    }
    return {
      reflectionNote: candidate.reflectionNote,
      outcomes,
      stepIndex: candidate.stepIndex,
      savedAt: candidate.savedAt,
    };
  } catch {
    return null;
  }
}

/** The saved progress for this game, or null when there is none worth resuming. */
export function loadReviewProgress(gameId: string): ReviewProgress | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(keyFor(gameId));
  if (!raw) return null;
  const progress = parseProgress(raw);
  if (!progress) {
    window.localStorage.removeItem(keyFor(gameId));
    return null;
  }
  return progress;
}

/** Persist progress and prune entries older than seven days. */
export function saveReviewProgress(
  gameId: string,
  progress: Omit<ReviewProgress, "savedAt">,
): void {
  if (typeof window === "undefined") return;
  pruneReviewProgress();
  window.localStorage.setItem(
    keyFor(gameId),
    JSON.stringify({ ...progress, savedAt: new Date().toISOString() }),
  );
}

/** Drop the key after a successful save. */
export function clearReviewProgress(gameId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(gameId));
}

function pruneReviewProgress(): void {
  const now = Date.now();
  const doomed: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(REVIEW_PROGRESS_PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const progress = parseProgress(raw);
    const savedAt = progress ? Date.parse(progress.savedAt) : NaN;
    if (Number.isNaN(savedAt) || now - savedAt > REVIEW_PROGRESS_MAX_AGE_MS) {
      doomed.push(key);
    }
  }
  for (const key of doomed) window.localStorage.removeItem(key);
}
