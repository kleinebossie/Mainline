"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";
import { InteractiveBoard } from "@/components/interactive-board";
import { EndgameDrillSession } from "@/app/train/[itemId]/endgame-drill";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import {
  puzzleToSolveState,
  drillToSolveState,
  type BoardOrientation,
} from "@/engine/interactive/puzzle";
import { systemClock } from "@/lib/clock";
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

  const { data, isLoading, error } = trpc.program.getTrainItem.useQuery({
    programItemId,
  });

  const logMutation = trpc.tracker.logOutcome.useMutation({
    onSuccess: () => {
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
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

  // Hint State (Phase 1)
  const [hintActive, setHintActive] = useState<boolean>(false);
  const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);

  // Delay Phase State (Phase 2). The wait length is a Seam-6 config value (L1) carried on
  // the item; default only if an older config omits it.
  const retestDelaySec = data?.redoFlow.retestDelaySec ?? 600;
  const [delayRemaining, setDelayRemaining] = useState<number>(retestDelaySec);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeSolvableId =
    phase === "retest"
      ? retestQueue[currentIdx]?.id
      : solvables[currentIdx]?.id;

  // Initialise solvables when loaded
  useEffect(() => {
    if (data?.solvables) {
      setSolvables(data.solvables);
      setCurrentIdx(0);
      setRetestQueue([]);
      setPhase(data.solvables.length > 0 ? "training" : "complete");
    }
  }, [data]);

  // Set up solve state when the active item (by phase + index) changes.
  useEffect(() => {
    const list = phase === "retest" ? retestQueue : solvables;
    const activeItem = list[currentIdx];
    if ((phase === "training" || phase === "retest") && activeItem) {
      initSolvable(activeItem);
    }
    // We explicitly omit solvables and retestQueue from the dependencies to prevent
    // updates (like appending a failed puzzle to the retestQueue during training)
    // from resetting the ongoing solve session. We only want to re-initialize
    // when the active puzzle's ID, index, or phase changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSolvableId, currentIdx, phase]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (delayTimerRef.current) clearInterval(delayTimerRef.current);
    };
  }, []);

  const initSolvable = (s: Solvable) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    const now = systemClock.now();
    // A puzzle has an opponent setup move (moves[0]); a blunder drill is the position the
    // player already faces, so its line starts with the player's move.
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
  };

  // Log one outcome, routing to the right event type by kind (puzzle_attempt vs drill_done).
  const logOutcome = (s: Solvable, correct: boolean, solveTimeMs: number) => {
    if (s.kind === "blunder_drill") {
      logMutation.mutate({
        programItemId,
        type: "drill_done",
        correct,
        solveTimeMs,
        practiceItemId: s.id,
      });
    } else {
      logMutation.mutate({
        programItemId,
        type: "puzzle_attempt",
        correct,
        solveTimeMs,
        puzzleId: s.id,
      });
    }
  };

  const handleMove = (move: { san: string }) => {
    if (!solveState) return;
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
        logOutcome(current, true, result.solveMs);
      }
    } else if (result.step === "wrong") {
      setSolveStatus("wrong");
      setBoardPosition(result.transientPosition ?? result.checkpointPosition);

      // First mistake triggers fail logging and registers the item for retest.
      if (phase === "training" && isFirstAttempt && firstTryPassed) {
        setFirstTryPassed(false);
        logOutcome(current, false, result.solveMs);
        setRetestQueue((prev) => [...prev, current]);

        // Activate the scaffolded hint (Phase 1): wash the start square of the right move.
        const nextCorrectMove = solveState.solutionLine[solveState.cursor];
        if (nextCorrectMove) {
          setHighlightedSquares([nextCorrectMove.substring(0, 2)]);
        }
        setHintActive(true);
      }

      const resetPosition = result.checkpointPosition;
      feedbackTimerRef.current = setTimeout(() => {
        setBoardPosition(resetPosition);
        setSolveStatus((prev) => (prev === "wrong" ? "pending" : prev));
      }, 1500);
    } else if (result.step === "continue" || result.step === "correct") {
      setSolveStatus("correct");
      setBoardPosition(result.state.position);
      setTimeout(() => {
        setSolveStatus((prev) => (prev === "correct" ? "pending" : prev));
      }, 1000);
    }
  };

  const handleNext = () => {
    const nextIdx = currentIdx + 1;
    const activeList = phase === "retest" ? retestQueue : solvables;

    if (nextIdx < activeList.length) {
      setCurrentIdx(nextIdx);
    } else {
      // Finished the current batch.
      if (phase === "training") {
        if (retestQueue.length > 0) {
          setPhase("delay");
          setDelayRemaining(retestDelaySec);
          startDelayTimer();
        } else {
          setPhase("complete");
        }
      } else if (phase === "retest") {
        setPhase("complete");
      }
    }
  };

  const startDelayTimer = () => {
    if (delayTimerRef.current) clearInterval(delayTimerRef.current);
    delayTimerRef.current = setInterval(() => {
      setDelayRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(delayTimerRef.current!);
          setPhase("retest");
          setCurrentIdx(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const skipDelay = () => {
    if (delayTimerRef.current) clearInterval(delayTimerRef.current);
    setPhase("retest");
    setCurrentIdx(0);
  };

  const handleSkip = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (phase === "training") {
      const current = solvables[currentIdx]!;
      logOutcome(current, false, 0);
      setRetestQueue((prev) => [...prev, current]);
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
      <Card gutter="D">
        <CardHeader>
          <CardTitle>Practice session unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-graphite text-sm leading-relaxed mb-4">
            We could not retrieve this practice item. Return to Today and try
            again.
          </p>
          <Link href="/today" className={buttonVariants()}>
            Back to Today
          </Link>
        </CardContent>
      </Card>
    );
  }

  // M13: an endgame drill is PLAYED OUT vs the engine, not matched to a fixed line — it has
  // its own session surface. Branch after the data load (all hooks above already ran, so hook
  // order is stable).
  if (data.item.activityType === "endgame_drill") {
    return <EndgameDrillSession programItemId={programItemId} data={data} />;
  }

  const activeList = phase === "retest" ? retestQueue : solvables;
  const current = activeList[currentIdx];
  const isDrill = current?.kind === "blunder_drill";

  // Render complete state
  if (phase === "complete") {
    return (
      <div className="flex flex-col gap-6 py-6 settle">
        <Card gutter="A">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-bold">
              Session complete
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-graphite font-serif text-sm leading-relaxed">
              Your outcomes have been recorded and any follow-up review work is
              scheduled in Today.
            </p>
            <Button
              onClick={() => router.push("/today")}
              className="self-start"
            >
              Back to Today
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render delay screen (Phase 2) — wait length + rationale come from config (Seam 6).
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
              <Link
                href="/today"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Return to Dashboard
              </Link>
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
          <div className="flex w-full max-w-[36rem] items-center justify-between px-1">
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
            disabled={solveStatus === "solved" || solveStatus === "wrong"}
            highlightedSquares={highlightedSquares}
            showEvalBar={data.affordances.showEvalBar}
            showLegalMoveDots={data.affordances.showLegalMoveDots}
            allowArrows={data.affordances.allowArrows}
            allowHover={data.affordances.allowHover}
            className="w-full max-w-[36rem]"
          />
          <div className="flex w-full max-w-[36rem] justify-start px-1">
            <span className="text-graphite font-mono text-xs">
              Elapsed: {(elapsedMs / 1000).toFixed(1)}s
            </span>
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
                    We highlighted the starting square of the correct piece.
                    {current.themes.length > 0 && (
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
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 border-t border-line/80 pt-4">
                {solveStatus === "solved" ? (
                  <Button onClick={handleNext} className="w-full">
                    {currentIdx + 1 < activeList.length ? "Next" : "Continue"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    disabled={logMutation.isPending}
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
