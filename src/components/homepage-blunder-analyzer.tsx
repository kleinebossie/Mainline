"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Check, RotateCcw, Target } from "lucide-react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GradeMark } from "@/components/evidence";
import {
  InteractiveBoard,
  type BoardMove,
} from "@/components/interactive-board";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import { systemClock } from "@/lib/clock";
import { trackFunnelEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

const QUICK_EXAMPLES = [
  { platform: "lichess" as const, username: "DrNykterstein", label: "DrNykterstein" },
  { platform: "chesscom" as const, username: "Hikaru", label: "Hikaru" },
  { platform: "chesscom" as const, username: "MagnusCarlsen", label: "MagnusCarlsen" },
];

export function HomepageBlunderAnalyzer() {
  const router = useRouter();
  const [platform, setPlatform] = useState<"lichess" | "chesscom">("lichess");
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [activeQuery, setActiveQuery] = useState<{
    platform: "lichess" | "chesscom";
    username: string;
  } | null>(null);

  const [solveState, setSolveState] = useState<SolveState | null>(null);
  const [boardFen, setBoardFen] = useState<string | null>(null);
  const [solveStatus, setSolveStatus] = useState<
    "pending" | "correct" | "wrong" | "solved"
  >("pending");
  const [attempts, setAttempts] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);

  const query = trpc.analysis.analyzePublicUsername.useQuery(
    activeQuery!,
    {
      enabled: activeQuery !== null && Boolean(activeQuery.username.trim()),
      retry: false,
    },
  );

  const result = query.data;

  // Initialize interactive blunder drill when analysis data loads.
  useEffect(() => {
    if (!result) return;

    const drill = result.drill;
    const now = systemClock.now();

    setBoardFen(drill.fen);
    setSolveState({
      position: drill.fen,
      solutionLine: drill.solutionLine,
      cursor: 0,
      startedMs: now,
      attempts: 0,
    });
    setSolveStatus("pending");
    setAttempts(0);
    setStartTime(now);

    trackFunnelEvent("username_analyzed", {
      platform: result.platform,
      hasGames: result.gamesAnalyzed > 0,
      rating: result.rating,
      blunderCount: result.gamesAnalyzed,
    });
  }, [result]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameInput.trim();
    if (!clean) return;
    setActiveQuery({ platform, username: clean });
  };

  const handleQuickPick = (item: (typeof QUICK_EXAMPLES)[number]) => {
    setPlatform(item.platform);
    setUsernameInput(item.username);
    setActiveQuery({ platform: item.platform, username: item.username });
  };

  const handleMove = useCallback(
    (move: BoardMove) => {
      if (!solveState || solveStatus === "solved") return;

      const now = systemClock.now();
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);

      const res = stepSolve(solveState, {
        san: move.san,
        atMs: now,
      });

      setSolveState(res.state);

      if (res.step === "solved") {
        setSolveStatus("solved");
        trackFunnelEvent("sample_drill_solved", {
          attempts: nextAttempts,
          solveTimeMs: Math.max(0, now - startTime),
          source: result?.drill.source ?? "starter",
        });
      } else if (res.step === "wrong") {
        setSolveStatus("wrong");
      } else if (res.step === "correct" || res.step === "continue") {
        setSolveStatus("correct");
        setTimeout(() => {
          setSolveStatus((prev) => (prev === "correct" ? "pending" : prev));
        }, 800);
      }
    },
    [solveState, solveStatus, attempts, startTime, result],
  );

  const handleResetPuzzle = () => {
    if (!result) return;
    const drill = result.drill;
    const now = systemClock.now();
    setBoardFen(drill.fen);
    setSolveState({
      position: drill.fen,
      solutionLine: drill.solutionLine,
      cursor: 0,
      startedMs: now,
      attempts: 0,
    });
    setSolveStatus("pending");
  };

  const handleGenerateProgram = () => {
    router.push("/onboarding/constraints");
  };

  const playerSide = useMemo(() => {
    if (!boardFen) return "white";
    try {
      return new Chess(boardFen).turn() === "w" ? "white" : "black";
    } catch {
      return "white";
    }
  }, [boardFen]);

  return (
    <div className="w-full">
      {/* Input Search Hero Card */}
      <div className="rounded-xl border border-line bg-paper-raised/80 p-6 shadow-sheet sm:p-8">
        <div>
          <p className="eyebrow text-evergreen">Interactive Blunder Analyzer</p>
          <h2 className="mt-3 font-serif text-2xl font-semibold sm:text-4xl">
            Find the tactical blindspots hiding in your games.
          </h2>
          <p className="mt-2 max-w-2xl font-serif text-sm leading-relaxed text-graphite sm:text-base">
            Enter your public chess username. We analyze your recent games and
            extract the tactical pattern that costs you rating points.
          </p>
        </div>

        <form onSubmit={handleAnalyze} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-graphite">Platform:</span>
            <div className="flex rounded-md border border-line bg-paper p-0.5">
              <button
                type="button"
                onClick={() => setPlatform("lichess")}
                className={cn(
                  "rounded px-3 py-1 font-mono text-xs font-medium transition-colors",
                  platform === "lichess"
                    ? "bg-ink text-paper"
                    : "text-graphite hover:text-ink",
                )}
              >
                Lichess
              </button>
              <button
                type="button"
                onClick={() => setPlatform("chesscom")}
                className={cn(
                  "rounded px-3 py-1 font-mono text-xs font-medium transition-colors",
                  platform === "chesscom"
                    ? "bg-ink text-paper"
                    : "text-graphite hover:text-ink",
                )}
              >
                Chess.com
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder={`Enter your ${platform === "lichess" ? "Lichess" : "Chess.com"} username`}
              className="w-full flex-1 rounded-md border border-line bg-paper px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-graphite/50 focus:border-evergreen focus:outline-none focus:ring-1 focus:ring-evergreen"
            />
            <Button
              type="submit"
              disabled={query.isFetching || !usernameInput.trim()}
              className="w-full shrink-0 sm:w-auto"
              size="lg"
            >
              {query.isFetching ? "Analyzing Games…" : "Analyze My Games"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-graphite">
            <span>Or try an example:</span>
            {QUICK_EXAMPLES.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleQuickPick(item)}
                className="rounded border border-line/80 bg-paper/60 px-2 py-0.5 transition-colors hover:border-evergreen hover:text-ink"
              >
                {item.label}
              </button>
            ))}
          </div>
        </form>

        {query.isFetching && (
          <div className="mt-6">
            <StatusMessage tone="loading">
              Fetching games from {platform === "lichess" ? "Lichess" : "Chess.com"} and detecting tactical patterns…
            </StatusMessage>
          </div>
        )}

        {query.error && (
          <div className="mt-6">
            <ErrorNotice
              error={query.error}
              heading="Analysis unavailable"
              message={query.error.message || "Could not analyze that account. Please check the username and try again."}
            />
          </div>
        )}
      </div>

      {/* Analysis Result & Interactive Drill */}
      {result && (
        <div className="mt-8 flex flex-col gap-8 rounded-xl border border-line bg-paper p-6 shadow-sheet sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            {/* Left: Tactical Blindspot Summary */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-evergreen">
                    Analysis for {result.username}
                  </span>
                  <h3 className="mt-1 font-serif text-2xl font-semibold text-ink">
                    Top Tactical Blindspot
                  </h3>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-line bg-paper-raised px-3 py-1 font-mono text-xs">
                  <span className="text-graphite">{result.ratingFormat} Rating:</span>
                  <span className="font-bold text-ink">{result.rating}</span>
                </div>
              </div>

              <div className="rounded-lg border border-line bg-paper-raised/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-evergreen/10 text-evergreen">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-serif text-lg font-semibold text-ink">
                      {result.blindspot.title}
                    </h4>
                    <p className="mt-1.5 font-serif text-sm leading-relaxed text-graphite">
                      {result.blindspot.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="rounded bg-paper px-2 py-0.5 font-mono text-[0.68rem] text-graphite border border-line">
                        Frequency: {result.blindspot.mistakeFrequency}
                      </span>
                      <GradeMark
                        grade={result.blindspot.evidenceGrade}
                        tier={result.blindspot.evidenceTier}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-l-2 border-evergreen/60 pl-4">
                <p className="font-serif text-sm leading-relaxed text-graphite">
                  We turned your mistake pattern into an interactive fix puzzle.
                  Find the winning tactical move on the board to clear this blindspot.
                </p>
              </div>

              {/* Call to Action Card */}
              <div className="rounded-lg border border-evergreen/30 bg-evergreen/[0.04] p-5">
                <h4 className="font-serif text-lg font-semibold text-ink">
                  Ready to fix this pattern every day?
                </h4>
                <p className="mt-1 font-serif text-sm leading-relaxed text-graphite">
                  Mainline generates a complete daily training program adapted to
                  your time budget and tactical weaknesses.
                </p>
                <div className="mt-4">
                  <Button
                    onClick={handleGenerateProgram}
                    size="lg"
                    className="w-full sm:w-auto font-serif"
                  >
                    Build your daily program →
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Interactive Board */}
            <div className="flex w-full flex-col items-center gap-4 rounded-xl border border-line bg-paper-raised/50 p-4 sm:p-6">
              <div className="flex w-full items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-graphite">
                  {playerSide === "white" ? "White to move" : "Black to move"}
                </span>
                {solveStatus !== "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetPuzzle}
                    className="h-7 gap-1 font-mono text-xs text-graphite hover:text-ink"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </Button>
                )}
              </div>

              {boardFen && (
                <div className="relative aspect-square w-full max-w-[320px] sm:max-w-[400px]">
                  <InteractiveBoard
                    fen={solveState?.position ?? boardFen}
                    orientation={playerSide}
                    disabled={solveStatus === "solved"}
                    onMove={handleMove}
                  />
                </div>
              )}

              {/* Solve Feedback Messages */}
              <div className="w-full">
                {solveStatus === "pending" && (
                  <p className="text-center font-mono text-xs text-graphite">
                    Drag or click pieces on the board to make your move.
                  </p>
                )}
                {solveStatus === "correct" && (
                  <div className="flex items-center justify-center gap-2 rounded-md bg-evergreen/10 py-2 text-evergreen">
                    <Check className="h-4 w-4" />
                    <span className="font-mono text-xs font-semibold">
                      Good move! Keep going.
                    </span>
                  </div>
                )}
                {solveStatus === "wrong" && (
                  <div className="flex items-center justify-center gap-2 rounded-md bg-red-500/10 py-2 text-red-600">
                    <span className="font-mono text-xs font-semibold">
                      Incorrect move. Try another line!
                    </span>
                  </div>
                )}
                {solveStatus === "solved" && (
                  <div className="flex flex-col items-center gap-2 rounded-md border border-evergreen/40 bg-evergreen/10 p-3 text-center">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-evergreen">
                      <Check className="h-4 w-4 stroke-[2.5]" />
                      <span>Tactical Blindspot Solved!</span>
                    </div>
                    <p className="font-serif text-xs text-graphite">
                      Great calculation! Mainline builds these daily drills directly
                      from your games.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
