"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";

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
import {
  detectTacticalMotif,
  type TacticalMotif,
} from "@/analysis/motif-detector";
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

  const [activeBlindspot, setActiveBlindspot] =
    useState<DisplayBlindspot | null>(null);
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

            if (
              evalResult.bestMove &&
              scanSessionIdRef.current === currentSession
            ) {
              const motif: TacticalMotif = detectTacticalMotif(
                topBlunder.fen,
                evalResult.bestMove,
              );

              const measuredRate = (totalBlunders / gamesToScan.length).toFixed(
                1,
              );
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
      {/* The live demo: the most characteristic thing Mainline does, up front. */}
      <div className="sheet p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2.5">
          <p className="label-ink">Blunder analyzer</p>
          <p className="font-mono text-[0.72rem] text-graphite">
            Stockfish runs in your browser
          </p>
        </div>

        <h2 className="max-w-[22ch] text-[1.75rem] leading-[1.06] sm:text-[2.35rem]">
          Paste a username. Get the position you keep missing.
        </h2>
        <p className="font-serif mt-3 max-w-[52ch] text-[1rem] leading-relaxed text-graphite">
          Mainline reads your public games, finds the turning points where you
          lost the most, and sets one up here for you to repair. Nothing is
          stored and no account is needed.
        </p>

        <form onSubmit={handleAnalyze} className="mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-[0.75rem] text-graphite">
              Platform
            </span>
            <div
              role="group"
              aria-label="Platform to read games from"
              className="inline-flex overflow-hidden rounded-[3px] border border-rule"
            >
              {(["lichess", "chesscom"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlatform(value)}
                  aria-pressed={platform === value}
                  className={cn(
                    "min-h-9 px-3 font-mono text-[0.78rem] transition-colors",
                    platform === value
                      ? "bg-biro/[0.09] text-biro font-semibold [box-shadow:inset_0_-2px_0_hsl(var(--biro))]"
                      : "text-graphite hover:bg-ink/[0.04] hover:text-ink",
                  )}
                >
                  {value === "lichess" ? "Lichess" : "Chess.com"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder={
                platform === "lichess"
                  ? "Your Lichess username"
                  : "Your Chess.com username"
              }
              aria-label="Username to analyse"
              className="border-input bg-sheet text-ink placeholder:text-graphite/70 focus-visible:border-biro w-full flex-1 rounded-[2px] border px-2.5 py-2.5 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biro/35"
            />
            <Button
              type="submit"
              disabled={
                query.isFetching || isWasmScanning || !usernameInput.trim()
              }
              className="w-full shrink-0 sm:w-auto"
              size="lg"
            >
              {query.isFetching
                ? "Fetching games…"
                : isWasmScanning
                  ? "Analyzing games…"
                  : "Analyze games"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.75rem] text-graphite">
            <span>Or try a strong player:</span>
            {QUICK_EXAMPLES.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleQuickPick(item)}
                className="text-ink rounded-[2px] underline decoration-rule underline-offset-4 transition-colors hover:decoration-biro"
              >
                {item.label}
              </button>
            ))}
          </div>
        </form>

        {query.error && (
          <div className="mt-5">
            <ErrorNotice
              error={query.error}
              heading="Analysis unavailable"
              message={
                query.error.message ||
                "That username could not be read. Check the spelling and the platform, then run it again."
              }
            />
          </div>
        )}
      </div>

      {/* Working state: the scan ledger. Real steps, real progress, no theatre. */}
      {(query.isFetching || isWasmScanning) && (
        <div className="sheet settle mt-4 overflow-hidden">
          <div className="loading-slide h-[2px] bg-biro/70" aria-hidden />
          <ul className="rule-list" aria-live="polite">
            {[
              {
                name: "Read the public game list",
                done: !query.isFetching,
                active: query.isFetching,
              },
              {
                name: "Score every move with Stockfish",
                done: !isWasmScanning && Boolean(result),
                active: isWasmScanning,
              },
              {
                name: "Set the worst turning point up as a drill",
                done: Boolean(result && drill),
                active: !query.isFetching && isWasmScanning,
              },
            ].map((step) => (
              <li
                key={step.name}
                className="flex items-center gap-3 px-5 py-2.5 font-mono text-[0.8rem]"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[1px] border text-[0.62rem] leading-none",
                    step.done
                      ? "border-tile bg-tile text-sheet"
                      : step.active
                        ? "border-biro text-biro"
                        : "border-rule text-graphite/50",
                  )}
                >
                  {step.done ? "✓" : step.active ? "·" : ""}
                </span>
                <span className={step.active ? "text-ink" : "text-graphite"}>
                  {step.name}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-rule px-5 py-2.5 font-serif text-[0.85rem] leading-relaxed text-graphite">
            {scanStatusMessage ||
              (query.isFetching
                ? `Downloading public game history from ${platform === "lichess" ? "Lichess" : "Chess.com"}…`
                : "Running depth-10 tactical analysis locally…")}
          </p>
        </div>
      )}

      {!query.isFetching && !isWasmScanning && result && blindspot && drill && (
        <div className="sheet settle mt-4 overflow-hidden">
          <div className="grid gap-6 p-5 lg:grid-cols-[1.05fr_0.95fr] lg:p-6">
            <div className="flex min-w-0 flex-col gap-5">
              <div>
                <p className="font-mono text-[0.75rem] text-graphite">
                  {result.username}
                  {" · "}
                  {result.ratingFormat} rating {result.rating}
                </p>
                <h3 className="mt-1.5 text-[1.45rem] leading-tight">
                  Your biggest recurring leak
                </h3>
              </div>

              <div className="border-l-[3px] border-tile/70 pl-3.5">
                <h4 className="flex flex-wrap items-baseline gap-2 text-[1.05rem]">
                  {blindspot.title}
                  <GradeMark
                    grade={blindspot.evidenceGrade}
                    tier={blindspot.evidenceTier}
                  />
                </h4>
                <p className="font-serif mt-1.5 text-[0.95rem] leading-relaxed text-graphite">
                  {blindspot.description}
                </p>
                <p className="font-mono mt-2 text-[0.75rem] text-graphite">
                  Found in {blindspot.mistakeFrequency} of the games scanned
                </p>
              </div>

              <p className="font-serif text-[0.95rem] leading-relaxed text-ink">
                {drill.source === "game"
                  ? "This is a real position from your own game. Find the move you missed."
                  : "This pattern became an interactive drill. Find the winning move."}
              </p>

              <div className="mt-auto flex flex-col gap-3 border-t border-rule pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-serif max-w-[36ch] text-[0.92rem] leading-relaxed text-graphite">
                  Mainline turns every leak it finds into scheduled reviews, so
                  the fix comes back until it sticks.
                </p>
                <Button
                  onClick={handleGenerateProgram}
                  size="lg"
                  className="shrink-0"
                >
                  Build your daily program
                </Button>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[0.75rem] text-graphite">
                  {playerSide === "white" ? "White to move" : "Black to move"}
                </span>
                {solveStatus !== "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetPuzzle}
                    className="h-7 text-[0.78rem] text-graphite hover:text-ink"
                  >
                    Try the position again
                  </Button>
                )}
              </div>

              {boardFen && (
                <div className="relative mx-auto aspect-square w-full max-w-[360px]">
                  <InteractiveBoard
                    fen={solveState?.position ?? boardFen}
                    orientation={playerSide}
                    disabled={solveStatus === "solved"}
                    onMove={handleMove}
                    className="max-w-none"
                  />
                </div>
              )}

              <div
                aria-live="polite"
                className="min-h-[2.75rem] rounded-[3px] bg-ink/[0.025] px-3 py-2"
              >
                {solveStatus === "pending" && (
                  <p className="font-serif text-[0.88rem] leading-relaxed text-graphite">
                    Drag or click a piece to move.
                  </p>
                )}
                {solveStatus === "correct" && (
                  <p className="border-l-[3px] border-tile pl-2 font-mono text-[0.8rem] text-ink">
                    Good move. Continue the line.
                  </p>
                )}
                {solveStatus === "wrong" && (
                  <p className="border-l-[3px] border-brick pl-2 font-mono text-[0.8rem] text-ink">
                    That is not it. The position still fails for you.
                  </p>
                )}
                {solveStatus === "solved" && (
                  <p className="border-l-[3px] border-tile pl-2 font-mono text-[0.8rem] text-ink">
                    Solved. This is exactly what a Mainline block drills until
                    it is automatic.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
