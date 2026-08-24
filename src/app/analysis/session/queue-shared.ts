// Shared view types for the guided review queue session (TEMP_ANALYSIS_QUEUE_PLAN §6.3).
// The server procedure and the guest-side derivation both produce these shapes so one
// set of cards renders either source.

import type { AnalysisPromptRung } from "@/methodology";

export interface QueueGameView {
  id: string;
  playedAt: string | null;
  color: string | null;
  result: string | null;
  timeControl: string | null;
  opening: string | null;
  opponent: string | null;
  opponentRating: number | null;
  platform: string;
  externalGameId: string;
  promptRung: AnalysisPromptRung;
  externalUrl: string | null;
}

/** A game with no scan yet that the queue can prepare automatically (tier 3). */
export type QueueScanCandidate = {
  id: string;
  playedAt: string | null;
  result: string | null;
  opponent: string | null;
};

export interface ReviewQueueData {
  budgetMinutes: number;
  usedMinutes: number;
  completedReviews: number;
  targetCount: number;
  games: QueueGameView[];
  scanCandidate: QueueScanCandidate | null;
}
