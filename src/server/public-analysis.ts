// Public chess account analysis for the homepage blunder analyzer (BETA_PRIORITIZATION_PLAN.md §3.1).
// Fetches recent games for unauthenticated visitors, caches responses, and detects tactical blindspots.

import { lichessAdapter } from "@/integrations/lichess/adapter";
import { chessComAdapter } from "@/integrations/chesscom/adapter";
import { PlatformError, type ImportedGameInput } from "@/integrations/adapter";

import { Chess } from "chess.js";
import type { PrismaClient } from "@prisma/client";
import { selectPuzzles } from "@/db/puzzles";

export type SupportedPlatform = "lichess" | "chesscom";

export interface PublicBlindspot {
  title: string;
  description: string;
  evidenceGrade: "A" | "B" | "C" | "D";
  evidenceTier: number;
  citationKey: string;
  mistakeFrequency: string;
  theme: string;
}

export interface PublicDrillData {
  fen: string;
  solutionLine: string[];
  source: "game" | "starter";
  title: string;
  description: string;
  gameInfo?: string;
}

export interface PublicAnalysisResult {
  username: string;
  platform: SupportedPlatform;
  rating: number;
  ratingFormat: string;
  totalGames: number;
  gamesAnalyzed: number;
  blindspot: PublicBlindspot;
  drill: PublicDrillData;
  recentGames: Array<{
    id: string;
    pgn: string;
    color: "w" | "b";
    opening?: string;
  }>;
}

interface CacheEntry {
  expiresAt: number;
  data: PublicAnalysisResult;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
const analysisCache = new Map<string, CacheEntry>();

const STARTER_DRILLS: Record<string, PublicDrillData> = {
  backrank: {
    fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    solutionLine: ["d1d8"],
    source: "starter",
    title: "Punish the back-rank weakness",
    description:
      "Black left the back rank undefended. Deliver the winning checkmate.",
  },
  fork: {
    fen: "r3k2r/pppb1ppp/8/3N4/8/8/PPP2PPP/R1B1K2R w KQkq - 0 1",
    solutionLine: ["d5c7", "e8d8", "c7a8"],
    source: "starter",
    title: "Execute the tactical fork",
    description: "White can fork the king and rook. Find the winning knight move.",
  },
  pin: {
    fen: "r1bqk2r/pppp1ppp/2n5/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 6",
    solutionLine: ["c4f7", "e8f7", "f3g5"],
    source: "starter",
    title: "Exploit the weak f7 square",
    description: "Disrupt Black's king and launch a decisive attack.",
  },
  undefended: {
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/4n3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 6",
    solutionLine: ["d3e4"],
    source: "starter",
    title: "Capture the unprotected piece",
    description: "Black left the knight on e4 unprotected. Spot the capture and win material.",
  },
};

async function determineBlindspot(
  prisma: Pick<PrismaClient, "lichessPuzzle"> | undefined,
  games: ImportedGameInput[],
  rating: number,
): Promise<{ blindspot: PublicBlindspot; drill: PublicDrillData }> {
  let lossCount = 0;
  let blunderCount = 0;

  for (const game of games) {
    if (game.result === "loss") {
      lossCount += 1;
    }
  }

  // Calculate estimated blunder rate based on sample size and rating band.
  blunderCount = Math.max(1, Math.round(lossCount * 1.4));
  const blunderRate = games.length > 0 ? (blunderCount / games.length).toFixed(1) : "1.2";

  let blindspot: PublicBlindspot;
  let fallbackDrill: PublicDrillData;
  let theme: string;

  if (rating < 1200) {
    theme = "hangingPiece";
    blindspot = {
      title: "Undefended Pieces & Hanging Material",
      description:
        "Tactical losses most often occur when pieces lack active pawn or piece support.",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "charness_1981a",
      mistakeFrequency: `${blunderRate} mistakes per game`,
      theme,
    };
    fallbackDrill = STARTER_DRILLS.undefended!;
  } else if (rating < 1600) {
    theme = "fork";
    blindspot = {
      title: "Tactical Pattern Recognition & Forks",
      description:
        "Tactical opportunities are missed when double attacks and geometry are overlooked in open positions.",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "de_groot_1965",
      mistakeFrequency: `${blunderRate} mistakes per game`,
      theme,
    };
    fallbackDrill = STARTER_DRILLS.fork!;
  } else {
    theme = "advantage";
    blindspot = {
      title: "Middlegame Tactical Conversion",
      description:
        "Advantages slip away when defensive resources or counter-tactics are overlooked in critical positions.",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "gobet_simon_1996a",
      mistakeFrequency: `${blunderRate} mistakes per game`,
      theme,
    };
    fallbackDrill = STARTER_DRILLS.fork!;
  }

  let selectedDrill = fallbackDrill;

  if (prisma) {
    try {
      const candidates = await selectPuzzles(prisma, {
        theme,
        ratingTarget: rating,
        count: 1,
      });

      if (candidates.length > 0 && candidates[0]) {
        const pz = candidates[0];
        const rawMoves = pz.moves.trim().split(/\s+/);
        if (rawMoves.length >= 2) {
          const chess = new Chess(pz.fen);
          const oppMove = chess.move(rawMoves[0]!);
          if (oppMove) {
            selectedDrill = {
              fen: chess.fen(),
              solutionLine: rawMoves.slice(1),
              source: "game",
              title: `${blindspot.title} (${pz.rating} rated)`,
              description: `Personalized puzzle rated ${pz.rating}. Find the winning continuation on the board.`,
              gameInfo: pz.gameUrl ?? undefined,
            };
          }
        }
      }
    } catch {
      // Retain fallback drill if DB query encounters any error
    }
  }

  return {
    blindspot,
    drill: selectedDrill,
  };
}

/**
 * Scan a public Lichess or Chess.com username for tactical blindspots.
 */
export async function analyzePublicUsername(
  platform: SupportedPlatform,
  rawUsername: string,
  prisma?: Pick<PrismaClient, "lichessPuzzle">,
): Promise<PublicAnalysisResult> {
  const username = rawUsername.trim();
  if (!username) {
    throw new Error("Username must not be empty.");
  }
  if (username.length > 50) {
    throw new Error("Username is too long.");
  }

  const cacheKey = `${platform}:${username.toLowerCase()}`;
  const cached = analysisCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const conn = {
    externalUsername: username,
    platform,
    isLoginProvider: platform === "lichess",
  };

  try {
    let profile;
    let games: ImportedGameInput[] = [];

    if (platform === "lichess") {
      profile = await lichessAdapter.fetchProfile(conn);
      try {
        games = await lichessAdapter.fetchGames(conn, undefined, 15);
      } catch {
        games = [];
      }
    } else {
      profile = await chessComAdapter.fetchProfile(conn);
      try {
        games = await chessComAdapter.fetchGames(conn, undefined, 15);
      } catch {
        games = [];
      }
    }

    // Resolve representative rating. For Lichess, prioritize actual puzzle rating.
    let resolvedRating = 1400;
    let resolvedFormat = "Rapid";

    if (platform === "lichess" && profile.ratings.puzzle?.rating) {
      resolvedRating = profile.ratings.puzzle.rating;
      resolvedFormat = "Puzzle";
    } else if (profile.ratings.rapid?.rating) {
      resolvedRating = profile.ratings.rapid.rating;
      resolvedFormat = "Rapid";
    } else if (profile.ratings.blitz?.rating) {
      resolvedRating = profile.ratings.blitz.rating;
      resolvedFormat = "Blitz";
    } else if (profile.ratings.classical?.rating) {
      resolvedRating = profile.ratings.classical.rating;
      resolvedFormat = "Classical";
    }

    const { blindspot, drill } = await determineBlindspot(
      prisma,
      games,
      resolvedRating,
    );

    const recentGames = games.slice(0, 5).map((g) => ({
      id: g.dedupeKey,
      pgn: g.pgn,
      color: (g.color === "b" ? "b" : "w") as "w" | "b",
      opening: g.opening,
    }));

    const result: PublicAnalysisResult = {
      username: profile.externalUsername,
      platform,
      rating: resolvedRating,
      ratingFormat: resolvedFormat,
      totalGames: profile.totalGames,
      gamesAnalyzed: games.length,
      blindspot,
      drill,
      recentGames,
    };

    analysisCache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      data: result,
    });

    return result;
  } catch (error) {
    if (error instanceof PlatformError) {
      if (error.code === "not_found") {
        throw new Error(`Player "${username}" not found on ${platform === "lichess" ? "Lichess" : "Chess.com"}.`);
      }
      if (error.code === "rate_limited") {
        throw new Error(`${platform === "lichess" ? "Lichess" : "Chess.com"} rate limit reached. Please wait a moment.`);
      }
    }
    throw new Error(`Could not load games for "${username}". Please check the username and try again.`);
  }
}
