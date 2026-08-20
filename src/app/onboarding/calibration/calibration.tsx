"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  BOARD_SIZE_CLASS,
  InteractiveBoard,
} from "@/components/interactive-board";

import { stepSolve, type SolveState } from "@/engine/interactive/session";
import {
  puzzleToSolveState,
  type BoardOrientation,
} from "@/engine/interactive/puzzle";
import {
  getGuestSession,
  saveGuestBaseline,
  saveGuestCalibrationResponses,
  clearGuestCalibration,
  type GuestCalibrationResponse,
  type GuestConnection,
} from "@/lib/guest-session";
import { systemClock } from "@/lib/clock";
import { cn } from "@/lib/utils";

// Adaptive calibration UI. Difficulty for each item is produced by the methodology
// (config-driven ladder); we present it as a strength target and record only the
// behavioural outcome (solved / missed). The active methodology controls the tracks
// and ladder length; an in-progress historic assessment keeps its original release.

export function Calibration() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [guestResponses, setGuestResponses] = useState<
    GuestCalibrationResponse[]
  >(() => {
    if (typeof window !== "undefined") {
      return getGuestSession().calibrationResponses ?? [];
    }
    return [];
  });
  const [guestConnections, setGuestConnections] = useState<GuestConnection[]>(
    () => {
      if (typeof window !== "undefined") {
        return getGuestSession().connections ?? [];
      }
      return [];
    },
  );
  const [primaryFormat, setPrimaryFormat] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return (
        getGuestSession().constraints?.formatPrefs?.formats?.[0] ?? null
      );
    }
    return null;
  });

  useEffect(() => {
    const session = getGuestSession();
    setGuestResponses(session.calibrationResponses ?? []);
    setGuestConnections(session.connections ?? []);
    setPrimaryFormat(session.constraints?.formatPrefs?.formats?.[0] ?? null);
  }, []);

  const state = trpc.assessment.state.useQuery(
    {
      guestResponses,
      guestConnections,
      primaryFormat,
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: (data) => {
      void utils.assessment.state.invalidate();
      if (
        data &&
        "guestResponses" in data &&
        Array.isArray(data.guestResponses)
      ) {
        setGuestResponses(data.guestResponses);
        saveGuestCalibrationResponses(data.guestResponses);
        if (data.completed && data.estimate) {
          saveGuestBaseline({
            tacticalRatingEstimate: data.estimate.tacticalRatingEstimate,
            uncertainty: data.estimate.uncertainty,
            topBlindspot: data.tracks[0]?.theme || "Tactics",
            calibratedAt: new Date().toISOString(),
          });
          router.push("/onboarding/reveal");
          return;
        }
      }
      if (data.completed) {
        router.push("/onboarding/reveal");
      }
    },
    onError: () => setSolveStatus("pending"),
  });
  const reset = trpc.assessment.reset.useMutation({
    onSuccess: () => {
      setGuestResponses([]);
      clearGuestCalibration();
      void utils.assessment.state.invalidate();
    },
  });

  const [solveState, setSolveState] = useState<SolveState | null>(null);
  const [orientation, setOrientation] = useState<BoardOrientation>("white");
  const [solveStatus, setSolveStatus] = useState<
    "pending" | "correct" | "wrong" | "solved"
  >("pending");

  const activePuzzle = state.data?.activePuzzle;
  const activeTrack = state.data?.activeTrack;
  const affordances = state.data?.affordances;
  const pending = submit.isPending || reset.isPending;
  const isAdvancing = pending || state.isFetching;

  useEffect(() => {
    if (activePuzzle) {
      // Apply the opponent's setup move so the solver faces the real position from the
      // correct side (fixes the off-by-one + flipped orientation).
      const { solveState: setup, orientation: playerSide } = puzzleToSolveState(
        activePuzzle.fen,
        activePuzzle.moves,
        systemClock.now(),
      );
      setSolveState(setup);
      setOrientation(playerSide);
      setSolveStatus("pending");
    } else {
      setSolveState(null);
      setSolveStatus("pending");
    }
  }, [activePuzzle]);

  const handleMove = (move: { san: string }) => {
    if (!solveState || !activePuzzle || !activeTrack || pending) return;

    const result = stepSolve(solveState, {
      san: move.san,
      atMs: systemClock.now(),
    });
    setSolveState(result.state);

    if (result.step === "solved") {
      setSolveStatus("solved");
      submit.mutate({
        ratingShown: activeTrack.next.ratingTarget,
        correct: true,
        puzzleId: activePuzzle.puzzleId,
        guestResponses,
        guestConnections,
        primaryFormat,
      });
    } else if (result.step === "wrong") {
      setSolveStatus("wrong");
      submit.mutate({
        ratingShown: activeTrack.next.ratingTarget,
        correct: false,
        puzzleId: activePuzzle.puzzleId,
        guestResponses,
        guestConnections,
        primaryFormat,
      });
    } else if (result.step === "correct" || result.step === "continue") {
      setSolveStatus("correct");
      setTimeout(() => {
        setSolveStatus((prev) => (prev === "correct" ? "pending" : prev));
      }, 1000);
    }
  };

  const handleSkip = () => {
    if (!activePuzzle || !activeTrack || pending) return;
    submit.mutate({
      ratingShown: activeTrack.next.ratingTarget,
      correct: false,
      puzzleId: activePuzzle.puzzleId,
      guestResponses,
      guestConnections,
      primaryFormat,
    });
  };

  if (state.isLoading && !state.data) {
    return <StatusMessage tone="loading">Loading calibration…</StatusMessage>;
  }

  if (state.error && !state.data) {
    return (
      <ErrorNotice
        error={state.error}
        heading="Calibration unavailable"
        message="Mainline could not load your calibration. Try this step again."
        onRetry={() => void state.refetch()}
        retrying={state.isFetching}
        retryLabel="Reload calibration"
      />
    );
  }

  if (!state.data) {
    return null;
  }

  if (state.data.locked) {
    return (
      <Card className="settle border-line bg-card shadow-sheet p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <div>
            <p className="eyebrow text-evergreen">
              Tactical Calibration · Locked
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold mt-1">
              Connect a chess account to unlock calibration
            </h2>
            <p className="text-graphite text-sm sm:text-base font-serif leading-relaxed mt-2 max-w-xl">
              Mainline seeds your calibration puzzles from your actual rating on
              Lichess or Chess.com. Link at least one chess account to begin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/connections"
              className={buttonVariants({ size: "default" })}
            >
              Connect chess account →
            </Link>
            <Link
              href="/today"
              className={buttonVariants({
                variant: "outline",
                size: "default",
              })}
            >
              Skip to Today&apos;s training →
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  const { completed, maxItems, activeTrackIndex } = state.data;

  // --- Completed: directly route to reveal or provide retake ------------------

  if (completed || !activeTrack) {
    return (
      <Card className="settle border-line bg-card shadow-sheet p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <div>
            <p className="eyebrow text-evergreen">Calibration complete</p>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold mt-1">
              Your calibration is already finished
            </h2>
            <p className="text-graphite text-sm sm:text-base font-serif leading-relaxed mt-2 max-w-xl">
              You can review your full baseline on the reveal page, or retake the
              3-puzzle calibration.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/onboarding/reveal"
              className={buttonVariants({ size: "default" })}
            >
              Continue to reveal →
            </Link>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => reset.mutate()}
            >
              Retake calibration
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // --- In progress: the active track's next item -----------------------------
  const recordFallback = (correct: boolean) =>
    submit.mutate({
      ratingShown: activeTrack.next.ratingTarget,
      correct,
      guestResponses,
      guestConnections,
      primaryFormat,
    });


  return (
    <Card className="settle">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow !text-[0.65rem]">Tactical Calibration</p>
          <p className="text-graphite font-mono text-[0.65rem] uppercase tracking-wider">
            3 puzzles
          </p>
        </div>
        <CardTitle className="font-serif text-2xl sm:text-3xl font-semibold mt-1">
          Puzzle {activeTrack.next.itemNumber} of {maxItems}
        </CardTitle>
        <p className="text-graphite text-sm leading-relaxed mt-1">
          Solve 3 quick tactical puzzles to build your starting baseline.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {(submit.error || reset.error) && (
          <ErrorNotice
            error={submit.error ?? reset.error}
            heading={
              submit.error ? "Answer not recorded" : "Calibration not restarted"
            }
            message={
              submit.error
                ? "This puzzle is still open. Submit the same answer again."
                : "Your current calibration is unchanged. Try starting over again."
            }
          />
        )}
        {/* Puzzle step progress dots */}
        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: maxItems }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < activeTrack.next.itemNumber - 1
                  ? "bg-evergreen"
                  : i === activeTrack.next.itemNumber - 1
                    ? "bg-evergreen/50"
                    : "bg-line",
              )}
            />
          ))}
        </div>

        {activePuzzle && solveState ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] items-start mt-2">
            {/* Chessboard View */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={`${BOARD_SIZE_CLASS} flex items-center justify-between px-1`}
              >
                <span className="eyebrow !text-[0.6rem]">
                  {orientation === "white" ? "White" : "Black"} to move
                </span>
                {isAdvancing ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-evergreen animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading next puzzle…
                  </span>
                ) : (
                  <span className="text-graphite font-mono text-xs">
                    You play {orientation}
                  </span>
                )}
              </div>
              <InteractiveBoard
                fen={solveState.position}
                onMove={handleMove}
                orientation={orientation}
                disabled={
                  pending || isAdvancing || solveStatus === "solved" || solveStatus === "wrong"
                }
                showEvalBar={affordances?.showEvalBar ?? false}
                showLegalMoveDots={affordances?.showLegalMoveDots ?? false}
                allowArrows={affordances?.allowArrows ?? true}
                allowHover={affordances?.allowHover ?? true}
                className={BOARD_SIZE_CLASS}
              />
              <div className={`${BOARD_SIZE_CLASS} flex justify-between px-1`}>
                <span className="text-graphite font-mono text-xs">
                  Attempts: {solveState.attempts}
                </span>
                <span className="text-graphite font-mono text-xs">
                  Target Rating: {activeTrack.next.ratingTarget}
                </span>
              </div>
            </div>

        {/* Info Sidebar */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-md border border-line bg-paper/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-ink font-mono text-xs font-semibold uppercase tracking-wider">
                    Solve status:
                  </span>
                  {isAdvancing && (
                    <span className="inline-flex items-center gap-1 font-mono text-[0.65rem] text-evergreen animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading next…
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "font-serif text-lg font-semibold flex flex-col gap-1",
                    solveStatus === "solved" && "text-evergreen-bright",
                    solveStatus === "wrong" && "text-destructive",
                    solveStatus === "correct" && "text-evergreen",
                    solveStatus === "pending" && "text-graphite",
                  )}
                >
                  <div>
                    {solveStatus === "solved" && "✓ Solved"}
                    {solveStatus === "wrong" && "✗ Incorrect"}
                    {solveStatus === "correct" && "✓ Correct move"}
                    {solveStatus === "pending" && (isAdvancing ? "Loading next puzzle…" : "Solve the puzzle…")}
                  </div>
                  {isAdvancing && (
                    <p className="text-xs font-mono font-normal text-graphite flex items-center gap-1.5 pt-0.5">
                      <Loader2 className="h-3 w-3 animate-spin text-evergreen shrink-0" />
                      Next puzzle loading…
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-line/80 pt-4">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={pending || isAdvancing}
                  className="inline-flex items-center justify-center gap-2"
                >
                  {isAdvancing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-evergreen" />
                      <span>Loading next puzzle…</span>
                    </>
                  ) : (
                    "Skip puzzle"
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-paper/60 rounded-md border p-5 text-center">
              <p className="eyebrow !text-[0.65rem] mb-1">
                Puzzle strength target
              </p>
              <p className="text-4xl font-mono font-bold tracking-tight text-ink tabular-nums">
                {activeTrack.next.ratingTarget}
              </p>
              <p className="text-xs text-graphite mt-2">
                (Chessboard not available; fallback self-logging active)
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                className="flex-1"
                disabled={pending || isAdvancing}
                onClick={() => recordFallback(true)}
              >
                {isAdvancing ? "Loading next…" : "I solved it"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={pending || isAdvancing}
                onClick={() => recordFallback(false)}
              >
                {isAdvancing ? "Loading next…" : "I missed it"}
              </Button>
            </div>
          </>
        )}

        {(activeTrackIndex > 0 || activeTrack.responseCount > 0) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-xs mt-2"
            disabled={pending}
            onClick={() => reset.mutate()}
          >
            Start over
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
