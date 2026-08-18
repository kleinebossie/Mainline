import { CHESS_FORMATS } from "@/lib/constraints";

export const CALIBRATION_RATING_FORMAT_PRIORITY = ["puzzle", "rapid"] as const;
export const PLAYING_RATING_FORMAT_PRIORITY = [
  "rapid",
  "blitz",
  "classical",
] as const;
export const LIVE_RATING_FORMATS = ["bullet", "blitz", "rapid"] as const;

export interface SnapshotRatingEntry {
  format: string;
  rating: number;
  rd: number | null;
}

export interface SnapshotRatingWithDeviation extends SnapshotRatingEntry {
  rd: number;
}

function ratingRecord(ratings: unknown): Record<string, unknown> | null {
  return ratings !== null &&
    typeof ratings === "object" &&
    !Array.isArray(ratings)
    ? (ratings as Record<string, unknown>)
    : null;
}

/** Normalize one observed platform rating. Invalid persisted data fails closed. */
export function ratingEntryFromSnapshot(
  ratings: unknown,
  format: string,
): SnapshotRatingEntry | null {
  const record = ratingRecord(ratings);
  const raw = record?.[format];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const entry = raw as Record<string, unknown>;
  const rating = entry.rating;
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0) {
    return null;
  }

  const rd = entry.rd;
  return {
    format,
    rating: Math.round(rating),
    rd:
      typeof rd === "number" && Number.isFinite(rd) && rd > 0
        ? Math.round(rd)
        : null,
  };
}

export function ratingEntriesFromSnapshot(
  ratings: unknown,
  formats: readonly string[] = CHESS_FORMATS,
): SnapshotRatingEntry[] {
  return formats.flatMap((format) => {
    const entry = ratingEntryFromSnapshot(ratings, format);
    return entry ? [entry] : [];
  });
}

export function preferredRatingEntryFromSnapshot(
  ratings: unknown,
  formats: readonly string[],
): SnapshotRatingEntry | null {
  for (const format of formats) {
    const entry = ratingEntryFromSnapshot(ratings, format);
    if (entry) return entry;
  }
  return null;
}

/** Puzzle rating first, then rapid, for calibration and puzzle difficulty. */
export function calibrationRatingFromSnapshot(ratings: unknown): number | null {
  return (
    preferredRatingEntryFromSnapshot(
      ratings,
      CALIBRATION_RATING_FORMAT_PRIORITY,
    )?.rating ?? null
  );
}

/** Playing formats only, in the documented analysis fallback order. */
export function playingRatingEntryFromSnapshot(
  ratings: unknown,
): SnapshotRatingEntry | null {
  return preferredRatingEntryFromSnapshot(
    ratings,
    PLAYING_RATING_FORMAT_PRIORITY,
  );
}

/** Playing-format fallback that also requires uncertainty for Glicko measurement. */
export function playingRatingWithDeviationFromSnapshot(
  ratings: unknown,
): SnapshotRatingWithDeviation | null {
  for (const format of PLAYING_RATING_FORMAT_PRIORITY) {
    const entry = ratingEntryFromSnapshot(ratings, format);
    if (entry?.rd != null) return { ...entry, rd: entry.rd };
  }
  return null;
}

export function playingRatingFromSnapshot(ratings: unknown): number | null {
  return playingRatingEntryFromSnapshot(ratings)?.rating ?? null;
}

/** Highest rating among live formats used to select the resource-library band. */
export function highestLiveRatingFromSnapshot(ratings: unknown): number | null {
  const entries = ratingEntriesFromSnapshot(ratings, LIVE_RATING_FORMATS);
  return entries.length > 0
    ? Math.max(...entries.map((entry) => entry.rating))
    : null;
}

export interface CalibrationSeedInput {
  lichessRatings?: unknown;
  chesscomRatings?: unknown;
  primaryFormat?: string | null;
  defaultStartRating?: number;
}

/**
 * Resolve starting rating for tactical calibration according to the priority hierarchy:
 * 1. Lichess puzzle rating if available.
 * 2. Chess.com rating in the player's primary time control.
 * 3. Highest Chess.com rating across all formats.
 * 4. Other connected platform ratings or default start rating fallback.
 */
export function resolveCalibrationSeedRating(
  input: CalibrationSeedInput,
): number {
  const defaultRating = input.defaultStartRating ?? 1200;

  // 1. Lichess puzzle rating if provided
  if (input.lichessRatings) {
    const lichessPuzzle = ratingEntryFromSnapshot(
      input.lichessRatings,
      "puzzle",
    );
    if (lichessPuzzle && lichessPuzzle.rating > 0) {
      return lichessPuzzle.rating;
    }
  }

  // 2. Chess.com rating in player's primary time control
  if (input.chesscomRatings && input.primaryFormat) {
    const chesscomPrimary = ratingEntryFromSnapshot(
      input.chesscomRatings,
      input.primaryFormat,
    );
    if (chesscomPrimary && chesscomPrimary.rating > 0) {
      return chesscomPrimary.rating;
    }
  }

  // 3. Highest Chess.com rating across the board
  if (input.chesscomRatings) {
    const allChessCom = ratingEntriesFromSnapshot(input.chesscomRatings, [
      "rapid",
      "blitz",
      "bullet",
      "classical",
      "daily",
    ]);
    if (allChessCom.length > 0) {
      return Math.max(...allChessCom.map((e) => e.rating));
    }
  }

  // 4. Fallback to any other Lichess formats if present
  if (input.lichessRatings) {
    const allLichess = ratingEntriesFromSnapshot(input.lichessRatings, [
      "rapid",
      "blitz",
      "classical",
      "bullet",
    ]);
    if (allLichess.length > 0) {
      return Math.max(...allLichess.map((e) => e.rating));
    }
  }

  return defaultRating;
}

