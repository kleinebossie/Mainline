"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Check, RotateCcw, Sparkles, Target } from "lucide-react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GradeMark } from "@/components/evidence";
import {
  InteractiveBoard,
  type BoardMove,
} from "@/components/interactive-board";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import { systemClock } from "@/lib/clock";
import { trackFunnelEvent } from "@/lib/telemetry";
import { saveGuestBaseline, saveGuestConnection } from "@/lib/guest-session";
import { detectTacticalMotif, type TacticalMotif } from "@/analysis/motif-detector";
import { cn } from "@/lib/utils";

const QUICK_EXAMPLES = [
  {
    platform: "lichess" as const,
    username: "DrNykterstein",
    label: "DrNykterstein",
  },
  { platform: "chesscom" as const, username: "Hikaru", label: "Hikaru" },
  {
    platform: "chesscom" as const,
    username: "MagnusCarlsen",
    label: "MagnusCarlsen",
  },
];

interface DisplayBlindspot {
  title: string;
  description: string;
  evidenceGrade: "A" | "B" | "C" | "D";
  evidenceTier: number;
  citationKey: string;
  mistakeFrequency: string;
  theme: string;
}

interface DisplayDrill {
  fen: string;
  solutionLine: string[];
  source: "game" | "starter";
  title: string;
  description: string;
  gameInfo?: string;
}

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

  const [activeBlindspot, setActiveBlindspot] = useState<DisplayBlindspot | null>(null);
  const [activeDrill, setActiveDrill] = useState<DisplayDrill | null>(null);
  const [isWasmScanning, setIsWasmScanning] = useState<boolean>(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string>("");

  const scanSessionIdRef = useRef<number>(0);

  const query = trpc.analysis.analyzePublicUsername.useQuery(activeQuery!, {
    enabled: activeQuery !== null && Boolean(activeQuery.username.trim()),
    retry: false,
  });

  const result = query.data;

  // Initialize and run client-side Stockfish WASM analysis when data loads.
  useEffect(() => {
    if (!result) return;

    const currentSession = ++scanSessionIdRef.current;
    const drill = result.drill;
    const now = systemClock.now();

    setActiveBlindspot(result.blindspot);
    setActiveDrill(drill);
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

    saveGuestConnection({
      id: `guest_conn_${result.platform}_${Date.now()}`,
      platform: result.platform,
      externalUsername: result.username,
      status: "active",
      connectedAt: new Date().toISOString(),
      ratings: result.ratings ?? {
        [result.ratingFormat || "rapid"]: { rating: result.rating, rd: 75 },
      },
    });

    saveGuestBaseline({
      username: result.username,
      platform: result.platform,
      tacticalRatingEstimate: result.rating,
      uncertainty: 100,
      topBlindspot: result.blindspot.title,
    });

    // Run client-side Stockfish WASM to scan recent games and extract real blunders.
    if (
      typeof window === "undefined" ||
      typeof Worker === "undefined" ||
      !result.recentGames ||
      result.recentGames.length === 0
    ) {
      return;
    }

    async function runClientAnalysis() {
      setIsWasmScanning(true);
      setScanStatusMessage("Starting Stockfish WASM in browser…");

      try {
        const { StockfishAnalysisEngine } = await import("@/analysis");
        const engine = new StockfishAnalysisEngine();
        await engine.init();

        try {
          const gamesToScan = result!.recentGames.slice(0, 2);
          let totalBlunders = 0;
          const foundBlunders: Array<{
            fen: string;
            cpLoss: number;
            ply: number;
            gamePgn: string;
            gameOpening?: string;
            color: "w" | "b";
          }> = [];

          for (let i = 0; i < gamesToScan.length; i++) {
            if (scanSessionIdRef.current !== currentSession) return;
            const game = gamesToScan[i]!;
            setScanStatusMessage(
              `Scanning game ${i + 1} of ${gamesToScan.length} with Stockfish WASM…`,
            );

            const features = await engine.analyzeGame(
              game.pgn,
              { depth: 10 },
              { userColor: game.color },
            );

            const majorBlunders = features.blunders.filter(
              (b) => b.cpLoss >= 150,
            );
            totalBlunders += majorBlunders.length;

            for (const b of majorBlunders) {
              foundBlunders.push({
                fen: b.fen,
                cpLoss: b.cpLoss,
                ply: b.ply,
                gamePgn: game.pgn,
                gameOpening: game.opening,
                color: game.color,
              });
            }
          }

          if (scanSessionIdRef.current !== currentSession) return;

          if (foundBlunders.length > 0) {
            // Sort by highest cp loss to pick the most instructive turning point.
            foundBlunders.sort((a, b) => b.cpLoss - a.cpLoss);
            const topBlunder = foundBlunders[0]!;

            setScanStatusMessage("Calculating winning move for your blunder…");
            const evalResult = await engine.analyzePosition(topBlunder.fen, {
              depth: 10,
            });

            if (evalResult.bestMove && scanSessionIdRef.current === currentSession) {
              const motif: TacticalMotif = detectTacticalMotif(
                topBlunder.fen,
                evalResult.bestMove,
              );

              const measuredRate = (totalBlunders / gamesToScan.length).toFixed(1);
              const upgradedBlindspot: DisplayBlindspot = {
                title: motif.title,
                description: motif.description,
                evidenceGrade: motif.evidenceGrade,
                evidenceTier: motif.evidenceTier,
                citationKey: motif.citationKey,
                mistakeFrequency: `${measuredRate} mistakes per game`,
                theme: motif.key,
              };

              const upgradedDrill: DisplayDrill = {
                fen: topBlunder.fen,
                solutionLine: [evalResult.bestMove],
                source: "game",
                title: `${motif.title} (Your Game)`,
                description: topBlunder.gameOpening
                  ? `From your recent game in the ${topBlunder.gameOpening}. Find the winning move.`
                  : `From your recent game as ${topBlunder.color === "w" ? "White" : "Black"}. Find the winning move.`,
                gameInfo: topBlunder.gameOpening ?? "Recent game",
              };

              setActiveBlindspot(upgradedBlindspot);
              setActiveDrill(upgradedDrill);
              setBoardFen(upgradedDrill.fen);
              setSolveState({
                position: upgradedDrill.fen,
                solutionLine: upgradedDrill.solutionLine,
                cursor: 0,
                startedMs: systemClock.now(),
                attempts: 0,
              });
              setSolveStatus("pending");
            }
          }
        } finally {
          engine.dispose();
        }
      } catch {
        // Retain server fallback if client WASM encounters an error
      } finally {
        if (scanSessionIdRef.current === currentSession) {
          setIsWasmScanning(false);
          setScanStatusMessage("");
        }
      }
    }

    void runClientAnalysis();
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
          source: activeDrill?.source ?? "starter",
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
    [solveState, solveStatus, attempts, startTime, activeDrill],
  );

  const handleResetPuzzle = () => {
    if (!activeDrill) return;
    const now = systemClock.now();
    setBoardFen(activeDrill.fen);
    setSolveState({
      position: activeDrill.fen,
      solutionLine: activeDrill.solutionLine,
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

  const blindspot = activeBlindspot ?? result?.blindspot;
  const drill = activeDrill ?? result?.drill;

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
            Enter your public chess username. We analyze your recent games with
            Stockfish WASM to find the tactical patterns that cost you rating points.
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
              disabled={query.isFetching || isWasmScanning || !usernameInput.trim()}
              className="w-full shrink-0 sm:w-auto"
              size="lg"
            >
              {query.isFetching
                ? "Fetching Games…"
                : isWasmScanning
                  ? "Analyzing with Stockfish…"
                  : "Analyze My Games"}
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

        {query.error && (
          <div className="mt-6">
            <ErrorNotice
              error={query.error}
              heading="Analysis unavailable"
              message={
                query.error.message ||
                "Could not analyze that account. Please check the username and try again."
              }
            />
          </div>
        )}
      </div>

      {/* Pretty Stockfish WASM Scanning Loading Screen */}
      {(query.isFetching || isWasmScanning) && (
        <div className="settle mt-8 flex flex-col items-center justify-center rounded-xl border border-line bg-paper-raised/90 p-8 sm:p-12 text-center shadow-sheet">
          {/* Animated Tactical Radar / Chess Grid Scanner */}
          <div className="relative mb-6 flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-2xl border border-evergreen/30 bg-evergreen/[0.06] p-2 shadow-inner">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-evergreen/10 via-transparent to-evergreen/5 animate-pulse" />
            
            {/* 4x4 Mini Tactical Board Grid */}
            <div className="grid grid-cols-4 grid-rows-4 gap-1 h-full w-full p-1.5 opacity-80" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-[2px] transition-all duration-700",
                    (i + Math.floor(i / 4)) % 2 === 0
                      ? "bg-evergreen/20"
                      : "bg-paper/80",
                    (i === 5 || i === 10 || i === 6 || i === 9) &&
                      "animate-pulse bg-evergreen-bright/40",
                  )}
                />
              ))}
            </div>

            {/* Central scanning icon */}
            <div className="absolute flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-ink text-paper shadow-md">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-evergreen-bright animate-spin [animation-duration:4s]" />
            </div>
          </div>

          <div className="max-w-md space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-evergreen">
              {query.isFetching
                ? "Connecting to Platform"
                : "Stockfish WASM Engine"}
            </span>
            <h3 className="font-serif text-xl sm:text-2xl font-semibold text-ink">
              {query.isFetching
                ? `Fetching games for ${usernameInput.trim()}…`
                : "Scanning your games for turning points…"}
            </h3>
            <p className="font-mono text-xs sm:text-sm text-graphite leading-relaxed">
              {scanStatusMessage ||
                (query.isFetching
                  ? `Downloading public game history from ${platform === "lichess" ? "Lichess" : "Chess.com"} API…`
                  : "Running depth-10 tactical analysis in your browser…")}
            </p>
          </div>

          {/* Progress Steps Checklist */}
          <div className="mt-8 grid w-full max-w-md grid-cols-1 sm:grid-cols-3 gap-2.5 text-left font-mono text-[0.68rem]">
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border p-2.5 transition-colors",
                !query.isFetching
                  ? "border-evergreen/40 bg-evergreen/[0.08] text-evergreen font-semibold"
                  : "border-line bg-paper text-ink animate-pulse",
              )}
            >
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                  !query.isFetching
                    ? "bg-evergreen text-paper"
                    : "border border-line bg-paper-raised",
                )}
              >
                {!query.isFetching ? "✓" : "1"}
              </div>
              <span className="truncate">Fetch games</span>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 rounded-md border p-2.5 transition-colors",
                isWasmScanning
                  ? "border-evergreen/40 bg-evergreen/[0.08] text-evergreen font-semibold animate-pulse"
                  : !query.isFetching && !isWasmScanning && result
                    ? "border-evergreen/40 bg-evergreen/[0.08] text-evergreen font-semibold"
                    : "border-line bg-paper text-graphite/60",
              )}
            >
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                  !query.isFetching && !isWasmScanning && result
                    ? "bg-evergreen text-paper"
                    : isWasmScanning
                      ? "bg-evergreen-bright text-ink font-bold"
                      : "border border-line bg-paper-raised",
                )}
              >
                {!query.isFetching && !isWasmScanning && result ? "✓" : "2"}
              </div>
              <span className="truncate">Stockfish WASM</span>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 rounded-md border p-2.5 transition-colors",
                !query.isFetching && !isWasmScanning && result
                  ? "border-evergreen/40 bg-evergreen/[0.08] text-evergreen font-semibold"
                  : "border-line bg-paper text-graphite/60",
              )}
            >
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                  !query.isFetching && !isWasmScanning && result
                    ? "bg-evergreen text-paper"
                    : "border border-line bg-paper-raised",
                )}
              >
                {!query.isFetching && !isWasmScanning && result ? "✓" : "3"}
              </div>
              <span className="truncate">Build drill</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-[0.65rem] text-graphite">
            <span className="inline-flex items-center gap-1 rounded bg-paper px-2 py-0.5 border border-line">
              <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
              100% In-Browser WASM
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-paper px-2 py-0.5 border border-line">
              Zero Server Compute
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-paper px-2 py-0.5 border border-line">
              Read-Only
            </span>
          </div>
        </div>
      )}

      {/* Analysis Result & Interactive Drill — Shown ONLY when scanning has completed */}
      {!query.isFetching && !isWasmScanning && result && blindspot && drill && (
        <div className="settle mt-8 flex flex-col gap-8 rounded-xl border border-line bg-paper p-6 shadow-sheet sm:p-8">
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
                  <span className="text-graphite">
                    {result.ratingFormat} Rating:
                  </span>
                  <span className="font-bold text-ink">{result.rating}</span>
                </div>
              </div>

              <div className="rounded-lg border border-line bg-paper-raised/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-evergreen/10 text-evergreen">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-serif text-lg font-semibold text-ink">
                        {blindspot.title}
                      </h4>
                      {drill.source === "game" && (
                        <span className="rounded bg-evergreen/15 px-2 py-0.5 font-mono text-[0.65rem] font-bold text-evergreen uppercase">
                          From Your Game
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 font-serif text-sm leading-relaxed text-graphite">
                      {blindspot.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="rounded bg-paper px-2 py-0.5 font-mono text-[0.68rem] text-graphite border border-line">
                        Frequency: {blindspot.mistakeFrequency}
                      </span>
                      <GradeMark
                        grade={blindspot.evidenceGrade}
                        tier={blindspot.evidenceTier}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-l-2 border-evergreen/60 pl-4">
                <p className="font-serif text-sm leading-relaxed text-graphite">
                  {drill.source === "game"
                    ? "We extracted an actual blunder from your games. Find the winning tactical move on the board to repair this blindspot."
                    : "We turned this pattern into an interactive practice puzzle. Find the winning tactical move on the board to clear this blindspot."}
                </p>
              </div>

              {/* Call to Action Card */}
              <div className="rounded-lg border border-evergreen/30 bg-evergreen/[0.04] p-5">
                <h4 className="font-serif text-lg font-semibold text-ink">
                  Ready to fix this pattern every day?
                </h4>
                <p className="mt-1 font-serif text-sm leading-relaxed text-graphite">
                  Mainline generates a complete daily training program adapted
                  to your time budget and tactical weaknesses.
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
                      Great calculation! Mainline builds these daily drills
                      directly from your games.
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
