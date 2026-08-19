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
  ratings?: Record<string, { rating: number; rd?: number; games?: number }>;
}

interface CacheEntry {
  expiresAt: number;
  data: PublicAnalysisResult;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
const analysisCache = new Map<string, CacheEntry>();

export function expectedMistakesPerGame(rating: number): number {
  if (rating < 800) return 7.5;
  if (rating < 1200) {
    const t = (rating - 800) / 400;
    return Number((6.0 - t * 1.8).toFixed(1));
  }
  if (rating < 1600) {
    const t = (rating - 1200) / 400;
    return Number((4.2 - t * 1.8).toFixed(1));
  }
  if (rating < 2000) {
    const t = (rating - 1600) / 400;
    return Number((2.4 - t * 1.3).toFixed(1));
  }
  if (rating < 2400) {
    const t = (rating - 2000) / 400;
    return Number((1.1 - t * 0.8).toFixed(1));
  }
  return 0.2;
}

const STARTER_DRILLS: Record<string, PublicDrillData> = {
  hangingPiece: {
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/4n3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 6",
    solutionLine: ["d3e4"],
    source: "starter",
    title: "Capture the unprotected piece",
    description:
      "Black left the knight on e4 unprotected. Spot the capture and win material.",
  },
  fork: {
    fen: "r3k2r/pppb1ppp/8/3N4/8/8/PPP2PPP/R1B1K2R w KQkq - 0 1",
    solutionLine: ["d5c7", "e8d8", "c7a8"],
    source: "starter",
    title: "Execute the tactical fork",
    description:
      "White can fork the king and rook. Find the winning knight move.",
  },
  pin: {
    fen: "r1bqk2r/pppp1ppp/2n5/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 6",
    solutionLine: ["c4f7", "e8f7", "f3g5"],
    source: "starter",
    title: "Exploit the pinned piece",
    description: "Disrupt Black's king and launch a decisive attack.",
  },
  backRankMate: {
    fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    solutionLine: ["d1d8"],
    source: "starter",
    title: "Punish the back-rank weakness",
    description:
      "Black left the back rank undefended. Deliver the winning checkmate.",
  },
  skewer: {
    fen: "r3k2r/pppb1ppp/8/3N4/8/8/PPP2PPP/R1B1K2R w KQkq - 0 1",
    solutionLine: ["d5c7", "e8d8", "c7a8"],
    source: "starter",
    title: "Execute the skewer",
    description: "Force the enemy piece to move and win the target behind it.",
  },
  advantage: {
    fen: "r3k2r/pppb1ppp/8/3N4/8/8/PPP2PPP/R1B1K2R w KQkq - 0 1",
    solutionLine: ["d5c7", "e8d8", "c7a8"],
    source: "starter",
    title: "Convert the winning advantage",
    description:
      "Find the winning tactical continuation to gain a decisive advantage.",
  },
};

async function determineBlindspot(
  prisma: Pick<PrismaClient, "lichessPuzzle"> | undefined,
  _games: ImportedGameInput[],
  rating: number,
): Promise<{ blindspot: PublicBlindspot; drill: PublicDrillData }> {
  const estimatedMistakes = expectedMistakesPerGame(rating);
  const mistakeFrequency = `${estimatedMistakes} mistakes per game`;

  let blindspot: PublicBlindspot;
  let fallbackDrill: PublicDrillData;
  let theme: string;

  if (rating < 1100) {
    theme = "hangingPiece";
    blindspot = {
      title: "Hanging Pieces",
      description:
        "Unprotected pieces that opponents can capture without loss of material.",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "weakness_diagnosis",
      mistakeFrequency,
      theme,
    };
    fallbackDrill = STARTER_DRILLS.hangingPiece!;
  } else if (rating < 1400) {
    theme = "fork";
    blindspot = {
      title: "Forks",
      description:
        "A single piece that attacks two or more enemy targets at the same time.",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "chase_simon1973",
      mistakeFrequency,
      theme,
    };
    fallbackDrill = STARTER_DRILLS.fork!;
  } else if (rating < 1700) {
    theme = "pin";
    blindspot = {
      title: "Pins",
      description:
        "A piece that cannot move because it protects a more valuable piece behind it.",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "chase_simon1973",
      mistakeFrequency,
      theme,
    };
    fallbackDrill = STARTER_DRILLS.pin!;
  } else if (rating < 2000) {
    theme = "backRankMate";
    blindspot = {
      title: "Back-Rank Weakness",
      description:
        "A trapped king on the home row vulnerable to rook or queen attacks.",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "chase_simon1973",
      mistakeFrequency,
      theme,
    };
    fallbackDrill = STARTER_DRILLS.backRankMate!;
  } else {
    theme = "advantage";
    blindspot = {
      title: "Tactical Conversion",
      description:
        "Sharp middlegame positions where tactical chances and defense decide the game.",
      evidenceGrade: "A",
      evidenceTier: 1,
      citationKey: "weakness_diagnosis",
      mistakeFrequency,
      theme,
    };
    fallbackDrill = STARTER_DRILLS.advantage!;
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

    const recentGames = games.slice(0, 10).map((g) => ({
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
      ratings: profile.ratings as Record<
        string,
        { rating: number; rd?: number; games?: number }
      >,
    };

    analysisCache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      data: result,
    });

    return result;
  } catch (error) {
    if (error instanceof PlatformError) {
      if (error.code === "not_found") {
        throw new Error(
          `Player "${username}" not found on ${platform === "lichess" ? "Lichess" : "Chess.com"}.`,
        );
      }
      if (error.code === "rate_limited") {
        throw new Error(
          `${platform === "lichess" ? "Lichess" : "Chess.com"} rate limit reached. Please wait a moment.`,
        );
      }
    }
    throw new Error(
      `Could not load games for "${username}". Please check the username and try again.`,
    );
  }
}
