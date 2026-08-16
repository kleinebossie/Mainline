"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { Check, RotateCcw } from "lucide-react";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";
import {
  BOARD_SIZE_CLASS,
  InteractiveBoard,
  type BoardMove,
} from "@/components/interactive-board";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import { deriveBlunderDrills } from "@/engine/interactive/blunder-drill";
import { DEFAULT_ANALYSIS_DEPTH } from "@/analysis/worker-config";
import { systemClock } from "@/lib/clock";
import { cn } from "@/lib/utils";

export interface BlunderDrillData {
  fen: string;
  solutionLine: string[];
  source: "game" | "starter";
  title?: string;
  description?: string;
  gameId?: string;
  gameInfo?: string;
}

export const STARTER_BLUNDER_DRILL: BlunderDrillData = {
  fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
  solutionLine: ["d1d8"],
  source: "starter",
  title: "Punish the back-rank mistake",
  description:
    "Black left the back rank undefended. Find the winning tactical move.",
};

export interface InstantBlunderDrillProps {
  onContinue?: () => void;
  initialDrill?: BlunderDrillData;
  className?: string;
}

export function InstantBlunderDrill({
  onContinue,
  initialDrill,
  className,
}: InstantBlunderDrillProps) {
  const pendingGames = trpc.analysis.pending.useQuery(
    { limit: 3 },
    { enabled: !initialDrill, staleTime: Infinity },
  );
  const library = trpc.analysis.library.useQuery(undefined, {
    enabled: !initialDrill,
    staleTime: Infinity,
  });

  const [drill, setDrill] = useState<BlunderDrillData>(
    initialDrill ?? STARTER_BLUNDER_DRILL,
  );
  const [loading, setLoading] = useState<boolean>(!initialDrill);
  const [solveStatus, setSolveStatus] = useState<
    "pending" | "correct" | "wrong" | "solved"
  >("pending");
  const [boardFen, setBoardFen] = useState<string>(
    initialDrill?.fen ?? STARTER_BLUNDER_DRILL.fen,
  );

  const [solveState, setSolveState] = useState<SolveState>(() => ({
    position: initialDrill?.fen ?? STARTER_BLUNDER_DRILL.fen,
    solutionLine:
      initialDrill?.solutionLine ?? STARTER_BLUNDER_DRILL.solutionLine,
    cursor: 0,
    startedMs: systemClock.now(),
    attempts: 0,
  }));

  const scanStartedRef = useRef(false);

  // Sync state if initialDrill changes externally.
  useEffect(() => {
    if (initialDrill) {
      setDrill(initialDrill);
      setBoardFen(initialDrill.fen);
      setSolveState({
        position: initialDrill.fen,
        solutionLine: initialDrill.solutionLine,
        cursor: 0,
        startedMs: systemClock.now(),
        attempts: 0,
      });
      setSolveStatus("pending");
      setLoading(false);
    }
  }, [initialDrill]);

  // Scan up to 3 recent games with Stockfish client-side.
  useEffect(() => {
    if (initialDrill || scanStartedRef.current) return;
    if (pendingGames.isLoading || library.isLoading) return;

    scanStartedRef.current = true;

    async function scanGames() {
      const candidates = pendingGames.data ?? [];

      if (candidates.length === 0) {
        setDrill(STARTER_BLUNDER_DRILL);
        setBoardFen(STARTER_BLUNDER_DRILL.fen);
        setSolveState({
          position: STARTER_BLUNDER_DRILL.fen,
          solutionLine: STARTER_BLUNDER_DRILL.solutionLine,
          cursor: 0,
          startedMs: systemClock.now(),
          attempts: 0,
        });
        setLoading(false);
        return;
      }

      if (typeof window === "undefined" || typeof Worker === "undefined") {
        setDrill(STARTER_BLUNDER_DRILL);
        setBoardFen(STARTER_BLUNDER_DRILL.fen);
        setSolveState({
          position: STARTER_BLUNDER_DRILL.fen,
          solutionLine: STARTER_BLUNDER_DRILL.solutionLine,
          cursor: 0,
          startedMs: systemClock.now(),
          attempts: 0,
        });
        setLoading(false);
        return;
      }

      try {
        const { StockfishAnalysisEngine } = await import("@/analysis");
        const engine = new StockfishAnalysisEngine();
        await engine.init();

        try {
          for (const game of candidates.slice(0, 3)) {
            const userColor = game.color === "b" ? "b" : "w";
            const features = await engine.analyzeGame(
              game.pgn,
              { depth: DEFAULT_ANALYSIS_DEPTH },
              { userColor },
            );

            const majorBlunders = features.blunders.filter(
              (b) => b.cpLoss >= 150,
            );

            if (majorBlunders.length > 0) {
              const bestMoveByPly: Record<number, string> = {};
              for (const blunder of majorBlunders) {
                const evalRes = await engine.analyzePosition(blunder.fen, {
                  depth: DEFAULT_ANALYSIS_DEPTH,
                });
                if (evalRes.bestMove) {
                  bestMoveByPly[blunder.ply] = evalRes.bestMove;
                }
              }

              const derived = deriveBlunderDrills(
                {
                  gameId: game.id,
                  blunders: features.blunders,
                  bestMoveByPly,
                },
                { minCpLoss: 150 },
              );

              if (derived.length > 0) {
                const found = derived[0]!;
                const foundDrill: BlunderDrillData = {
                  fen: found.fen,
                  solutionLine: found.solutionLine,
                  source: "game",
                  gameId: game.id,
                  title: "Real game blunder drill",
                  description: game.opening
                    ? `From your game in the ${game.opening}. Find the winning move.`
                    : "From your recent game. Find the winning move.",
                  gameInfo: game.opening ?? "Recent game",
                };

                setDrill(foundDrill);
                setBoardFen(foundDrill.fen);
                setSolveState({
                  position: foundDrill.fen,
                  solutionLine: foundDrill.solutionLine,
                  cursor: 0,
                  startedMs: systemClock.now(),
                  attempts: 0,
                });
                setLoading(false);
                return;
              }
            }
          }
        } finally {
          engine.dispose();
        }

        setDrill(STARTER_BLUNDER_DRILL);
        setBoardFen(STARTER_BLUNDER_DRILL.fen);
        setSolveState({
          position: STARTER_BLUNDER_DRILL.fen,
          solutionLine: STARTER_BLUNDER_DRILL.solutionLine,
          cursor: 0,
          startedMs: systemClock.now(),
          attempts: 0,
        });
      } catch {
        setDrill(STARTER_BLUNDER_DRILL);
        setBoardFen(STARTER_BLUNDER_DRILL.fen);
        setSolveState({
          position: STARTER_BLUNDER_DRILL.fen,
          solutionLine: STARTER_BLUNDER_DRILL.solutionLine,
          cursor: 0,
          startedMs: systemClock.now(),
          attempts: 0,
        });
      } finally {
        setLoading(false);
      }
    }

    void scanGames();
  }, [
    initialDrill,
    pendingGames.data,
    pendingGames.isLoading,
    library.isLoading,
  ]);

  const playerColor = useMemo(() => {
    try {
      return new Chess(drill.fen).turn();
    } catch {
      return "w";
    }
  }, [drill.fen]);

  const orientation = playerColor === "b" ? "black" : "white";

  const turn = useMemo(() => {
    try {
      return new Chess(boardFen).turn();
    } catch {
      return "w";
    }
  }, [boardFen]);

  const turnLabel = turn === "w" ? "White to move" : "Black to move";

  const handleMove = useCallback(
    (move: BoardMove) => {
      if (solveStatus === "solved") return;

      const result = stepSolve(solveState, {
        san: move.san,
        atMs: systemClock.now(),
      });
      setSolveState(result.state);

      if (result.step === "solved") {
        setBoardFen(result.state.position);
        setSolveStatus("solved");
      } else if (result.step === "wrong") {
        setSolveStatus("wrong");
        if (result.transientPosition) {
          setBoardFen(result.transientPosition);
          setTimeout(() => {
            setBoardFen(result.checkpointPosition);
          }, 750);
        }
      } else {
        setBoardFen(result.state.position);
        setSolveStatus("correct");
      }
    },
    [solveState, solveStatus],
  );

  const handleReset = useCallback(() => {
    setSolveState({
      position: drill.fen,
      solutionLine: drill.solutionLine,
      cursor: 0,
      startedMs: systemClock.now(),
      attempts: solveState.attempts + 1,
    });
    setBoardFen(drill.fen);
    setSolveStatus("pending");
  }, [drill, solveState.attempts]);

  return (
    <Card className={cn("settle [animation-delay:120ms]", className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-serif text-2xl font-semibold">
            {drill.title ?? "Instant blunder drill"}
          </CardTitle>
          <span className="rounded border border-line bg-paper/60 px-2 py-0.5 font-mono text-[11px] text-graphite uppercase tracking-wider">
            {drill.source === "game" ? "Your game" : "Starter drill"}
          </span>
        </div>
        <p className="text-graphite font-mono text-sm mt-1">
          {drill.description ??
            "Solve a tactical mistake from your games or a classic starter position."}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <StatusMessage tone="loading">
            Scanning your games for turning points…
          </StatusMessage>
        ) : (
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
            <div className={cn("shrink-0", BOARD_SIZE_CLASS)}>
              <InteractiveBoard
                fen={boardFen}
                orientation={orientation}
                onMove={handleMove}
                disabled={solveStatus === "solved"}
              />
            </div>

            <div className="flex flex-1 flex-col gap-4 w-full">
              <div className="flex items-center justify-between border-b border-line/80 pb-3">
                <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                  <span
                    className={cn(
                      "inline-block h-3 w-3 rounded-full border",
                      turn === "w"
                        ? "border-graphite/40 bg-paper"
                        : "border-ink bg-ink",
                    )}
                    aria-hidden="true"
                  />
                  <span>{turnLabel}</span>
                </div>
                {drill.gameInfo && (
                  <span className="font-mono text-xs text-graphite">
                    {drill.gameInfo}
                  </span>
                )}
              </div>

              {solveStatus === "solved" && (
                <div className="flex flex-col gap-3 rounded-lg border border-evergreen/30 bg-evergreen/10 p-4 text-ink">
                  <div className="flex items-center gap-2 text-evergreen font-semibold text-sm">
                    <Check className="h-4 w-4" />
                    <span>Correct! You found the winning tactic.</span>
                  </div>
                  <p className="text-sm font-serif text-graphite">
                    Mainline converts your real game blunders into spaced
                    repetition drills automatically.
                  </p>
                  <div className="pt-2">
                    {onContinue ? (
                      <Button
                        type="button"
                        onClick={onContinue}
                        className="w-full sm:w-auto"
                      >
                        Continue to Daily Training →
                      </Button>
                    ) : (
                      <Link
                        href="/today"
                        className={cn(
                          buttonVariants(),
                          "w-full sm:w-auto text-center",
                        )}
                      >
                        Continue to Daily Training →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {solveStatus === "wrong" && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-clay/30 bg-clay/10 p-3 text-clay">
                  <span className="text-sm font-medium">
                    Not quite. Try another move.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              )}

              {solveStatus === "pending" && (
                <div className="flex flex-col gap-2 rounded-lg border border-line bg-paper/40 p-4">
                  <p className="text-sm font-serif text-ink">
                    Make the best move on the board to solve this position.
                  </p>
                  <p className="font-mono text-xs text-graphite">
                    Drag a piece or click the source and destination squares.
                  </p>
                </div>
              )}

              {solveStatus === "correct" && (
                <div className="flex items-center gap-2 rounded-lg border border-evergreen/20 bg-evergreen/5 p-3 text-evergreen text-sm font-medium">
                  <span>Good move. Keep going.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
