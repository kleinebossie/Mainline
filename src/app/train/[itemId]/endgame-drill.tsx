"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { trpc } from "@/lib/trpc/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";
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

  // Optional tablebase ground truth for the start position (cache-first, server-side).
  const tb = trpc.program.probeTablebase.useQuery(
    { fen: current?.fen ?? "" },
    { enabled: !!current, staleTime: Infinity, refetchOnWindowFocus: false },
  );

  // One reused Stockfish worker, serialised so replies never overlap (mirrors ReviewBoard).
  const engineRef = useRef<AnalysisEngine | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const getEngine = useCallback(async (): Promise<AnalysisEngine> => {
    if (engineRef.current) return engineRef.current;
    const { StockfishAnalysisEngine } = await import("@/analysis");
    const engine = new StockfishAnalysisEngine();
    await engine.init();
    engineRef.current = engine;
    return engine;
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
      logMutation.mutate({
        programItemId,
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
          // Engine failed — let the player keep moving (or give up).
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
    if (idx + 1 < positions.length) setIdx(idx + 1);
    else setIdx(positions.length); // → completed
  };

  // Completed all positions.
  if (positions.length === 0 || idx >= positions.length) {
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
                ? "There are no endgame positions due right now. They'll return on their spaced schedule."
                : "Each result has been logged and rescheduled for a future review."}
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

              {engineError && (
                <StatusMessage tone="error" heading="Engine unavailable">
                  {engineError}
                </StatusMessage>
              )}

              {logMutation.error && (
                <StatusMessage tone="error" heading="Result not saved">
                  {logMutation.error.message}
                </StatusMessage>
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
                    disabled={logMutation.isPending}
                  >
                    {logMutation.isPending
                      ? "Saving result…"
                      : idx + 1 < positions.length
                        ? "Next endgame"
                        : "Finish"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => finish(fen, "unresolved")}
                    disabled={status === "thinking" || logMutation.isPending}
                  >
                    I can&apos;t convert this
                  </Button>
                )}
                <Link
                  href="/today"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Back to Today
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
