"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { trpc } from "@/lib/trpc/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  BOARD_SIZE_CLASS,
  InteractiveBoard,
} from "@/components/interactive-board";
import { createEnginePlay } from "@/engine/interactive/engine-play";
import {
  classifyTerminal,
  scoreEndgame,
  endgameOrientation,
  endgamePlayerColor,
  type EndgameOutcome,
} from "@/engine/interactive/endgame";
import { tablebaseVerdict } from "@/lib/tablebase";
import { systemClock } from "@/lib/clock";
import {
  resultAdvanceBlocked,
  resultAdvanceLabel,
  resultPersistenceState,
} from "@/lib/result-persistence";
import { cn } from "@/lib/utils";

// M13 — play a curated endgame OUT against the client-side chess engine, then judge the
// played-out result against the position's objective (win / hold the draw). The opponent's
// moves come from the in-browser Stockfish (engine-play), so there is zero server compute;
// the optional Lichess tablebase (cached server-side) shows the ground-truth verdict. The
// outcome is auto-logged (`drill_done`) and FSRS-rescheduled by the existing loop, unchanged.

type AnalysisEngine = import("@/analysis").StockfishAnalysisEngine;
type TrainData = inferRouterOutputs<AppRouter>["program"]["getTrainItem"];

// Infra constants (client responsiveness / runaway-game guard), NOT methodology (L1).
const ENGINE_DEPTH = 12;
const MOVE_CAP_PLIES = 80;

export function EndgameDrillSession({
  programItemId,
  data,
}: {
  programItemId: string;
  data: TrainData;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const positions = data.solvables.filter((s) => s.kind === "endgame");

  const logMutation = trpc.tracker.logOutcome.useMutation({
    onSuccess: () => {
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
    },
  });

  const [idx, setIdx] = useState(0);
  const current = positions[idx];
  const completionRequestIdRef = useRef<string | null>(null);
  const completionMutation = trpc.tracker.completeProgramItem.useMutation({
    onSuccess: () => {
      utils.program.getToday.setData(undefined, (currentProgram) => {
        if (!currentProgram) return currentProgram;
        return {
          ...currentProgram,
          items: currentProgram.items.map((item) =>
            item.id === programItemId ? { ...item, status: "done" } : item,
          ),
        };
      });
      void utils.program.getToday.invalidate();
      void utils.program.history.invalidate();
      setIdx(positions.length);
    },
  });
  const persistenceState = resultPersistenceState(
    logMutation.isPending || completionMutation.isPending,
    logMutation.error ?? completionMutation.error,
  );
  const resultBlocked = resultAdvanceBlocked(persistenceState);

  const [fen, setFen] = useState<string>(current?.fen ?? "");
  const [status, setStatus] = useState<"playing" | "thinking" | "done">(
    "playing",
  );
  const [result, setResult] = useState<{
    correct: boolean;
    outcome: EndgameOutcome;
    reason: string;
  } | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const startRef = useRef<number>(systemClock.now());
  const pliesRef = useRef<number>(0);
  const outcomeRequestIdRef = useRef<string | null>(null);

  // Optional tablebase ground truth for the start position (cache-first, server-side).
  const tb = trpc.program.probeTablebase.useQuery(
    { fen: current?.fen ?? "" },
    { enabled: !!current, staleTime: Infinity, refetchOnWindowFocus: false },
  );

  // One reused Stockfish worker, serialised so replies never overlap (mirrors ReviewBoard).
  const [isEngineLoading, setIsEngineLoading] = useState(false);
  const engineRef = useRef<AnalysisEngine | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const getEngine = useCallback(async (): Promise<AnalysisEngine> => {
    if (engineRef.current) return engineRef.current;
    setIsEngineLoading(true);
    try {
      const { SINGLE_THREAD_PLAN, StockfishAnalysisEngine } =
        await import("@/analysis");
      const engine = new StockfishAnalysisEngine(SINGLE_THREAD_PLAN);
      await engine.init();
      engineRef.current = engine;
      return engine;
    } catch (error) {
      engineRef.current?.dispose();
      engineRef.current = null;
      throw error;
    } finally {
      setIsEngineLoading(false);
    }
  }, []);
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Re-initialise when the active position changes.
  useEffect(() => {
    if (!current) return;
    setFen(current.fen);
    setStatus("playing");
    setResult(null);
    setEngineError(null);
    pliesRef.current = 0;
    outcomeRequestIdRef.current = null;
    startRef.current = systemClock.now();
  }, [current]);

  const playerColor = current ? endgamePlayerColor(current.fen) : "w";
  const orientation = current ? endgameOrientation(current.fen) : "white";
  const objective = current?.objective ?? "win";

  const finish = useCallback(
    (finalFen: string, override?: EndgameOutcome) => {
      if (!current) return;
      const outcome = override ?? classifyTerminal(finalFen, playerColor);
      const score = scoreEndgame(outcome, objective);
      setResult({ correct: score.correct, outcome, reason: score.reason });
      setStatus("done");
      outcomeRequestIdRef.current ??= crypto.randomUUID();
      logMutation.mutate({
        requestId: outcomeRequestIdRef.current,
        programItemId,
        completeProgramItem: false,
        type: "drill_done",
        correct: score.correct,
        solveTimeMs: Math.max(0, systemClock.now() - startRef.current),
        practiceItemId: current.id,
      });
    },
    [current, playerColor, objective, logMutation, programItemId],
  );

  const handleMove = useCallback(
    (move: { san: string }) => {
      if (!current || status !== "playing") return;
      const chess = new Chess(fen);
      try {
        chess.move(move.san);
      } catch {
        return; // illegal — board will snap back to `fen`
      }
      const afterUser = chess.fen();
      setFen(afterUser);
      pliesRef.current += 1;

      if (chess.isGameOver()) return finish(afterUser);
      if (pliesRef.current >= MOVE_CAP_PLIES)
        return finish(afterUser, "unresolved");

      // Engine replies from the in-browser Stockfish (serialised).
      setStatus("thinking");
      queueRef.current = queueRef.current.then(async () => {
        try {
          const engine = await getEngine();
          const opponent = createEnginePlay(engine, systemClock);
          const reply = await opponent.getOpponentMove(afterUser, {
            depth: ENGINE_DEPTH,
          });
          const after = new Chess(afterUser);
          after.move(reply.san);
          const afterEngine = after.fen();
          setFen(afterEngine);
          pliesRef.current += 1;
          if (after.isGameOver()) return finish(afterEngine);
          if (pliesRef.current >= MOVE_CAP_PLIES)
            return finish(afterEngine, "unresolved");
          setStatus("playing");
        } catch {
          // Discard a failed worker so the next move gets a clean retry.
          engineRef.current?.dispose();
          engineRef.current = null;
          setEngineError(
            "The local chess engine could not reply. You can continue the position or finish the drill.",
          );
          setStatus("playing");
        }
      });
    },
    [current, status, fen, finish, getEngine],
  );

  const goNext = () => {
    if (idx + 1 < positions.length) {
      setIdx(idx + 1);
      return;
    }
    completionRequestIdRef.current ??= crypto.randomUUID();
    completionMutation.mutate({
      requestId: completionRequestIdRef.current,
      programItemId,
    });
  };

  const [autoAdvanceSec, setAutoAdvanceSec] = useState<number | null>(null);
  const [autoAdvancePaused, setAutoAdvancePaused] = useState<boolean>(false);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isCompleted = positions.length === 0 || idx >= positions.length;

  useEffect(() => {
    if (!isCompleted || !data?.nextItem || autoAdvancePaused || resultBlocked) {
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      return;
    }

    if (autoAdvanceSec === null) {
      setAutoAdvanceSec(4);
      return;
    }

    if (autoAdvanceSec <= 0) {
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      const nextUrl = data.nextItem.url ?? "/today";
      router.push(nextUrl);
      return;
    }

    const timer = setInterval(() => {
      setAutoAdvanceSec((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    autoAdvanceTimerRef.current = timer;

    return () => {
      clearInterval(timer);
      if (autoAdvanceTimerRef.current === timer) {
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [
    autoAdvancePaused,
    autoAdvanceSec,
    data?.nextItem,
    isCompleted,
    resultBlocked,
    router,
  ]);

  // Completed all positions.
  if (isCompleted) {
    return (
      <div className="flex flex-col gap-6 py-6 settle">
        <Card gutter="A">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-bold">
              {positions.length === 0
                ? "No endgame drills due"
                : "Endgame session complete"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-graphite font-serif text-sm leading-relaxed">
              {positions.length === 0
                ? "There are no endgame positions due right now. They will return on their spaced schedule."
                : data.nextItem
                  ? `Each result has been logged. Ready to advance to Block ${data.nextItem.orderIndex + 1}.`
                  : "Each result has been logged and rescheduled for a future review."}
            </p>

            {data.nextItem && (
              <div className="rounded-md border border-evergreen/30 bg-evergreen/[0.04] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow text-evergreen">
                      Next in today&apos;s session
                    </p>
                    <p className="mt-0.5 font-serif text-base font-semibold text-ink">
                      Block {data.nextItem.orderIndex + 1}:{" "}
                      {data.nextItem.label}
                    </p>
                    {!autoAdvancePaused &&
                      autoAdvanceSec !== null &&
                      autoAdvanceSec > 0 &&
                      !resultBlocked && (
                        <p className="text-graphite font-mono text-xs mt-1">
                          Auto-advancing in {autoAdvanceSec}s...
                        </p>
                      )}
                    {autoAdvancePaused && (
                      <p className="text-graphite font-mono text-xs mt-1">
                        Auto-advance paused.
                      </p>
                    )}
                  </div>
                  {!autoAdvancePaused &&
                    autoAdvanceSec !== null &&
                    autoAdvanceSec > 0 &&
                    !resultBlocked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAutoAdvancePaused(true)}
                      >
                        Pause auto-advance
                      </Button>
                    )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {data.nextItem ? (
                <>
                  <Button
                    onClick={() => {
                      if (autoAdvanceTimerRef.current) {
                        clearInterval(autoAdvanceTimerRef.current);
                      }
                      router.push(data.nextItem?.url ?? "/today");
                    }}
                    disabled={resultBlocked}
                  >
                    {resultAdvanceLabel(
                      persistenceState,
                      `Continue to Block ${data.nextItem.orderIndex + 1}`,
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (autoAdvanceTimerRef.current) {
                        clearInterval(autoAdvanceTimerRef.current);
                      }
                      router.push("/today");
                    }}
                    disabled={resultBlocked}
                  >
                    Back to Today
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => router.push("/today")}
                  disabled={resultBlocked}
                >
                  {resultAdvanceLabel(persistenceState, "Back to Today")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const verdict = tb.data ? tablebaseVerdict(tb.data.category) : null;
  const objectiveLabel =
    objective === "win" ? "Win (deliver checkmate)" : "Hold the draw";

  return (
    <div className="flex flex-col gap-6 py-6 settle">
      <div className="flex flex-col gap-2 border-b border-line pb-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="eyebrow !text-[0.65rem] uppercase tracking-wider">
            Endgame drill · {data.item.label}
          </p>
          <h1 className="text-ink font-serif text-3xl font-bold tracking-tight">
            {current?.label ?? "Current endgame"}
          </h1>
        </div>
        <span className="text-graphite font-mono text-sm sm:text-right">
          You play {orientation}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className="flex flex-col items-center gap-3">
          <div
            className={`${BOARD_SIZE_CLASS} flex items-center justify-between px-1`}
          >
            <span className="eyebrow !text-[0.6rem]">
              Objective: {objectiveLabel}
            </span>
            <span className="text-graphite font-mono text-xs">
              {status === "thinking" ? "Engine thinking…" : "Your move"}
            </span>
          </div>
          <InteractiveBoard
            fen={fen}
            onMove={handleMove}
            orientation={orientation}
            disabled={status !== "playing"}
            highlightedSquares={[]}
            showEvalBar={data.affordances.showEvalBar}
            showLegalMoveDots={data.affordances.showLegalMoveDots}
            allowArrows={data.affordances.allowArrows}
            allowHover={data.affordances.allowHover}
            className={BOARD_SIZE_CLASS}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg">
                Play it out vs the engine
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-graphite font-serif text-sm leading-relaxed">
                Convert this endgame against the engine. The result is judged on
                whether you achieve the objective.
              </p>

              {isEngineLoading && (
                <StatusMessage tone="loading">
                  Initializing Stockfish WASM engine in browser...
                </StatusMessage>
              )}

              {engineError && (
                <StatusMessage tone="error" heading="Engine unavailable">
                  {engineError}
                </StatusMessage>
              )}

              {tb.error && (
                <ErrorNotice
                  error={tb.error}
                  heading="Tablebase check unavailable"
                  message="The drill still works with the local engine, but Mainline could not verify the starting result."
                  onRetry={() => void tb.refetch()}
                  retrying={tb.isFetching}
                  retryLabel="Retry tablebase check"
                />
              )}

              {logMutation.error && (
                <ErrorNotice
                  error={logMutation.error}
                  heading="Result not saved"
                  message="This drill is still open and its review schedule is unchanged. Try saving the same result again."
                  onRetry={() => {
                    if (logMutation.variables) {
                      logMutation.mutate(logMutation.variables);
                    }
                  }}
                  retrying={logMutation.isPending}
                  retryLabel="Try saving result"
                />
              )}

              {completionMutation.error && (
                <ErrorNotice
                  error={completionMutation.error}
                  heading="Session not saved"
                  message="Each endgame result is safe, but this block is not marked complete yet. Try finishing it again."
                  onRetry={() => {
                    if (completionMutation.variables) {
                      completionMutation.mutate(completionMutation.variables);
                    }
                  }}
                  retrying={completionMutation.isPending}
                  retryLabel="Try finishing session"
                />
              )}

              {/* Tablebase ground truth (optional oracle). */}
              {verdict && (
                <div className="flex flex-col gap-1.5 rounded-md border border-line bg-paper/40 p-4">
                  <span className="text-graphite font-mono text-[0.65rem] font-semibold uppercase tracking-wider">
                    Tablebase ground truth
                  </span>
                  <p className="text-sm font-serif text-ink leading-relaxed">
                    {verdict === "win"
                      ? "This is a theoretical win. Convert it."
                      : verdict === "draw"
                        ? "This is a theoretical draw. Hold it."
                        : "This is theoretically lost for you. Try to hold on."}
                    {tb.data?.dtz != null && ` (DTZ ${Math.abs(tb.data.dtz)}).`}
                  </p>
                </div>
              )}

              {/* Result. */}
              {result && (
                <div
                  className={cn(
                    "flex flex-col gap-1.5 rounded-md border p-4",
                    result.correct
                      ? "border-grade-a/30 bg-grade-a/5"
                      : "border-grade-d/30 bg-grade-d/5",
                  )}
                >
                  <span
                    className={cn(
                      "font-serif text-lg font-semibold",
                      result.correct
                        ? "text-evergreen-bright"
                        : "text-destructive",
                    )}
                  >
                    {result.correct ? "✓ Objective met" : "✗ Not this time"}
                  </span>
                  <p className="text-graphite font-serif text-sm leading-relaxed">
                    {result.reason}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-line/80 pt-4">
                {status === "done" ? (
                  <Button
                    onClick={goNext}
                    className="w-full"
                    disabled={resultBlocked}
                  >
                    {resultAdvanceLabel(
                      persistenceState,
                      idx + 1 < positions.length ? "Next endgame" : "Finish",
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => finish(fen, "unresolved")}
                    disabled={status === "thinking" || resultBlocked}
                  >
                    I can&apos;t convert this
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={resultBlocked}
                  onClick={() => router.push("/today")}
                >
                  {resultAdvanceLabel(persistenceState, "Back to Today")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
