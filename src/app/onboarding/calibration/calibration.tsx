"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeMark } from "@/components/evidence";
import { StatusMessage } from "@/components/ui/status-message";
import {
  BOARD_SIZE_CLASS,
  InteractiveBoard,
} from "@/components/interactive-board";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import {
  puzzleToSolveState,
  type BoardOrientation,
} from "@/engine/interactive/puzzle";
import { systemClock } from "@/lib/clock";
import { cn } from "@/lib/utils";

// Adaptive calibration UI. Difficulty for each item is produced by the methodology
// (config-driven ladder); we present it as a strength target and record only the
// behavioural outcome (solved / missed). The active methodology controls the tracks
// and ladder length; an in-progress historic assessment keeps its original release.

type Grade = "A" | "B" | "C" | "D";
function asGrade(g: string): Grade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

// Display-only gauge axis (UI scale, not a methodology value).
const MIN = 800;
const MAX = 2500;
function pct(r: number): number {
  return Math.min(100, Math.max(0, ((r - MIN) / (MAX - MIN)) * 100));
}

export function Calibration() {
  const utils = trpc.useUtils();
  const state = trpc.assessment.state.useQuery();

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => void utils.assessment.state.invalidate(),
  });
  const reset = trpc.assessment.reset.useMutation({
    onSuccess: () => void utils.assessment.state.invalidate(),
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
      });
    } else if (result.step === "wrong") {
      setSolveStatus("wrong");
      submit.mutate({
        ratingShown: activeTrack.next.ratingTarget,
        correct: false,
        puzzleId: activePuzzle.puzzleId,
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
    });
  };

  if (state.isLoading) {
    return <StatusMessage tone="loading">Loading calibration…</StatusMessage>;
  }

  if (!state.data) {
    return (
      <StatusMessage tone="error" heading="Calibration unavailable">
        We could not load your calibration. Refresh the page and try again.
      </StatusMessage>
    );
  }

  const {
    completed,
    maxItems,
    timeBudgetMin,
    trackCount,
    activeTrackIndex,
    tracks,
  } = state.data;

  // --- Completed: the multi-dimensional baseline -----------------------------
  if (completed || !activeTrack) {
    const primary = tracks[0]!;
    return (
      <Card gutter={asGrade(primary.estimate.evidenceGrade)} className="settle">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-3xl font-semibold">
            Your starting baseline
          </CardTitle>
          <p className="text-graphite font-mono text-sm mt-1">
            {tracks.length === 1
              ? "A behavioural read of your tactical level."
              : `A behavioural read across ${tracks.length} dimensions.`}{" "}
            Uncertainty shrinks with more games and reviews.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            {tracks.map((t) => {
              const v = t.estimate.tacticalRatingEstimate;
              const u = t.estimate.uncertainty;
              const left = pct(v - u);
              const width = pct(v + u) - left;
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-2 rounded-md border p-4 bg-paper/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-serif text-base font-semibold text-ink">
                      {t.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                        ≈ {v} ± {u}
                      </span>
                      <GradeMark grade={t.estimate.evidenceGrade} />
                    </span>
                  </div>
                  <div className="relative h-3 w-full bg-ink/5 dark:bg-ink/20 rounded-sm border border-line overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 bg-evergreen/15 dark:bg-evergreen/35 border-x border-evergreen/30"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-evergreen"
                      style={{ left: `${pct(v)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-graphite font-serif text-sm leading-relaxed border-t border-line/80 pt-4">
            {tracks.length === 1
              ? "This is a rough calibration point"
              : "These are rough calibration points"}
            , not verdicts. The fuller picture comes from analysing your real
            games.
          </p>

          <div className="flex flex-wrap gap-3 border-t border-line/80 pt-5">
            <Link href="/onboarding/constraints" className={buttonVariants()}>
              Continue
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
        </CardContent>
      </Card>
    );
  }

  // --- In progress: the active track's next item -----------------------------
  const recordFallback = (correct: boolean) =>
    submit.mutate({ ratingShown: activeTrack.next.ratingTarget, correct });

  return (
    <Card className="settle">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow !text-[0.65rem]">
            Track {activeTrackIndex + 1} of {trackCount} · {activeTrack.label}
          </p>
          <p className="text-graphite font-mono text-[0.65rem] uppercase tracking-wider">
            ~{timeBudgetMin} min each
          </p>
        </div>
        <CardTitle className="font-serif text-3xl font-semibold mt-2">
          {activeTrack.label}: puzzle {activeTrack.next.itemNumber} of{" "}
          {maxItems}
        </CardTitle>
        <p className="text-graphite text-sm leading-relaxed mt-1">
          Solve a {activeTrack.label.toLowerCase()} puzzle around this strength,
          then tell us how it went.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Track progress dots */}
        <div className="flex items-center gap-1.5">
          {tracks.map((t, i) => (
            <span
              key={t.id}
              aria-hidden
              className={
                "h-1.5 flex-1 rounded-full " +
                (t.completed
                  ? "bg-evergreen"
                  : i === activeTrackIndex
                    ? "bg-evergreen/40"
                    : "bg-line")
              }
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
                <span className="text-graphite font-mono text-xs">
                  You play {orientation}
                </span>
              </div>
              <InteractiveBoard
                fen={solveState.position}
                onMove={handleMove}
                orientation={orientation}
                disabled={
                  pending || solveStatus === "solved" || solveStatus === "wrong"
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
                  {solveStatus === "solved" && "✓ Correct!"}
                  {solveStatus === "wrong" && "✗ Incorrect!"}
                  {solveStatus === "correct" && "✓ Correct Move!"}
                  {solveStatus === "pending" && "Solve the puzzle..."}
                </span>
              </div>

              <div className="flex flex-col gap-2 border-t border-line/80 pt-4">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={pending}
                >
                  Skip / Give Up
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
                disabled={pending}
                onClick={() => recordFallback(true)}
              >
                I solved it
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => recordFallback(false)}
              >
                I missed it
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
