// Guest game library cache (localStorage key `mainline_guest_games`). Shared by the
// analysis dashboard and the guided review queue so both surfaces read and write the
// same cache shape. Storage is a boundary: entries are validated on read and corrupt
// data is dropped, never surfaced.

export interface GuestCachedGame {
  id: string;
  platform: string;
  playedAt: string | null;
  color: string | null;
  result: string | null;
  timeControl?: string | null;
  opening?: string | null;
  opponentRating?: number | null;
  userRatingAtGame?: number | null;
  pgn: string;
  opponent?: string | null;
  event?: string | null;
  analyzed: boolean;
  rawFeatures?: unknown;
}

export const GUEST_GAMES_STORAGE_KEY = "mainline_guest_games";

/** Read the cached guest games; returns an empty list when absent or corrupt. */
export function readGuestGamesCache(): GuestCachedGame[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_GAMES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const games: GuestCachedGame[] = [];
    for (const entry of parsed) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as GuestCachedGame).id !== "string" ||
        typeof (entry as GuestCachedGame).pgn !== "string"
      ) {
        continue;
      }
      games.push(entry as GuestCachedGame);
    }
    return games;
  } catch {
    return [];
  }
}

/** Persist the cache, merging fetched games over cached scan state (id-keyed). */
export function writeGuestGamesCache(
  updater: (prev: GuestCachedGame[]) => GuestCachedGame[],
): GuestCachedGame[] {
  const next = updater(readGuestGamesCache());
  try {
    window.localStorage.setItem(GUEST_GAMES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors.
  }
  return next;
}

/** Merge fetched games into the cache, preserving local scan state per game id. */
export function mergeFetchedIntoGuestGamesCache(
  fetched: GuestCachedGame[],
): GuestCachedGame[] {
  return writeGuestGamesCache((prev) => {
    const merged = new Map<string, GuestCachedGame>();
    for (const game of fetched) merged.set(game.id, game);
    for (const game of prev) {
      const existing = merged.get(game.id);
      if (existing) {
        merged.set(game.id, {
          ...existing,
          analyzed: game.analyzed,
          rawFeatures: game.rawFeatures,
        });
      } else {
        merged.set(game.id, game);
      }
    }
    return Array.from(merged.values());
  });
}

/** Flag one guest game as scanned and store its raw features. */
export function markGuestGameAnalyzed(
  gameId: string,
  rawFeatures: unknown,
): GuestCachedGame[] {
  return writeGuestGamesCache((prev) =>
    prev.map((game) =>
      game.id === gameId ? { ...game, analyzed: true, rawFeatures } : game,
    ),
  );
}
