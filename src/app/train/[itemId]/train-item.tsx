"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { UnavailableTrainingBlock } from "@/app/train/[itemId]/unavailable-training-block";
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
import { GradeMark } from "@/components/evidence";
import { itemSummary } from "@/app/today/today-copy";
import {
  getGuestSession,
  updateGuestProgramItemStatus,
  recordGuestActivityEvent,
  hasSeenAnalysisIntro,
  markSeenAnalysisIntro,
} from "@/lib/guest-session";

import { getGuestTrainItemData } from "@/lib/guest-solvables";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const guestItem = useMemo(() => {
    if (!mounted || typeof window === "undefined") return null;
    return (
      getGuestSession().program?.items.find((it) => it.id === programItemId) ??
      null
    );
  }, [mounted, programItemId]);

  const {

    data: serverData,
    isLoading: serverLoading,
    error: serverError,
    refetch,
    isFetching,
  } = trpc.program.getTrainItem.useQuery(
    { programItemId },
    { retry: false },
  );

  const connectionsQuery = trpc.connections.list.useQuery(undefined, {
    retry: false,
  });

  const guestTrainData = useMemo(() => {
    return guestItem ? getGuestTrainItemData(guestItem) : null;
  }, [guestItem]);

  const isGuest = Boolean(
    !serverLoading && (serverError != null || !serverData) && guestTrainData != null
  );

  const data = serverData ?? (isGuest ? (guestTrainData as unknown as TrainData) : null);
  const isLoading = !mounted || (serverLoading && !guestTrainData);
  const error = isGuest ? null : serverError;

  const logMutation = trpc.tracker.logOutcome.useMutation({
    onSuccess: () => {
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
    },
  });
  const completionMutation = trpc.tracker.completeProgramItem.useMutation({
    onSuccess: () => {
      utils.program.getToday.setData(undefined, (current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) =>
            item.id === programItemId ? { ...item, status: "done" } : item,
          ),
        };
      });
      void utils.program.getToday.invalidate();
      void utils.program.history.invalidate();
    },
  });
  const completionRequestIdRef = useRef<string | null>(null);
  const completeProgramItem = completionMutation.mutate;
  const emptyCloseRequestIdRef = useRef<string | null>(null);
  const emptyCloseMutation = trpc.tracker.logOutcome.useMutation({
    onSuccess: () => {
      utils.program.getToday.setData(undefined, (current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) =>
            item.id === programItemId ? { ...item, status: "done" } : item,
          ),
        };
      });
      void utils.program.getToday.invalidate();
      void utils.program.history.invalidate();
      router.push("/today");
    },
  });

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

  // Auto-advance State
  const [autoAdvanceSec, setAutoAdvanceSec] = useState<number | null>(null);
  const [autoAdvancePaused, setAutoAdvancePaused] = useState<boolean>(false);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

      if (isGuest) {
        updateGuestProgramItemStatus(programItemId, "done");
      } else if (!completionRequestIdRef.current) {
        completionRequestIdRef.current = crypto.randomUUID();
        completeProgramItem({
          requestId: completionRequestIdRef.current,
          programItemId,
        });
      }
      setFinishReason(reason);
      setPhase("complete");
    },
    [completeProgramItem, programItemId, isGuest],
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
    completionRequestIdRef.current = null;
    emptyCloseRequestIdRef.current = null;
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
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  // Log one outcome, routing to the right event type by kind (puzzle_attempt vs drill_done).
  const logOutcome = async (
    s: Solvable,
    correct: boolean,
    solveTimeMs: number,
  ) => {
    if (isGuest) {
      recordGuestActivityEvent({
        type: s.kind === "blunder_drill" ? "drill_done" : "puzzle_attempt",
        programItemId,
        payload: {
          correct,
          solveTimeMs,
          solvableId: s.id,
          fen: s.fen,
        },
      });
      return;
    }
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

  const persistenceState = isGuest
    ? "ready"
    : resultPersistenceState(
        logMutation.isPending || completionMutation.isPending,
        logMutation.error ?? completionMutation.error,
      );
  const resultBlocked = resultAdvanceBlocked(persistenceState);

  useEffect(() => {
    if (
      phase !== "complete" ||
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
    phase,
    resultBlocked,
    router,
  ]);

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
      if (firstTryPassed) {
        setAdvanceAfterSave(true);
        try {
          await logOutcome(current, false, 0);
        } catch {
          return;
        } finally {
          setAdvanceAfterSave(false);
        }
      }
      handleNext({
        persisted: firstTryPassed,
        retestQueueOverride: nextRetestQueue,
      });
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

  const isAnalysisActivity =
    data.item.activityType === "analyse" ||
    data.item.activityType === "game_analysis" ||
    data.item.activityType === "review_games" ||
    data.item.activityType === "analyze_mistakes" ||
    data.item.label?.toLowerCase().includes("analyse") ||
    data.item.label?.toLowerCase().includes("analyze") ||
    data.item.label?.toLowerCase().includes("game review");

  if (isAnalysisActivity) {
    const session = getGuestSession();
    const hasLinkedAccount = isGuest
      ? (session.connections && session.connections.length > 0) ||
        Boolean(session.baseline?.username)
      : (connectionsQuery.data && connectionsQuery.data.length > 0) || false;

    if (hasLinkedAccount) {
      if (hasSeenAnalysisIntro()) {
        router.replace("/analysis");
        return (
          <StatusMessage tone="loading">Opening game analysis…</StatusMessage>
        );
      }

      return (
        <div className="settle mx-auto flex w-full max-w-2xl flex-col gap-5 py-6">
          <Card className="overflow-hidden p-6 sm:p-8 bg-card shadow-sheet">
            <div className="flex flex-col gap-4">
              <p className="eyebrow text-evergreen">Game Analysis</p>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold leading-tight text-ink">
                Review your real games with Stockfish.
              </h1>
              <p className="font-serif text-sm leading-relaxed text-graphite">
                Your chess account is connected. Open Analysis to sync your
                games, identify critical blunders, and turn them into personal
                spaced-repetition drills.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href="/analysis"
                  className={buttonVariants({ variant: "default" })}
                  onClick={() => {
                    markSeenAnalysisIntro();
                  }}
                >
                  Open Analysis →
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    markSeenAnalysisIntro();
                    if (isGuest) {
                      updateGuestProgramItemStatus(programItemId, "done");
                      recordGuestActivityEvent({
                        type: "drill_done",
                        programItemId,
                        payload: { reason: "game_analysis_completed" },
                      });
                    } else if (!completionRequestIdRef.current) {
                      completionRequestIdRef.current = crypto.randomUUID();
                      completeProgramItem({
                        requestId: completionRequestIdRef.current,
                        programItemId,
                      });
                    }
                    router.push("/today");
                  }}
                >
                  Mark block as done
                </Button>
                <Link
                  href="/today"
                  className={buttonVariants({ variant: "ghost" })}
                >
                  Back to Today
                </Link>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="settle mx-auto flex w-full max-w-2xl flex-col gap-5 py-6">
        <Card className="overflow-hidden border-dashed p-6 sm:p-8 bg-card shadow-sheet">
          <div className="flex flex-col gap-4">
            <p className="eyebrow text-evergreen">Account Connection Needed</p>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold leading-tight text-ink">
              Connect a chess account to analyze your games.
            </h1>
            <p className="font-serif text-sm leading-relaxed text-graphite">
              Mainline analyzes games directly from your linked Lichess or
              Chess.com account. Connect your account to discover your tactical
              blindspots and repair your mistakes.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/connections"
                className={buttonVariants({ variant: "default" })}
              >
                Connect chess account →
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isGuest) {
                    updateGuestProgramItemStatus(programItemId, "skipped");
                    recordGuestActivityEvent({
                      type: "skip",
                      programItemId,
                      payload: { reason: "requires_connected_account" },
                    });
                  } else {
                    emptyCloseRequestIdRef.current ??= crypto.randomUUID();
                    emptyCloseMutation.mutate({
                      requestId: emptyCloseRequestIdRef.current,
                      programItemId,
                      type: "skip",
                    });
                  }
                  router.push("/today");
                }}
              >
                Skip block
              </Button>
              <Link
                href="/today"
                className={buttonVariants({ variant: "ghost" })}
              >
                Back to Today
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (data.solvables.length === 0) {
    const closeEmptyBlock = () => {
      emptyCloseRequestIdRef.current ??= crypto.randomUUID();
      emptyCloseMutation.mutate({
        requestId: emptyCloseRequestIdRef.current,
        programItemId,
        type: "skip",
      });
    };
    return (
      <UnavailableTrainingBlock
        error={emptyCloseMutation.error}
        pending={emptyCloseMutation.isPending}
        onClose={closeEmptyBlock}
        onRetry={() => {
          if (emptyCloseMutation.variables) {
            emptyCloseMutation.mutate(emptyCloseMutation.variables);
          }
        }}
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
              : data.nextItem
                ? `You completed this training block. Ready to advance to Block ${data.nextItem.orderIndex + 1}.`
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
          <StatusMessage tone="loading">Saving final result…</StatusMessage>
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
            {solvables.length > 0 && (
              <p className="font-mono text-xs text-evergreen border-l-2 border-evergreen/40 pl-3">
                {solvables.length - retestQueue.length} of {solvables.length}{" "}
                positions correct on first attempt (
                {Math.round(
                  ((solvables.length - retestQueue.length) / solvables.length) *
                    100,
                )}
                % accuracy).
              </p>
            )}

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
                          Auto-advancing in {autoAdvanceSec}s…
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
              Desirable difficulty: spacing interval
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
              <div className="mt-2 flex items-center justify-end not-italic">
                <GradeMark
                  grade={data.redoFlow.rationale.grade}
                  tier={data.redoFlow.rationale.tier}
                />
              </div>
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
      ? "Phase 3: Retest mistakes"
      : isDrill
        ? "Blunder drill"
        : "In-app practice";

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
      <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow !text-[0.65rem] uppercase tracking-wider">
              {phaseLabel} · {data.item.label}
            </p>
            <GradeMark
              grade={data.item.evidenceGrade}
              tier={data.item.evidenceTier}
            />
          </div>
          <h1 className="text-ink font-serif text-2xl font-bold tracking-tight sm:text-3xl">
            {phase === "retest"
              ? "Retest this position"
              : isDrill
                ? "Find the missed move"
                : "Current puzzle"}
          </h1>
          <p className="text-graphite font-serif text-sm leading-relaxed max-w-2xl">
            {itemSummary(data.item)}
          </p>
        </div>
        <span className="text-graphite font-mono text-sm sm:text-right shrink-0">
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
                {isDrill ? "Find the move you missed" : "Practice status"}
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
                  {solveStatus === "wrong" && "Incorrect move"}
                  {solveStatus === "correct" && "Correct move"}
                  {solveStatus === "pending" &&
                    (isDrill ? "Find the missed move" : "Find the move")}
                </span>
                {solveStatus === "wrong" && (
                  <p className="text-destructive font-serif text-xs leading-relaxed">
                    That move was not optimal. The position will reset shortly
                    so you can retry.
                  </p>
                )}
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
                    Skip puzzle
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
