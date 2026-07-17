"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  BOARD_SIZE_CLASS,
  InteractiveBoard,
} from "@/components/interactive-board";
import { EndgameDrillSession } from "@/app/train/[itemId]/endgame-drill";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import {
  puzzleToSolveState,
  drillToSolveState,
  type BoardOrientation,
} from "@/engine/interactive/puzzle";
import { systemClock } from "@/lib/clock";
import {
  allottedTrainingMs,
  formatTrainingCountdown,
  trainingDeadlineMs,
  trainingTimeRemainingMs,
} from "@/lib/training-timer";
import {
  resultAdvanceBlocked,
  resultAdvanceLabel,
  resultPersistenceState,
} from "@/lib/result-persistence";
import { cn } from "@/lib/utils";
import { humanizeTheme } from "@/integrations/puzzles/themes";

// One board-solvable item (a Lichess puzzle or a personal blunder drill), as returned by
// program.getTrainItem. Both render on the same board + redo flow; only the solve-state
// construction (a puzzle has an opponent setup move, a drill does not) and the logged event
// type differ by `kind`.
type TrainData = inferRouterOutputs<AppRouter>["program"]["getTrainItem"];
type Solvable = TrainData["solvables"][number];

interface TrainItemProps {
  programItemId: string;
}

export function TrainItem({ programItemId }: TrainItemProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data, isLoading, error, refetch, isFetching } =
    trpc.program.getTrainItem.useQuery({ programItemId });

  const logMutation = trpc.tracker.logOutcome.useMutation({
    onSuccess: () => {
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
    },
  });
  const completionMutation = trpc.tracker.completeProgramItem.useMutation({
    onSuccess: () => {
      void utils.program.getToday.invalidate();
      void utils.program.history.invalidate();
    },
  });
  const completionRequestIdRef = useRef<string | null>(null);
  const completeProgramItem = completionMutation.mutate;

  // Solving states
  const [solvables, setSolvables] = useState<Solvable[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [solveState, setSolveState] = useState<SolveState | null>(null);
  const [boardPosition, setBoardPosition] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<BoardOrientation>("white");
  const [solveStatus, setSolveStatus] = useState<
    "pending" | "correct" | "wrong" | "solved"
  >("pending");

  // Timer for elapsed solve time
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Redo Flow States
  const [firstTryPassed, setFirstTryPassed] = useState<boolean>(true);
  const [retestQueue, setRetestQueue] = useState<Solvable[]>([]);
  const [phase, setPhase] = useState<
    "training" | "delay" | "retest" | "complete"
  >("training");
  const [finishReason, setFinishReason] = useState<
    "completed" | "manual" | "time_up"
  >("completed");
  const [advanceAfterSave, setAdvanceAfterSave] = useState(false);

  // Hint State (Phase 1)
  const [hintActive, setHintActive] = useState<boolean>(false);
  const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);

  // Delay Phase State (Phase 2). The wait length is a Seam-6 config value (L1).
  const retestDelaySec = data?.redoFlow.retestDelaySec ?? 0;
  const [delayRemaining, setDelayRemaining] = useState<number>(retestDelaySec);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [sessionRemainingMs, setSessionRemainingMs] = useState<number | null>(
    null,
  );
  const sessionDeadlineRef = useRef<number | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const finishSession = useCallback(
    (reason: "completed" | "manual" | "time_up") => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (delayTimerRef.current) clearInterval(delayTimerRef.current);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      timerRef.current = null;
      feedbackTimerRef.current = null;
      delayTimerRef.current = null;
      sessionTimerRef.current = null;
      if (!completionRequestIdRef.current) {
        completionRequestIdRef.current = crypto.randomUUID();
        completeProgramItem({
          requestId: completionRequestIdRef.current,
          programItemId,
        });
      }
      setFinishReason(reason);
      setPhase("complete");
    },
    [completeProgramItem, programItemId],
  );

  const initSolvable = useCallback((s: Solvable) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    const now = systemClock.now();
    const { solveState: setup, orientation: playerSide } =
      s.kind === "blunder_drill"
        ? drillToSolveState(s.fen, s.line, now)
        : puzzleToSolveState(s.fen, s.line.join(" "), now);

    setSolveState(setup);
    setBoardPosition(setup.position);
    setOrientation(playerSide);
    setSolveStatus("pending");
    setElapsedMs(0);
    setFirstTryPassed(true);
    setHintActive(false);
    setHighlightedSquares([]);

    timerRef.current = setInterval(() => {
      setElapsedMs(Math.max(0, systemClock.now() - now));
    }, 100);
  }, []);

  const activeSolvable =
    phase === "retest" ? retestQueue[currentIdx] : solvables[currentIdx];

  // Initialise solvables when loaded
  useEffect(() => {
    if (data?.solvables) {
      setSolvables(data.solvables);
      setCurrentIdx(0);
      setRetestQueue([]);
      setFinishReason("completed");
      setPhase(data.solvables.length > 0 ? "training" : "complete");
    }
  }, [data]);

  useEffect(() => {
    sessionDeadlineRef.current = null;
    setSessionRemainingMs(null);
  }, [programItemId]);

  useEffect(() => {
    if ((phase === "training" || phase === "retest") && activeSolvable) {
      initSolvable(activeSolvable);
    }
  }, [activeSolvable, initSolvable, phase]);

  const scheduledDurationMs = allottedTrainingMs(data?.item.estMinutes);
  useEffect(() => {
    if (
      scheduledDurationMs === null ||
      data?.solvables.length === 0 ||
      data?.item.activityType === "endgame_drill" ||
      phase === "complete"
    ) {
      return;
    }

    sessionDeadlineRef.current ??= trainingDeadlineMs(
      systemClock.now(),
      data?.item.estMinutes,
    );
    const deadlineMs = sessionDeadlineRef.current;
    if (deadlineMs === null) return;

    const updateRemaining = () => {
      const remainingMs = trainingTimeRemainingMs(
        deadlineMs,
        systemClock.now(),
      );
      setSessionRemainingMs(remainingMs);
      if (remainingMs === 0) finishSession("time_up");
      return remainingMs;
    };

    if (updateRemaining() === 0) return;
    const timer = setInterval(updateRemaining, 250);
    sessionTimerRef.current = timer;

    return () => {
      clearInterval(timer);
      if (sessionTimerRef.current === timer) sessionTimerRef.current = null;
    };
  }, [
    data?.item.activityType,
    data?.item.estMinutes,
    data?.solvables.length,
    finishSession,
    phase,
    scheduledDurationMs,
  ]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (delayTimerRef.current) clearInterval(delayTimerRef.current);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, []);

  // Log one outcome, routing to the right event type by kind (puzzle_attempt vs drill_done).
  const logOutcome = (s: Solvable, correct: boolean, solveTimeMs: number) => {
    if (s.kind === "blunder_drill") {
      return logMutation.mutateAsync({
        requestId: crypto.randomUUID(),
        programItemId,
        completeProgramItem: false,
        type: "drill_done",
        correct,
        solveTimeMs,
        practiceItemId: s.id,
      });
    } else {
      return logMutation.mutateAsync({
        requestId: crypto.randomUUID(),
        programItemId,
        completeProgramItem: false,
        type: "puzzle_attempt",
        correct,
        solveTimeMs,
        puzzleId: s.id,
      });
    }
  };

  const persistenceState = resultPersistenceState(
    logMutation.isPending || completionMutation.isPending,
    logMutation.error ?? completionMutation.error,
  );
  const resultBlocked = resultAdvanceBlocked(persistenceState);

  async function retryOutcome() {
    if (completionMutation.error && completionMutation.variables) {
      try {
        await completionMutation.mutateAsync(completionMutation.variables);
      } catch {
        // The mutation state retains the safe, user-facing retry notice.
      }
      return;
    }
    if (!logMutation.variables) return;
    try {
      await logMutation.mutateAsync(logMutation.variables);
      if (advanceAfterSave) {
        setAdvanceAfterSave(false);
        handleNext({ persisted: true });
      }
    } catch {
      // The mutation state retains the safe, user-facing retry notice.
    }
  }

  const handleMove = (move: { san: string }) => {
    if (!solveState || resultBlocked) return;
    const activeList = phase === "retest" ? retestQueue : solvables;
    const current = activeList[currentIdx];
    if (!current) return;
    const isFirstAttempt = solveState.attempts === 0;

    const result = stepSolve(solveState, {
      san: move.san,
      atMs: systemClock.now(),
    });
    setSolveState(result.state);

    if (result.step === "solved") {
      setBoardPosition(result.state.position);
      setSolveStatus("solved");
      if (timerRef.current) clearInterval(timerRef.current);

      // Training mode, solved on the first attempt → log success.
      if (phase === "training" && firstTryPassed && isFirstAttempt) {
        void logOutcome(current, true, result.solveMs).catch(() => undefined);
      }
    } else if (result.step === "wrong") {
      setSolveStatus("wrong");
      setBoardPosition(result.transientPosition ?? result.checkpointPosition);

      // First mistake triggers fail logging and registers the item for retest.
      if (phase === "training" && isFirstAttempt && firstTryPassed) {
        setFirstTryPassed(false);
        void logOutcome(current, false, result.solveMs).catch(() => undefined);
        setRetestQueue((prev) => [...prev, current]);

        // Render the configured scaffold mechanically. The Methodology owns which
        // scaffold is allowed and the evidence-carrying copy shown with it.
        const hint = data?.redoFlow.hint;
        const nextCorrectMove = solveState.solutionLine[solveState.cursor];
        if (hint?.mode === "solution-start-square" && nextCorrectMove) {
          setHighlightedSquares([nextCorrectMove.substring(0, 2)]);
        }
        setHintActive(hint !== undefined);
      }

      const resetPosition = result.checkpointPosition;
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setBoardPosition(resetPosition);
        setSolveStatus((prev) => (prev === "wrong" ? "pending" : prev));
      }, 1500);
    } else if (result.step === "continue" || result.step === "correct") {
      setSolveStatus("correct");
      setBoardPosition(result.state.position);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setSolveStatus((prev) => (prev === "correct" ? "pending" : prev));
      }, 1000);
    }
  };

  function handleNext(options?: {
    persisted?: boolean;
    retestQueueOverride?: Solvable[];
  }) {
    if (resultBlocked && !options?.persisted) return;
    const nextIdx = currentIdx + 1;
    const activeList = phase === "retest" ? retestQueue : solvables;
    const effectiveRetestQueue = options?.retestQueueOverride ?? retestQueue;

    if (nextIdx < activeList.length) {
      setCurrentIdx(nextIdx);
    } else {
      // Finished the current batch.
      if (phase === "training") {
        if (effectiveRetestQueue.length > 0) {
          setPhase("delay");
          setDelayRemaining(retestDelaySec);
          startDelayTimer();
        } else {
          finishSession("completed");
        }
      } else if (phase === "retest") {
        finishSession("completed");
      }
    }
  }

  function startDelayTimer() {
    if (delayTimerRef.current) clearInterval(delayTimerRef.current);
    const timer = setInterval(() => {
      setDelayRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase("retest");
          setCurrentIdx(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    delayTimerRef.current = timer;
  }

  const skipDelay = () => {
    if (delayTimerRef.current) clearInterval(delayTimerRef.current);
    setPhase("retest");
    setCurrentIdx(0);
  };

  const handleSkip = async () => {
    if (resultBlocked) return;
    if (timerRef.current) clearInterval(timerRef.current);

    if (phase === "training") {
      const current = solvables[currentIdx];
      if (!current) return;
      const nextRetestQueue = retestQueue.some((item) => item.id === current.id)
        ? retestQueue
        : [...retestQueue, current];
      setRetestQueue(nextRetestQueue);
      setAdvanceAfterSave(true);
      try {
        await logOutcome(current, false, 0);
      } catch {
        return;
      }
      setAdvanceAfterSave(false);
      handleNext({ persisted: true, retestQueueOverride: nextRetestQueue });
      return;
    }

    handleNext();
  };

  if (isLoading) {
    return (
      <StatusMessage tone="loading">Loading practice session…</StatusMessage>
    );
  }

  if (error || !data) {
    return (
      <ErrorNotice
        error={error}
        heading="Practice session unavailable"
        message="Mainline could not load this training block. Try it again, or return to Today for the latest session."
        onRetry={() => void refetch()}
        retrying={isFetching}
        retryLabel="Reload practice session"
        secondaryAction={
          <Link
            href="/today"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Back to Today
          </Link>
        }
      />
    );
  }

  // M13: an endgame drill is PLAYED OUT vs the engine, not matched to a fixed line. It has
  // its own session surface. Branch after the data load (all hooks above already ran, so hook
  // order is stable).
  if (data.item.activityType === "endgame_drill") {
    return <EndgameDrillSession programItemId={programItemId} data={data} />;
  }

  const formattedSessionTime =
    sessionRemainingMs === null
      ? null
      : formatTrainingCountdown(sessionRemainingMs);

  const activeList = phase === "retest" ? retestQueue : solvables;
  const current = activeList[currentIdx];
  const isDrill = current?.kind === "blunder_drill";

  // Render complete state
  if (phase === "complete") {
    const completionHeading =
      finishReason === "time_up"
        ? "Scheduled time is up"
        : finishReason === "manual"
          ? "Session finished"
          : "Session complete";
    const completionMessage =
      persistenceState === "saving"
        ? "The final result is still being saved. Keep this page open until it finishes."
        : persistenceState === "failed"
          ? "The session is finished, but one result still needs to be saved before you return to Today."
          : finishReason === "time_up"
            ? "This block stopped at its planned limit. Completed puzzle results are saved."
            : finishReason === "manual"
              ? "Completed puzzle results are saved. Unattempted puzzles were left untouched."
              : "Your outcomes have been recorded and any follow-up review work is scheduled in Today.";

    return (
      <div className="flex flex-col gap-6 py-6 settle">
        {(logMutation.error || completionMutation.error) && (
          <ErrorNotice
            error={logMutation.error ?? completionMutation.error}
            heading="Session not saved"
            message="The position results are safe, but this block is not marked complete yet. Try finishing it again."
            onRetry={() => void retryOutcome()}
            retrying={logMutation.isPending || completionMutation.isPending}
            retryLabel="Try finishing session"
          />
        )}
        {persistenceState === "saving" && (
          <StatusMessage tone="loading">Saving final result...</StatusMessage>
        )}
        <Card gutter="A">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-bold">
              {completionHeading}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-graphite font-serif text-sm leading-relaxed">
              {completionMessage}
            </p>
            <Button
              onClick={() => router.push("/today")}
              className="self-start"
              disabled={resultBlocked}
            >
              {resultAdvanceLabel(persistenceState, "Back to Today")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render delay screen (Phase 2). Wait length and rationale come from config (Seam 6).
  if (phase === "delay") {
    const mins = Math.floor(delayRemaining / 60);
    const secs = Math.floor(delayRemaining % 60);
    const formattedTime = `${mins}:${secs.toString().padStart(2, "0")}`;
    const delayMinutes = Math.max(1, Math.round(retestDelaySec / 60));

    return (
      <div className="flex flex-col gap-6 py-6 settle max-w-xl mx-auto">
        <Card gutter="C">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-bold text-center">
              Desirable Difficulty: Spacing Interval
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 text-center">
            {formattedSessionTime && (
              <p
                role="timer"
                aria-label={`${formattedSessionTime} remaining in this training block`}
                className="text-graphite font-mono text-sm"
              >
                Scheduled block left: {formattedSessionTime}
              </p>
            )}
            <div className="bg-paper/40 border rounded-md p-6 my-2">
              <p className="eyebrow !text-xs mb-2">Retest countdown</p>
              <p className="text-5xl font-mono font-bold text-ink tracking-tight tabular-nums">
                {formattedTime}
              </p>
            </div>

            <blockquote className="border-l-4 border-evergreen/40 pl-4 py-1 text-left text-sm text-graphite italic font-serif leading-relaxed">
              &ldquo;{data.redoFlow.rationale.value}&rdquo;
              <cite className="block text-right text-xs mt-1 font-mono not-italic opacity-80">
                Evidence {data.redoFlow.rationale.grade} · tier{" "}
                {data.redoFlow.rationale.tier}
              </cite>
            </blockquote>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-line">
              <Button variant="outline" size="sm" onClick={skipDelay}>
                I&apos;ve waited {delayMinutes} min. Retest now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => finishSession("manual")}
              >
                Finish session
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!current || !solveState || !boardPosition) {
    return (
      <StatusMessage tone="loading">
        Preparing the next practice position…
      </StatusMessage>
    );
  }

  const phaseLabel =
    phase === "retest"
      ? "Phase 3: Retesting Mistakes"
      : isDrill
        ? "Blunder drill"
        : "In-App Practice";

  return (
    <div className="flex flex-col gap-6 py-6 settle">
      {logMutation.error && (
        <ErrorNotice
          error={logMutation.error}
          heading="Result not saved"
          message="The practice board can continue, but this result did not reach your training history. Try saving it again."
          onRetry={() => {
            void retryOutcome();
          }}
          retrying={logMutation.isPending}
          retryLabel="Try saving result"
        />
      )}
      <div className="flex flex-col gap-2 border-b border-line pb-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="eyebrow !text-[0.65rem] uppercase tracking-wider">
            {phaseLabel} · {data.item.label}
          </p>
          <h1 className="text-ink font-serif text-3xl font-bold tracking-tight">
            {phase === "retest"
              ? "Retest this position"
              : isDrill
                ? "Find the missed move"
                : "Current puzzle"}
          </h1>
        </div>
        <span className="text-graphite font-mono text-sm sm:text-right">
          {current.rating != null
            ? `Rating target: ${current.rating}`
            : "From your own game"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        {/* Chessboard View */}
        <div className="flex flex-col items-center gap-3">
          <div
            className={`${BOARD_SIZE_CLASS} flex items-center justify-between px-1`}
          >
            <span className="eyebrow !text-[0.6rem]">
              {orientation === "white" ? "White" : "Black"} to move
            </span>
            <span className="text-graphite font-mono text-xs">
              You play {orientation}
            </span>
          </div>
          <InteractiveBoard
            fen={boardPosition}
            onMove={handleMove}
            orientation={orientation}
            disabled={
              resultBlocked ||
              solveStatus === "solved" ||
              solveStatus === "wrong"
            }
            highlightedSquares={highlightedSquares}
            showEvalBar={data.affordances.showEvalBar}
            showLegalMoveDots={data.affordances.showLegalMoveDots}
            allowArrows={data.affordances.allowArrows}
            allowHover={data.affordances.allowHover}
            className={BOARD_SIZE_CLASS}
          />
          <div
            className={`${BOARD_SIZE_CLASS} flex flex-wrap items-center justify-between gap-2 px-1`}
          >
            {formattedSessionTime && (
              <span
                role="timer"
                aria-label={`${formattedSessionTime} remaining in this training block`}
                className="text-ink font-mono text-xs font-semibold tabular-nums"
              >
                Scheduled time left: {formattedSessionTime}
              </span>
            )}
            <span className="text-graphite ml-auto font-mono text-xs tabular-nums">
              Puzzle elapsed: {(elapsedMs / 1000).toFixed(1)}s
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1"
              onClick={() => finishSession("manual")}
              disabled={resultBlocked}
            >
              Finish session
            </Button>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg">
                {isDrill ? "Find the move you missed" : "Practice Status"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {isDrill && (
                <p className="text-graphite font-serif text-sm leading-relaxed">
                  You blundered in this position in one of your own games. Find
                  the move the engine prefers.
                </p>
              )}
              <div className="flex flex-col gap-2 rounded-md border border-line bg-paper/50 p-4">
                <span className="text-ink font-mono text-xs font-semibold uppercase tracking-wider">
                  Move feedback
                </span>
                <span
                  className={cn(
                    "font-serif text-lg font-semibold",
                    solveStatus === "solved" && "text-evergreen-bright",
                    solveStatus === "wrong" && "text-destructive",
                    solveStatus === "correct" && "text-evergreen",
                    solveStatus === "pending" && "text-graphite",
                  )}
                >
                  {solveStatus === "solved" && "Solved"}
                  {solveStatus === "wrong" && "Wrong move"}
                  {solveStatus === "correct" && "Correct move"}
                  {solveStatus === "pending" &&
                    (isDrill ? "Find the missed move" : "Find the move")}
                </span>
              </div>

              {/* Scaffolded Hint Display (Phase 1) */}
              {hintActive && (
                <div className="flex flex-col gap-2 rounded-md border border-evergreen/20 bg-evergreen/5 p-4 transition-all settle">
                  <span className="text-evergreen font-mono text-xs font-semibold uppercase tracking-wider">
                    Hint
                  </span>
                  <p className="text-sm font-serif text-ink leading-relaxed">
                    {data?.redoFlow.hint.copy}
                    {data?.redoFlow.hint.includeMotifNames &&
                      current.themes.length > 0 && (
                        <>
                          {" "}
                          Look for:{" "}
                          <span className="font-medium text-evergreen">
                            {current.themes
                              .map(humanizeTheme)
                              .slice(0, 3)
                              .join(", ")}
                          </span>
                          .
                        </>
                      )}
                  </p>
                  <p className="text-graphite font-mono text-[0.7rem]">
                    Grade {data?.redoFlow.hint.evidenceGrade} · Tier{" "}
                    {data?.redoFlow.hint.evidenceTier} ·{" "}
                    {data?.redoFlow.hint.citationSource}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 border-t border-line/80 pt-4">
                {solveStatus === "solved" ? (
                  <Button
                    onClick={() => handleNext()}
                    className="w-full"
                    disabled={resultBlocked}
                  >
                    {resultAdvanceLabel(
                      persistenceState,
                      currentIdx + 1 < activeList.length ? "Next" : "Continue",
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => void handleSkip()}
                    disabled={resultBlocked}
                  >
                    Skip / Give Up
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
