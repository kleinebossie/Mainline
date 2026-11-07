"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Volume2,
  VolumeX,
} from "lucide-react";

import { trpc } from "@/lib/trpc/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { FocusShell } from "@/components/focus-shell";
import {
  InteractiveBoard,
  type BoardFeedback,
} from "@/components/interactive-board";
import { WhyButton } from "@/components/ui/why-button";
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
import { useSoundEnabled } from "@/lib/sound";
import {
  recordGuestActivityEvent,
  updateGuestProgramItemStatus,
} from "@/lib/guest-session";

type AnalysisEngine = import("@/analysis").StockfishAnalysisEngine;
type TrainData =
  NonNullable<inferRouterOutputs<AppRouter>["program"]["getTrainItem"]>;

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
  const [soundEnabled, setSoundEnabled] = useSoundEnabled();
  const positions = data.solvables.filter((s) => s.kind === "endgame");

  const me = trpc.account.me.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const isGuest = me.data ? !me.data.authenticated : true;

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
  const persistenceState = isGuest
    ? "ready"
    : resultPersistenceState(
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
  const [boardFeedback, setBoardFeedback] = useState<BoardFeedback | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const startRef = useRef<number>(systemClock.now());
  const pliesRef = useRef<number>(0);
  const outcomeRequestIdRef = useRef<string | null>(null);

  // Tablebase ground truth
  const tb = trpc.program.probeTablebase.useQuery(
    { fen: current?.fen ?? "" },
    { enabled: Boolean(current), staleTime: Infinity, refetchOnWindowFocus: false },
  );

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

  useEffect(() => {
    if (!current) return;
    setFen(current.fen);
    setStatus("playing");
    setResult(null);
    setBoardFeedback(null);
    setEngineError(null);
    pliesRef.current = 0;
    outcomeRequestIdRef.current = null;
    startRef.current = systemClock.now();
  }, [current]);

  const playerColor = current ? endgamePlayerColor(current.fen) : "w";
  const orientation = current ? endgameOrientation(current.fen) : "white";
  const objective = current?.objective ?? "win";

  const finish = useCallback(
    (finalFen: string, override?: EndgameOutcome, lastSquare?: string) => {
      if (!current) return;
      const outcome = override ?? classifyTerminal(finalFen, playerColor);
      const score = scoreEndgame(outcome, objective);
      setResult({ correct: score.correct, outcome, reason: score.reason });
      if (lastSquare) {
        setBoardFeedback({
          square: lastSquare,
          kind: score.correct ? "correct" : "mistake",
        });
      }
      setStatus("done");

      if (isGuest) {
        recordGuestActivityEvent({
          type: "drill_done",
          programItemId,
          payload: {
            correct: score.correct,
            solveTimeMs: Math.max(0, systemClock.now() - startRef.current),
            practiceItemId: current.id,
          },
        });
      } else {
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
      }
    },
    [current, playerColor, objective, isGuest, logMutation, programItemId],
  );

  const handleMove = useCallback(
    (move: { san: string }) => {
      if (!current || status !== "playing") return;
      const chess = new Chess(fen);
      let moveObj;
      try {
        moveObj = chess.move(move.san);
      } catch {
        return; // illegal: board will snap back to `fen`
      }
      const afterUser = chess.fen();
      setFen(afterUser);
      pliesRef.current += 1;

      if (chess.isGameOver()) return finish(afterUser, undefined, moveObj?.to);
      if (pliesRef.current >= MOVE_CAP_PLIES)
        return finish(afterUser, "unresolved", moveObj?.to);

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
          const engineMoveObj = after.move(reply.san);
          const afterEngine = after.fen();
          setFen(afterEngine);
          pliesRef.current += 1;
          if (after.isGameOver())
            return finish(afterEngine, undefined, engineMoveObj?.to);
          if (pliesRef.current >= MOVE_CAP_PLIES)
            return finish(afterEngine, "unresolved", engineMoveObj?.to);
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

  const goNext = useCallback(() => {
    if (resultBlocked) return;
    const nextIdx = idx + 1;
    if (nextIdx < positions.length) {
      setIdx(nextIdx);
    } else {
      if (isGuest) {
        updateGuestProgramItemStatus(programItemId, "done");
        setIdx(positions.length);
      } else {
        completionRequestIdRef.current ??= crypto.randomUUID();
        completionMutation.mutate({
          requestId: completionRequestIdRef.current,
          programItemId,
        });
      }
    }
  }, [
    completionMutation,
    idx,
    isGuest,
    positions.length,
    programItemId,
    resultBlocked,
  ]);

  const isCompleted = idx >= positions.length;

  // Auto-advance countdown on complete
  const [autoAdvanceSec, setAutoAdvanceSec] = useState<number | null>(null);
  const [autoAdvancePaused] = useState<boolean>(false);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (
      !isCompleted ||
      !data?.nextItem ||
      autoAdvancePaused ||
      resultBlocked
    ) {
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      return;
    }

    if (autoAdvanceSec === null) {
      setAutoAdvanceSec(5);
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

  if (isCompleted) {
    return (
      <FocusShell
        title={data.item.label}
        exitHref="/today"
        mainClassName="flex items-center justify-center"
      >
        <div className="w-full max-w-lg rounded-lg border border-line bg-paper-raised p-6 sm:p-8 shadow-sm flex flex-col gap-5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-evergreen/10 px-3 py-1 font-sans text-xs font-semibold text-evergreen">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {data.nextItem ? "Block complete" : "Session complete"}
            </span>
          </div>

          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">
              {positions.length === 0
                ? "No endgame drills due"
                : data.nextItem
                  ? "Block complete"
                  : "Session complete"}
            </h2>
            <p className="mt-1 font-sans text-sm text-graphite">
              {positions.length === 0
                ? "There are no endgame positions due right now."
                : "Each endgame result has been recorded."}
            </p>
          </div>

          {data.nextItem ? (
            <div className="rounded-md border border-line bg-paper p-4 flex flex-col gap-1.5">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-graphite">
                Up next
              </span>
              <h3 className="font-sans text-base font-semibold text-ink">
                {data.nextItem.label}
                {data.nextItem.estMinutes ? ` (${data.nextItem.estMinutes} min)` : ""}
              </h3>
              <p className="font-sans text-xs text-graphite">
                Block {data.nextItem.orderIndex + 1} of today&apos;s session.
              </p>
              {!autoAdvancePaused &&
                autoAdvanceSec !== null &&
                autoAdvanceSec > 0 &&
                !resultBlocked && (
                  <p className="font-mono text-xs text-graphite mt-1">
                    Auto-advancing in {autoAdvanceSec}s…
                  </p>
                )}
            </div>
          ) : (
            <div className="rounded-md border border-line bg-paper p-4">
              <p className="font-sans text-sm text-graphite">
                All blocks in today&apos;s session are complete.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
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
                  className="min-h-[44px] w-full"
                >
                  {resultAdvanceLabel(persistenceState, "Continue")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (autoAdvanceTimerRef.current) {
                      clearInterval(autoAdvanceTimerRef.current);
                    }
                    router.push("/today");
                  }}
                  disabled={resultBlocked}
                  className="text-graphite hover:text-ink w-full"
                >
                  Back to Today
                </Button>
              </>
            ) : (
              <Button
                onClick={() => router.push("/today")}
                disabled={resultBlocked}
                className="min-h-[44px] w-full"
              >
                {resultAdvanceLabel(persistenceState, "Back to Today")}
              </Button>
            )}
          </div>
        </div>
      </FocusShell>
    );
  }

  const verdict = tb.data ? tablebaseVerdict(tb.data.category) : null;
  const promptTitle = `${orientation === "white" ? "White" : "Black"} to move. ${objective === "win" ? "Win this endgame." : "Hold the draw."}`;

  const progressSlot = (
    <div className="flex items-center gap-2">
      <span className="font-sans text-xs font-semibold text-graphite tabular-nums">
        {idx + 1} of {positions.length}
      </span>
    </div>
  );

  const controlsSlot = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setSoundEnabled(!soundEnabled)}
        aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
        title={soundEnabled ? "Mute move sounds" : "Enable move sounds"}
        className="inline-flex h-8 w-8 items-center justify-center rounded-xs text-graphite hover:text-ink hover:bg-ink/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {soundEnabled ? (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <WhyButton
        rationaleText={data.item.rationaleText}
        evidenceGrade={data.item.evidenceGrade}
        evidenceTier={data.item.evidenceTier}
        citationKey={data.item.citationKey}
        citationSource={data.item.citationSource}
        title={data.item.label}
      />
    </div>
  );

  return (
    <FocusShell
      title={data.item.label}
      progressSlot={progressSlot}
      controlsSlot={controlsSlot}
      exitHref="/today"
      mainClassName="flex flex-col justify-center py-2"
    >
      <div className="w-full max-w-wide mx-auto flex flex-col items-center justify-center md:flex-row md:items-center md:justify-center md:gap-10">
        {/* Board column */}
        <div className="w-full max-w-[min(100%,350px)] md:max-w-[min(540px,calc(100vh-140px))] aspect-square shrink-0 flex items-center justify-center">
          <InteractiveBoard
            fen={fen}
            onMove={handleMove}
            orientation={orientation}
            disabled={status !== "playing"}
            highlightedSquares={[]}
            feedback={boardFeedback}
            showEvalBar={data.affordances.showEvalBar}
            showLegalMoveDots={data.affordances.showLegalMoveDots}
            allowArrows={data.affordances.allowArrows}
            allowHover={data.affordances.allowHover}
            className="w-full h-full"
          />
        </div>

        {/* Info & action panel column */}
        <div className="w-full max-w-[350px] md:w-[360px] flex flex-col gap-3 md:gap-4 mt-2 md:mt-0 justify-center">
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-xs font-medium text-graphite uppercase tracking-wide">
              {current?.label ?? "Endgame drill"}
            </span>
            <h1 className="font-serif text-base sm:text-lg font-semibold text-ink leading-snug">
              {promptTitle}
            </h1>
          </div>

          {/* Engine status indicator */}
          {status === "thinking" && (
            <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-xs text-graphite">
              <span className="h-2 w-2 rounded-full bg-evergreen animate-ping" />
              <span>Stockfish engine is thinking…</span>
            </div>
          )}

          {isEngineLoading && (
            <StatusMessage tone="loading">
              Starting local engine in browser…
            </StatusMessage>
          )}

          {engineError && (
            <StatusMessage tone="error" heading="Engine issue">
              {engineError}
            </StatusMessage>
          )}

          {/* Tablebase oracle */}
          {verdict && (
            <div className="rounded-md border border-line bg-paper/60 px-3 py-2 text-xs text-graphite">
              <span className="font-semibold text-ink">Tablebase: </span>
              {verdict === "win"
                ? "Theoretical win."
                : verdict === "draw"
                  ? "Theoretical draw."
                  : "Theoretically lost."}
              {tb.data?.dtz != null && ` DTZ ${Math.abs(tb.data.dtz)}.`}
            </div>
          )}

          {/* Result banner */}
          {result && (
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm animate-in fade-in duration-120",
                result.correct
                  ? "border-evergreen/30 bg-evergreen/10 text-evergreen-bright"
                  : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              {result.correct ? (
                <Check className="h-4 w-4 shrink-0 text-evergreen" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              )}
              <span className="font-medium text-xs leading-normal">
                {result.reason}
              </span>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2.5 pt-0.5">
            {status === "done" ? (
              <Button
                onClick={goNext}
                className="flex-1 min-h-[44px]"
                disabled={resultBlocked}
              >
                {resultAdvanceLabel(
                  persistenceState,
                  idx + 1 < positions.length ? "Next endgame" : "Continue",
                )}
                <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden="true" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => finish(fen, "unresolved")}
                  disabled={status === "thinking" || resultBlocked}
                  className="min-h-[44px] flex-1 text-xs"
                >
                  I cannot convert this
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => router.push("/today")}
                  disabled={resultBlocked}
                  className="text-graphite hover:text-ink min-h-[44px]"
                >
                  Exit
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </FocusShell>
  );
}
