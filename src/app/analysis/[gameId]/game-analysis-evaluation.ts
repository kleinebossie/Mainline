import { Chess } from "chess.js";

import type { EvalLine } from "@/analysis/engine-adapter";

const MATE_CP = 100_000;

export interface TopMove {
  uci: string;
  san: string;
  cp: number;
  mate: number | null;
  pctBetter: number | null;
}

export interface MomentAnalysis {
  rootBestCp: number;
  rootBestWinProb: number;
  gameCpLoss: number;
  gameWinProbDrop: number;
  gameMoveSan: string | null;
  topMoves: TopMove[];
}

export interface Attempt {
  uci: string;
  san: string;
  winProbDrop: number;
  correct: boolean;
  pctBetter: number | null;
}

export function rootEval(line: EvalLine | undefined): number {
  if (!line) return 0;
  if (line.mate != null) return line.mate > 0 ? MATE_CP : -MATE_CP;
  return line.scoreCp;
}

export function playerEvalAfter(line: EvalLine | undefined): number {
  if (!line) return -MATE_CP;
  if (line.mate != null) return line.mate < 0 ? MATE_CP : -MATE_CP;
  return -line.scoreCp;
}

export function pctWinChance(drop: number): number {
  return Math.max(0, Math.round(drop * 100));
}

export function pctBetterThanGame(
  gameCpLoss: number,
  moveCpLoss: number,
): number | null {
  if (!Number.isFinite(gameCpLoss) || gameCpLoss <= 0) return null;
  if (gameCpLoss >= MATE_CP / 2) return null;
  const pct = ((gameCpLoss - moveCpLoss) / gameCpLoss) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function uciToSan(fen: string, uci: string): string {
  if (uci.length < 4) return uci;
  try {
    const chess = new Chess(fen);
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    }).san;
  } catch {
    return uci;
  }
}
