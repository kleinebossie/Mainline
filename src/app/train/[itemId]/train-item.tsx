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
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Volume2,
  VolumeX,
} from "lucide-react";

import { trpc } from "@/lib/trpc/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import { FocusShell } from "@/components/focus-shell";
import {
  InteractiveBoard,
  type BoardFeedback,
} from "@/components/interactive-board";
import { EndgameDrillSession } from "@/app/train/[itemId]/endgame-drill";
import { UnavailableTrainingBlock } from "@/app/train/[itemId]/unavailable-training-block";
import { WhyButton } from "@/components/ui/why-button";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import {
  puzzleToSolveState,
  drillToSolveState,
  type BoardOrientation,
} from "@/engine/interactive/puzzle";
import { systemClock } from "@/lib/clock";
import {
  allottedTrainingMs,
  trainingDeadlineMs,
  trainingTimeRemainingMs,
} from "@/lib/training-timer";
import {
  resultAdvanceBlocked,
  resultAdvanceLabel,
  resultPersistenceState,
} from "@/lib/result-persistence";
import { cn } from "@/lib/utils";
import { useSoundEnabled } from "@/lib/sound";
import {
  getGuestSession,
  updateGuestProgramItemStatus,
  recordGuestActivityEvent,
} from "@/lib/guest-session";
import { getGuestTrainItemData } from "@/lib/guest-solvables";

type TrainData =
  NonNullable<inferRouterOutputs<AppRouter>["program"]["getTrainItem"]>;
type Solvable = TrainData["solvables"][number];

interface TrainItemProps {
  programItemId: string;
}

export function TrainItem({ programItemId }: TrainItemProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [mounted, setMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useSoundEnabled();
  const [showTime, setShowTime] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("mainline_show_time");
      setShowTime(stored === "true");
    }
  }, []);

  const toggleShowTime = () => {
    const next = !showTime;
    setShowTime(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mainline_show_time", next ? "true" : "false");
    }
  };

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

  const guestTrainData = useMemo(() => {
    return guestItem ? getGuestTrainItemData(guestItem) : null;
  }, [guestItem]);

  const isGuest = Boolean(
    !serverLoading && (serverError != null || !serverData) && guestTrainData != null,
  );

  const data = serverData ?? (isGuest ? (guestTrainData as unknown as TrainData) : null);
  const isLoading = !mounted || (serverLoading && !guestTrainData);
  const error = isGuest ? null : serverError;

  const librarySummary = trpc.analysis.summary.useQuery(undefined, {
    retry: false,
  });
  const guestAnalysisContext = useMemo(() => {
    if (!mounted || typeof window === "undefined") return null;
    const session = getGuestSession();
    const connections = session.connections ?? [];
    let cachedGames = 0;
    try {
      const raw = localStorage.getItem("mainline_guest_games");
      cachedGames = raw ? (JSON.parse(raw) as unknown[]).length : 0;
    } catch {
      cachedGames = 0;
    }
    return {
      hasConnection:
        connections.length > 0 || Boolean(session.baseline?.username),
      hasGames: cachedGames > 0,
    };
  }, [mounted]);

  const hasAnyGames = isGuest
    ? Boolean(guestAnalysisContext?.hasGames)
    : (librarySummary.data?.total ?? 0) > 0;

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
  const [boardFeedback, setBoardFeedback] = useState<BoardFeedback | null>(null);

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

  // Hint State
  const [hintActive, setHintActive] = useState<boolean>(false);
  const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);

  // Delay Phase State
  const retestDelaySec = data?.redoFlow.retestDelaySec ?? 0;
  const [delayRemaining, setDelayRemaining] = useState<number>(retestDelaySec);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionDeadlineRef = useRef<number | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance State
  const [autoAdvanceSec, setAutoAdvanceSec] = useState<number | null>(null);
  const [autoAdvancePaused] = useState<boolean>(false);
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
    setBoardFeedback(null);
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

  // Auto-advance countdown on complete
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
    phase,
    resultBlocked,
    router,
  ]);

  async function retryOutcome() {
    if (completionMutation.error && completionMutation.variables) {
      try {
        await completionMutation.mutateAsync(completionMutation.variables);
      } catch {
        // Retain safe error message.
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
      // Retain safe error message.
    }
  }

  const handleMove = (move: { san: string; to?: string }) => {
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

    const destSquare = move.to ?? "";

    if (result.step === "solved") {
      setBoardPosition(result.state.position);
      setSolveStatus("solved");
      if (destSquare) {
        setBoardFeedback({ square: destSquare, kind: "correct" });
      }
      if (timerRef.current) clearInterval(timerRef.current);

      if (phase === "training" && firstTryPassed && isFirstAttempt) {
        void logOutcome(current, true, result.solveMs).catch(() => undefined);
      }
    } else if (result.step === "wrong") {
      setSolveStatus("wrong");
      if (destSquare) {
        setBoardFeedback({ square: destSquare, kind: "mistake" });
      }
      setBoardPosition(result.transientPosition ?? result.checkpointPosition);

      if (phase === "training" && isFirstAttempt && firstTryPassed) {
        setFirstTryPassed(false);
        void logOutcome(current, false, result.solveMs).catch(() => undefined);
        setRetestQueue((prev) => [...prev, current]);

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
        setBoardFeedback(null);
        setSolveStatus((prev) => (prev === "wrong" ? "pending" : prev));
      }, 1500);
    } else if (result.step === "continue" || result.step === "correct") {
      setSolveStatus("correct");
      if (destSquare) {
        setBoardFeedback({ square: destSquare, kind: "correct" });
      }
      setBoardPosition(result.state.position);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setBoardFeedback(null);
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
      <FocusShell title="Loading" exitHref="/today">
        <div className="flex flex-1 items-center justify-center py-16">
          <StatusMessage tone="loading">Loading training block…</StatusMessage>
        </div>
      </FocusShell>
    );
  }

  if (error || !data) {
    return (
      <FocusShell title="Unavailable" exitHref="/today">
        <div className="flex flex-1 items-center justify-center py-12">
          <ErrorNotice
            error={error}
            heading="Practice session unavailable"
            message="Mainline could not load this training block. Try it again, or return to Today."
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
        </div>
      </FocusShell>
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
    const handleManualLog = () => {
      if (isGuest) {
        updateGuestProgramItemStatus(programItemId, "done");
        recordGuestActivityEvent({
          type: "drill_done",
          programItemId,
          payload: { reason: "manual_game_analysis_completed" },
        });
        router.push("/today");
        return;
      }

      completionRequestIdRef.current ??= crypto.randomUUID();
      completeProgramItem({
        requestId: completionRequestIdRef.current,
        programItemId,
      });
      router.push("/today");
    };

    return (
      <FocusShell title={data.item.label} exitHref="/today">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6">
          <div className="rounded-lg border border-line bg-paper-raised p-6 flex flex-col gap-4 shadow-sm">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-evergreen">
              Game analysis
            </span>
            <h1 className="font-serif text-2xl font-bold text-ink">
              {hasAnyGames
                ? "Reviewed a game on your own? Log it."
                : "Nothing to analyse yet"}
            </h1>
            <p className="font-sans text-sm text-graphite leading-relaxed">
              {hasAnyGames
                ? "If you analyzed your game outside this guided session, log it here to complete this analysis block."
                : "Mainline reviews games imported from your connected platform or PGN files."}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="button"
                disabled={completionMutation.isPending}
                onClick={handleManualLog}
              >
                {completionMutation.isPending ? "Saving…" : "Mark block as done"}
              </Button>
              <Link
                href="/today"
                className={buttonVariants({ variant: "ghost" })}
              >
                Back to Today
              </Link>
            </div>
          </div>
        </div>
      </FocusShell>
    );
  }

  if (data.solvables.length === 0) {
    const closeEmptyBlock = () => {
      if (isGuest) {
        updateGuestProgramItemStatus(programItemId, "skipped");
        router.push("/today");
        return;
      }
      emptyCloseRequestIdRef.current ??= crypto.randomUUID();
      emptyCloseMutation.mutate({
        requestId: emptyCloseRequestIdRef.current,
        programItemId,
        type: "skip",
      });
    };
    return (
      <FocusShell title={data.item.label} exitHref="/today">
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
      </FocusShell>
    );
  }

  if (data.item.activityType === "endgame_drill") {
    return <EndgameDrillSession programItemId={programItemId} data={data} />;
  }

  const activeList = phase === "retest" ? retestQueue : solvables;
  const current = activeList[currentIdx];
  const isDrill = current?.kind === "blunder_drill";

  // In-between screen / auto-advance screen when block completes (Decision 11 & Section 6.1)
  if (phase === "complete") {
    const completionHeading =
      finishReason === "time_up"
        ? "Scheduled time is up"
        : data.nextItem
          ? "Block complete"
          : "Session complete";

    const accuracyPercent =
      solvables.length > 0
        ? Math.round(
            ((solvables.length - retestQueue.length) / solvables.length) * 100,
          )
        : 100;

    return (
      <FocusShell
        title={data.item.label}
        exitHref="/today"
        mainClassName="flex items-center justify-center"
      >
        <div className="w-full max-w-lg rounded-lg border border-line bg-paper-raised p-6 sm:p-8 shadow-sm flex flex-col gap-5 animate-in fade-in duration-200">
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

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-evergreen/10 px-3 py-1 font-sans text-xs font-semibold text-evergreen">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {data.nextItem ? "Block complete" : "Session complete"}
            </span>
          </div>

          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">
              {completionHeading}
            </h2>
            <p className="mt-1 font-sans text-sm text-graphite">
              {solvables.length > 0 ? (
                <>
                  {solvables.length - retestQueue.length} of {solvables.length}{" "}
                  positions correct on first attempt ({accuracyPercent}% accuracy).
                </>
              ) : (
                "Completed training block."
              )}
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

  // Spacing interval delay phase
  if (phase === "delay") {
    const mins = Math.floor(delayRemaining / 60);
    const secs = Math.floor(delayRemaining % 60);
    const formattedTime = `${mins}:${secs.toString().padStart(2, "0")}`;

    return (
      <FocusShell title={data.item.label} exitHref="/today">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-6 text-center">
          <div className="rounded-lg border border-line bg-paper-raised p-6 sm:p-8 flex flex-col gap-5 shadow-sm">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-graphite">
              Spacing interval
            </span>
            <h2 className="font-serif text-2xl font-bold text-ink">
              Desirable difficulty: wait before retest
            </h2>
            <div className="rounded-md border border-line bg-paper p-6 my-1">
              <p className="font-sans text-xs text-graphite mb-1">
                Retest countdown
              </p>
              <p className="font-mono text-5xl font-bold text-ink tracking-tight tabular-nums">
                {formattedTime}
              </p>
            </div>

            <p className="font-sans text-xs text-graphite italic leading-relaxed text-left border-l-2 border-line pl-3">
              {data.redoFlow.rationale.value}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3 border-t border-line">
              <Button variant="outline" size="sm" onClick={skipDelay}>
                Retest now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => finishSession("manual")}
              >
                Finish session
              </Button>
            </div>
          </div>
        </div>
      </FocusShell>
    );
  }

  if (!current || !solveState || !boardPosition) {
    return (
      <FocusShell title={data.item.label} exitHref="/today">
        <div className="flex flex-1 items-center justify-center py-16">
          <StatusMessage tone="loading">
            Preparing next practice position…
          </StatusMessage>
        </div>
      </FocusShell>
    );
  }

  const promptTitle =
    orientation === "white"
      ? "White to move. Find the best move."
      : "Black to move. Find the best move.";

  const progressText = `${currentIdx + 1} of ${activeList.length}`;

  const headerProgressSlot = (
    <div className="flex items-center gap-2">
      <div
        className="hidden xs:flex items-center gap-1"
        aria-hidden="true"
      >
        {activeList.slice(0, 10).map((_, idx) => (
          <span
            key={idx}
            className={cn(
              "h-1.5 rounded-full transition-all",
              idx < currentIdx
                ? "w-3 bg-evergreen"
                : idx === currentIdx
                  ? "w-4 bg-ink"
                  : "w-3 bg-line",
            )}
          />
        ))}
      </div>
      <span className="font-sans text-xs font-semibold text-graphite tabular-nums">
        {progressText}
      </span>
      {showTime && (
        <span
          className="font-mono text-xs text-graphite bg-paper-raised border border-line px-1.5 py-0.5 rounded-xs tabular-nums"
          title="Elapsed puzzle time"
        >
          {(elapsedMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );

  const headerControlsSlot = (
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

      <button
        type="button"
        onClick={toggleShowTime}
        aria-label={showTime ? "Hide timer" : "Show timer"}
        title={showTime ? "Hide timer" : "Show timer"}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          showTime
            ? "text-ink bg-ink/[0.06]"
            : "text-graphite hover:text-ink hover:bg-ink/[0.04]",
        )}
      >
        <Clock className="h-4 w-4" aria-hidden="true" />
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
      progressSlot={headerProgressSlot}
      controlsSlot={headerControlsSlot}
      exitHref="/today"
      mainClassName="flex flex-col justify-center py-2"
    >
      {logMutation.error && (
        <div className="w-full max-w-wide mx-auto mb-2">
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
        </div>
      )}

      <div className="w-full max-w-wide mx-auto flex flex-col items-center justify-center md:flex-row md:items-center md:justify-center md:gap-10">
        {/* Board column */}
        <div
          data-testid="focus-board-column"
          className="w-full max-w-[min(100%,350px)] md:max-w-[min(540px,calc(100vh-140px))] aspect-square shrink-0 flex items-center justify-center"
        >
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
            feedback={boardFeedback}
            showEvalBar={data.affordances.showEvalBar}
            showLegalMoveDots={data.affordances.showLegalMoveDots}
            allowArrows={data.affordances.allowArrows}
            allowHover={data.affordances.allowHover}
            className="w-full h-full"
          />
        </div>

        {/* Info & action panel column */}
        <div
          data-testid="focus-panel-column"
          className="w-full max-w-[350px] md:w-[360px] flex flex-col gap-3 md:gap-4 mt-2 md:mt-0 justify-center"
        >
          {/* Plain-word prompt */}
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-xs font-medium text-graphite uppercase tracking-wide">
              {phase === "retest"
                ? "Retest position"
                : isDrill
                  ? "Blunder drill"
                  : data.item.label}
            </span>
            <h1 className="font-serif text-base sm:text-lg font-semibold text-ink leading-snug">
              {promptTitle}
            </h1>
          </div>

          {/* Move feedback banner */}
          {solveStatus === "solved" && (
            <div className="flex items-center gap-2.5 rounded-md border border-evergreen/30 bg-evergreen/10 px-3 py-2 text-sm text-evergreen-bright animate-in fade-in duration-120">
              <Check className="h-4 w-4 shrink-0 text-evergreen" aria-hidden="true" />
              <span className="font-medium">Solved</span>
              <span className="text-xs text-evergreen-bright/90">· Best move found</span>
            </div>
          )}

          {solveStatus === "correct" && (
            <div className="flex items-center gap-2.5 rounded-md border border-evergreen/30 bg-evergreen/10 px-3 py-2 text-sm text-evergreen-bright animate-in fade-in duration-120">
              <Check className="h-4 w-4 shrink-0 text-evergreen" aria-hidden="true" />
              <span className="font-medium">Correct move. Keep going.</span>
            </div>
          )}

          {solveStatus === "wrong" && (
            <div className="flex items-center gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in duration-120">
              <AlertCircle
                className="h-4 w-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <span className="font-medium text-xs leading-normal">
                {hintActive
                  ? data?.redoFlow.hint.copy
                  : "Incorrect move. The position will reset shortly."}
              </span>
            </div>
          )}

          {/* Hint details when active */}
          {hintActive && solveStatus !== "wrong" && (
            <div className="flex flex-col gap-1 rounded-md border border-amber/30 bg-amber/10 p-2.5 text-xs text-ink">
              <span className="font-medium text-amber">Hint</span>
              <p className="text-graphite">{data?.redoFlow.hint.copy}</p>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2.5 pt-0.5">
            {solveStatus === "solved" ? (
              <Button
                onClick={() => handleNext()}
                className="flex-1 min-h-[44px]"
                disabled={resultBlocked}
              >
                {resultAdvanceLabel(
                  persistenceState,
                  currentIdx + 1 < activeList.length ? "Next" : "Continue",
                )}
                <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden="true" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => void handleSkip()}
                  disabled={resultBlocked}
                  className="min-h-[44px] flex-1"
                >
                  Skip puzzle
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => finishSession("manual")}
                  disabled={resultBlocked}
                  className="text-graphite hover:text-ink min-h-[44px]"
                >
                  Finish
                </Button>
              </>
            )}
          </div>

          {/* Keyboard input for accessibility */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const input = form.elements.namedItem(
                "keyboardMove",
              ) as HTMLInputElement | null;
              if (input && input.value.trim()) {
                handleMove({ san: input.value.trim() });
                input.value = "";
              }
            }}
            className="flex items-center gap-2 pt-1 border-t border-line/60"
          >
            <label htmlFor="keyboard-move-input" className="sr-only">
              Enter move in standard notation
            </label>
            <input
              id="keyboard-move-input"
              name="keyboardMove"
              type="text"
              placeholder="Algebraic move (e.g. Nf3)"
              className="h-8 flex-1 rounded-xs border border-line bg-paper px-2 font-mono text-xs text-ink placeholder:text-graphite/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={
                resultBlocked ||
                solveStatus === "solved" ||
                solveStatus === "wrong"
              }
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="h-8 text-xs shrink-0"
              disabled={
                resultBlocked ||
                solveStatus === "solved" ||
                solveStatus === "wrong"
              }
            >
              Play
            </Button>
          </form>
        </div>
      </div>
    </FocusShell>
  );
}
