"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InteractiveBoard } from "@/components/interactive-board";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import {
  puzzleToSolveState,
  type BoardOrientation,
} from "@/engine/interactive/puzzle";
import { systemClock } from "@/lib/clock";
import { cn } from "@/lib/utils";
import type { LichessPuzzle } from "@prisma/client";
import { humanizeTheme } from "@/integrations/puzzles/themes";

interface TrainItemProps {
  programItemId: string;
}

export function TrainItem({ programItemId }: TrainItemProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  // 1. Fetch item and puzzles
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
  const [puzzles, setPuzzles] = useState<LichessPuzzle[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [solveState, setSolveState] = useState<SolveState | null>(null);
  const [orientation, setOrientation] = useState<BoardOrientation>("white");
  const [solveStatus, setSolveStatus] = useState<
    "pending" | "correct" | "wrong" | "solved"
  >("pending");
  
  // Timer for elapsed solve time
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Redo Flow States
  const [firstTryPassed, setFirstTryPassed] = useState<boolean>(true);
  const [retestQueue, setRetestQueue] = useState<LichessPuzzle[]>([]);
  const [phase, setPhase] = useState<"training" | "delay" | "retest" | "complete">("training");
  
  // Hint State (Phase 1)
  const [hintActive, setHintActive] = useState<boolean>(false);
  const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);

  // Delay Phase State (Phase 2)
  const [delayRemaining, setDelayRemaining] = useState<number>(600); // 10 minutes in seconds
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize puzzles when loaded
  useEffect(() => {
    if (data?.puzzles) {
      setPuzzles(data.puzzles);
      setCurrentIdx(0);
      setRetestQueue([]);
      setPhase(data.puzzles.length > 0 ? "training" : "complete");
    }
  }, [data]);

  // Set up puzzle solve state when active puzzle index changes
  useEffect(() => {
    if (puzzles.length > 0 && currentIdx < puzzles.length && phase === "training") {
      initPuzzle(puzzles[currentIdx]!);
    } else if (puzzles.length > 0 && currentIdx < puzzles.length && phase === "retest") {
      initPuzzle(puzzles[currentIdx]!);
    }
  }, [puzzles, currentIdx, phase]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (delayTimerRef.current) clearInterval(delayTimerRef.current);
    };
  }, []);

  const initPuzzle = (puzzle: LichessPuzzle) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const now = systemClock.now();
    // Apply the opponent's setup move so the board faces the real puzzle and the solution
    // line starts with the player's move (fixes the off-by-one + wrong orientation).
    const { solveState: setup, orientation: playerSide } = puzzleToSolveState(
      puzzle.fen,
      puzzle.moves,
      now,
    );

    setSolveState(setup);
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

  const handleMove = (move: { san: string }) => {
    if (!solveState) return;

    const currentPuzzle = puzzles[currentIdx]!;
    const isFirstAttempt = solveState.attempts === 0;

    const result = stepSolve(solveState, {
      san: move.san,
      atMs: systemClock.now(),
    });
    setSolveState(result.state);

    if (result.step === "solved") {
      setSolveStatus("solved");
      if (timerRef.current) clearInterval(timerRef.current);

      // If it's training mode and they solved it on the first attempt, log success!
      if (phase === "training" && firstTryPassed && isFirstAttempt) {
        logMutation.mutate({
          programItemId,
          type: "puzzle_attempt",
          correct: true,
          solveTimeMs: result.solveMs,
          puzzleId: currentPuzzle.puzzleId,
        });
      }
    } else if (result.step === "wrong") {
      setSolveStatus("wrong");

      // First mistake triggers fail logging and registers the puzzle for retest
      if (phase === "training" && isFirstAttempt && firstTryPassed) {
        setFirstTryPassed(false);
        // Log fail immediately
        logMutation.mutate({
          programItemId,
          type: "puzzle_attempt",
          correct: false,
          solveTimeMs: result.solveMs,
          puzzleId: currentPuzzle.puzzleId,
        });
        
        // Add to retest queue
        setRetestQueue((prev) => [...prev, currentPuzzle]);

        // Activate hint (Phase 1)
        const nextCorrectMove = solveState.solutionLine[solveState.cursor];
        if (nextCorrectMove) {
          const startSquare = nextCorrectMove.substring(0, 2);
          setHighlightedSquares([startSquare]);
        }
        setHintActive(true);
      }

      setTimeout(() => {
        setSolveStatus((prev) => (prev === "wrong" ? "pending" : prev));
      }, 1500);
    } else if (result.step === "continue" || result.step === "correct") {
      setSolveStatus("correct");
      setTimeout(() => {
        setSolveStatus((prev) => (prev === "correct" ? "pending" : prev));
      }, 1000);
    }
  };

  const handleNext = () => {
    const nextIdx = currentIdx + 1;
    const activePuzzlesList = phase === "retest" ? retestQueue : puzzles;

    if (nextIdx < activePuzzlesList.length) {
      setCurrentIdx(nextIdx);
    } else {
      // Finished the current batch of puzzles
      if (phase === "training") {
        if (retestQueue.length > 0) {
          // Transition to Phase 2: 10-minute delay
          setPhase("delay");
          setDelayRemaining(600); // 10 minutes
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
          // Start Phase 3: Retest
          setPhase("retest");
          setCurrentIdx(0);
          return 0;
        }
        return prev - 1;
      });
    }, 100); // Fast interval for responsive rendering
  };

  const skipDelay = () => {
    if (delayTimerRef.current) clearInterval(delayTimerRef.current);
    setPhase("retest");
    setCurrentIdx(0);
  };

  const handleSkip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Log skip if in training
    if (phase === "training") {
      const currentPuzzle = puzzles[currentIdx]!;
      logMutation.mutate({
        programItemId,
        type: "puzzle_attempt",
        correct: false,
        solveTimeMs: 0,
        puzzleId: currentPuzzle.puzzleId,
      });
      setRetestQueue((prev) => [...prev, currentPuzzle]);
    }
    
    handleNext();
  };

  if (isLoading) {
    return <p className="text-graphite font-mono text-sm">Loading puzzles…</p>;
  }

  if (error || !data) {
    return (
      <Card gutter="D">
        <CardHeader>
          <CardTitle>Error Loading Practise Session</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-graphite text-sm leading-relaxed mb-4">
            Could not retrieve details for this practice item.
          </p>
          <Link href="/today" className={buttonVariants()}>
            Back to Today
          </Link>
        </CardContent>
      </Card>
    );
  }

  const activeList = phase === "retest" ? retestQueue : puzzles;
  const currentPuzzle = activeList[currentIdx];

  // Render complete state
  if (phase === "complete") {
    return (
      <div className="flex flex-col gap-6 py-6 settle">
        <Card gutter="A">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-bold">
              Training Session Completed!
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-graphite font-serif text-sm leading-relaxed">
              Awesome job! Your practice session has been completed, and outcomes have been registered with the spaced repetition scheduler.
            </p>
            <Button
              onClick={() => {
                router.push("/today");
              }}
              className="self-start"
            >
              Back to Today
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render delay screen (Phase 2)
  if (phase === "delay") {
    const mins = Math.floor(delayRemaining / 60);
    const secs = Math.floor(delayRemaining % 60);
    const formattedTime = `${mins}:${secs.toString().padStart(2, "0")}`;

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
              &ldquo;Massed retests (reviewing a mistake immediately) only verify your short-term working memory. To move patterns into your long-term memory, we wait 10 minutes before retesting your mistakes without hints.&rdquo;
              <cite className="block text-right text-xs mt-1 font-mono not-italic opacity-80">— Spaced Repetition Theory</cite>
            </blockquote>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-line">
              <Button
                variant="outline"
                size="sm"
                onClick={skipDelay}
              >
                Skip Delay (Developer Demo)
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

  if (!currentPuzzle || !solveState) return null;

  return (
    <div className="flex flex-col gap-6 py-6 settle">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-col gap-1">
          <p className="eyebrow !text-[0.65rem] uppercase tracking-wider">
            {phase === "retest" ? "Phase 3: Retesting Mistakes" : "In-App Practice"} · {data.item.label}
          </p>
          <h1 className="text-ink font-serif text-3xl font-bold tracking-tight">
            Puzzle {currentIdx + 1} of {activeList.length}
          </h1>
        </div>
        <span className="text-graphite font-mono text-sm">
          Rating target: {currentPuzzle.rating}
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
            fen={solveState.position}
            onMove={handleMove}
            orientation={orientation}
            disabled={solveStatus === "solved"}
            highlightedSquares={highlightedSquares}
            showEvalBar={data.affordances.showEvalBar}
            showLegalMoveDots={data.affordances.showLegalMoveDots}
            allowArrows={data.affordances.allowArrows}
            allowHover={data.affordances.allowHover}
            className="w-full max-w-[36rem]"
          />
          <div className="flex justify-between w-full max-w-[36rem] px-1">
            <span className="text-graphite font-mono text-xs">
              Elapsed: {(elapsedMs / 1000).toFixed(1)}s
            </span>
            <span className="text-graphite font-mono text-xs">
              Attempts: {solveState.attempts}
            </span>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg">
                Practice Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-md border border-line bg-paper/50 p-4">
                <span className="text-ink font-mono text-xs font-semibold uppercase tracking-wider">
                  Solve State:
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
                  {solveStatus === "solved" && "✓ Solved!"}
                  {solveStatus === "wrong" && "✗ Wrong Move!"}
                  {solveStatus === "correct" && "✓ Correct Move!"}
                  {solveStatus === "pending" && "Solve the puzzle..."}
                </span>
              </div>

              {/* Scaffolded Hint Display (Phase 1) */}
              {hintActive && (
                <div className="flex flex-col gap-2 rounded-md border border-evergreen/20 bg-evergreen/5 p-4 transition-all settle">
                  <span className="text-evergreen font-mono text-xs font-semibold uppercase tracking-wider">
                    Scaffolded Hint:
                  </span>
                  <p className="text-sm font-serif text-ink leading-relaxed">
                    We highlighted the starting square of the correct piece. Look for:{" "}
                    <span className="font-medium text-evergreen">
                      {currentPuzzle.themes.map(humanizeTheme).slice(0, 3).join(", ")}
                    </span>
                    .
                  </p>
                </div>
              )}

              {/* Why the board hides crutches (Seam 8 anti_arrow_hover rationale) */}
              {data.restrictionRationale && (
                <div className="flex flex-col gap-1.5 rounded-md border border-line bg-paper/40 p-4">
                  <span className="text-graphite font-mono text-[0.65rem] font-semibold uppercase tracking-wider">
                    Why no arrows or eval bar?
                  </span>
                  <p className="text-sm font-serif text-ink leading-relaxed">
                    {data.restrictionRationale.value}
                  </p>
                  <span className="text-graphite font-mono text-[0.6rem] uppercase tracking-wider">
                    Evidence {data.restrictionRationale.grade} · tier{" "}
                    {data.restrictionRationale.tier}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 border-t border-line/80 pt-4">
                {solveStatus === "solved" ? (
                  <Button onClick={handleNext} className="w-full">
                    {currentIdx + 1 < activeList.length ? "Next Puzzle" : "Continue"}
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
