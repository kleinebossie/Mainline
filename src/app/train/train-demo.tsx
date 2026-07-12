"use client";

import React, { useState, useEffect, useRef } from "react";
import { PageShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chess } from "chess.js";
import {
  BOARD_SIZE_CLASS,
  InteractiveBoard,
} from "@/components/interactive-board";
import { stepSolve, type SolveState } from "@/engine/interactive/session";
import { createEnginePlay } from "@/engine/interactive/engine-play";
import {
  classifyTerminal,
  scoreEndgame,
  endgameOrientation,
  endgamePlayerColor,
  type EndgameScore,
} from "@/engine/interactive/endgame";
import { StockfishAnalysisEngine } from "@/analysis/stockfish-adapter";
import { systemClock } from "@/lib/clock";
import { cn } from "@/lib/utils";
import {
  DEMO_ENDGAME_FEN,
  DEMO_PUZZLE_FEN,
  DEMO_PUZZLE_SOLUTION,
} from "@/app/train/train-demo-fixtures";

// A genuine mate-in-1 ENDGAME for the M13 substrate demo: White Ka6 + Qg7 vs lone Black Ka8.
// 1. Qa7# (g7→a7) is checkmate, so the play-out ends immediately — no engine reply needed,
// keeping the demo deterministic and engine-free (the e2e drives exactly this).
// FEN: k7/6Q1/K7/8/8/8/8/8 w - - 0 1   Objective: win (deliver checkmate).

// A genuine, verifiable mate-in-1 for the substrate demo. Black king is boxed on g8 by
// its own pawns (f7/g7/h7); the rook swings to a8 and mates along the back rank — the rook
// is unreachable, so it is real checkmate (not a hanging-piece "win").
// FEN: 6k1/5ppp/8/8/8/8/8/R6K w - - 0 1   Solution: 1. Ra8#  (UCI a1a8)

export function TrainDemo() {
  const [mode, setMode] = useState<"puzzle" | "spar" | "endgame">("puzzle");

  // State for Endgame-drill mode (M13). Played out vs the engine; the mate-in-1 demo ends on
  // the user's move, so we judge with the real engine scorer (classifyTerminal + scoreEndgame).
  const [endgameFen, setEndgameFen] = useState<string>(DEMO_ENDGAME_FEN);
  const [endgameResult, setEndgameResult] = useState<EndgameScore | null>(null);

  // State for Puzzle mode
  const [solveState, setSolveState] = useState<SolveState>({
    position: DEMO_PUZZLE_FEN,
    solutionLine: DEMO_PUZZLE_SOLUTION,
    cursor: 0,
    startedMs: 0,
    attempts: 0,
  });
  const [solveStatus, setSolveStatus] = useState<
    "pending" | "correct" | "wrong" | "solved"
  >("pending");
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // State for Sparring mode
  const [sparFen, setSparFen] = useState<string>(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  );
  const [engineLoading, setEngineLoading] = useState<boolean>(false);
  const [engineReady, setEngineReady] = useState<boolean>(false);
  const [engineLog, setEngineLog] = useState<string[]>([]);
  const [sparHistory, setSparHistory] = useState<string[]>([]);

  // Engine instance ref
  const engineRef = useRef<StockfishAnalysisEngine | null>(null);

  // Initialize/reset puzzle
  const resetPuzzle = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    const now = systemClock.now();
    setSolveState({
      position: DEMO_PUZZLE_FEN,
      solutionLine: DEMO_PUZZLE_SOLUTION,
      cursor: 0,
      startedMs: now,
      attempts: 0,
    });
    setSolveStatus("pending");
    setElapsedMs(0);

    timerRef.current = setInterval(() => {
      setElapsedMs(Math.max(0, systemClock.now() - now));
    }, 100);
  };

  useEffect(() => {
    if (mode === "puzzle") {
      resetPuzzle();
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode]);

  // Handle puzzle move guesses
  const handlePuzzleMove = (move: { san: string }) => {
    const result = stepSolve(solveState, {
      san: move.san,
      atMs: systemClock.now(),
    });
    setSolveState(result.state);

    if (result.step === "solved") {
      setSolveStatus("solved");
      if (timerRef.current) clearInterval(timerRef.current);
    } else if (result.step === "wrong") {
      setSolveStatus("wrong");
      // Flash wrong status, then revert back to pending to allow typing/dragging again
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

  // Handle endgame play-out moves (M13). Apply locally; when the game ends, judge the result
  // against the "win" objective with the real engine scorer (the mate-in-1 demo ends here, so
  // no opponent reply is needed — deterministic and engine-free).
  const handleEndgameMove = (move: { san: string }) => {
    const chess = new Chess(endgameFen);
    try {
      chess.move(move.san);
    } catch {
      return;
    }
    const after = chess.fen();
    setEndgameFen(after);
    if (chess.isGameOver()) {
      const outcome = classifyTerminal(
        after,
        endgamePlayerColor(DEMO_ENDGAME_FEN),
      );
      setEndgameResult(scoreEndgame(outcome, "win"));
    }
  };

  const resetEndgame = () => {
    setEndgameFen(DEMO_ENDGAME_FEN);
    setEndgameResult(null);
  };

  // Lazy initialize Stockfish client-side
  const initEngine = async () => {
    if (engineRef.current) return;
    setEngineLoading(true);
    try {
      const engine = new StockfishAnalysisEngine();
      await engine.init();
      engineRef.current = engine;
      setEngineReady(true);
      setEngineLog((prev) => [
        ...prev,
        "Engine worker booted successfully client-side.",
      ]);
    } catch (e: unknown) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : String(e);
      setEngineLog((prev) => [...prev, `Error booting engine: ${errMsg}`]);
    } finally {
      setEngineLoading(false);
    }
  };

  // Clean up engine worker on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  // Handle sparring user moves and trigger engine reply
  const handleSparMove = async (move: { san: string; uci: string }) => {
    setSparHistory((prev) => [...prev, `User: ${move.san}`]);

    // The board state FEN has updated inside InteractiveBoard.
    // Calculate the new FEN using chess.js locally.
    const { Chess } = await import("chess.js");
    const chess = new Chess(sparFen);
    chess.move(move.san);
    const afterUserFen = chess.fen();
    setSparFen(afterUserFen);

    // If game is over, stop
    if (chess.isGameOver()) {
      setSparHistory((prev) => [...prev, "Game Over!"]);
      return;
    }

    // Trigger engine opponent move if ready
    if (engineRef.current) {
      setEngineLoading(true);
      try {
        const enginePlay = createEnginePlay(engineRef.current, systemClock);
        setEngineLog((prev) => [...prev, "Engine is thinking..."]);
        // Search limit depth 8 for quick client response
        const opponent = await enginePlay.getOpponentMove(afterUserFen, {
          depth: 8,
        });

        // Apply opponent move
        chess.move(opponent.san);
        setSparFen(chess.fen());
        setSparHistory((prev) => [
          ...prev,
          `Engine: ${opponent.san} (${opponent.solveMs}ms)`,
        ]);
        setEngineLog((prev) => [
          ...prev,
          `Engine played ${opponent.san} in ${opponent.solveMs}ms.`,
        ]);
      } catch (err: unknown) {
        console.error(err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setEngineLog((prev) => [...prev, `Opponent error: ${errMsg}`]);
      } finally {
        setEngineLoading(false);
      }
    } else {
      setSparHistory((prev) => [
        ...prev,
        "(Engine not initialized. Play both sides or click Boot Engine)",
      ]);
    }
  };

  const resetSpar = () => {
    setSparFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setSparHistory([]);
    setEngineLog([]);
  };

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-6 py-6 settle">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Practice board
          </h1>
          <p className="text-graphite font-serif text-sm">
            Work through a tactical puzzle, play a short endgame, or spar with
            Stockfish in your browser.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            variant={mode === "puzzle" ? "default" : "outline"}
            onClick={() => setMode("puzzle")}
            size="sm"
            className="w-full"
          >
            Tactical puzzle
          </Button>
          <Button
            variant={mode === "spar" ? "default" : "outline"}
            onClick={() => setMode("spar")}
            size="sm"
            className="w-full"
          >
            Play Stockfish
          </Button>
          <Button
            variant={mode === "endgame" ? "default" : "outline"}
            onClick={() => setMode("endgame")}
            size="sm"
            className="w-full"
          >
            Endgame drill
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Chessboard View */}
          <div className="flex flex-col items-center gap-3">
            <InteractiveBoard
              fen={
                mode === "puzzle"
                  ? solveState.position
                  : mode === "spar"
                    ? sparFen
                    : endgameFen
              }
              onMove={
                mode === "puzzle"
                  ? handlePuzzleMove
                  : mode === "spar"
                    ? handleSparMove
                    : handleEndgameMove
              }
              orientation={
                mode === "endgame"
                  ? endgameOrientation(DEMO_ENDGAME_FEN)
                  : "white"
              }
              disabled={
                (mode === "puzzle" && solveStatus === "solved") ||
                (mode === "spar" && engineLoading) ||
                (mode === "endgame" && endgameResult !== null)
              }
              className={BOARD_SIZE_CLASS}
            />
            {mode === "puzzle" && (
              <div className={`${BOARD_SIZE_CLASS} flex justify-between px-1`}>
                <span className="text-graphite font-mono text-xs">
                  Elapsed: {(elapsedMs / 1000).toFixed(1)}s
                </span>
                <span className="text-graphite font-mono text-xs">
                  Wrong attempts: {solveState.attempts}
                </span>
              </div>
            )}
          </div>

          {/* Sidebar / Info */}
          <div className="flex flex-col gap-4">
            {mode === "puzzle" ? (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">
                    Tactical puzzle
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-graphite font-serif text-sm leading-relaxed">
                    Goal: White to play and mate. Play the single move `Ra8#`
                    (rook a1 → a8) to solve.
                  </p>

                  <div className="flex flex-col gap-2 rounded-md border border-line bg-paper/50 p-4">
                    <span className="text-ink font-mono text-xs font-semibold uppercase tracking-wider">
                      Solving Status:
                    </span>
                    <span
                      id="solving-status"
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
                      {solveStatus === "pending" && "Pending User Move..."}
                    </span>
                  </div>

                  <Button
                    onClick={resetPuzzle}
                    className="w-full mt-2"
                    size="sm"
                  >
                    Reset Puzzle
                  </Button>
                </CardContent>
              </Card>
            ) : mode === "spar" ? (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">
                    Play against Stockfish
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-graphite font-serif text-sm leading-relaxed">
                    This sparring harness boots the Stockfish engine directly
                    inside a Web Worker in your browser. All moves are computed
                    locally.
                  </p>

                  <div className="flex flex-col gap-3">
                    {!engineReady ? (
                      <Button
                        id="boot-engine"
                        onClick={initEngine}
                        disabled={engineLoading}
                        className="w-full"
                        size="sm"
                      >
                        {engineLoading
                          ? "Booting WASM Worker..."
                          : "Boot Stockfish Engine"}
                      </Button>
                    ) : (
                      <div className="text-evergreen font-mono text-xs font-semibold">
                        ✓ Engine ready. Play a move to Spar!
                      </div>
                    )}
                  </div>

                  {/* History & Logs */}
                  <div className="flex flex-col gap-2 border-t border-line/80 pt-4">
                    <span className="text-ink font-mono text-xs font-semibold uppercase tracking-wider">
                      Game History:
                    </span>
                    <div className="h-28 overflow-y-auto rounded-md border border-line bg-paper p-2 font-mono text-xs flex flex-col gap-1">
                      {sparHistory.length === 0 ? (
                        <span className="text-graphite/60 italic">
                          No moves played yet.
                        </span>
                      ) : (
                        sparHistory.map((line, idx) => (
                          <span key={idx}>{line}</span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-ink font-mono text-xs font-semibold uppercase tracking-wider">
                      Engine Console Logs:
                    </span>
                    <div className="h-20 overflow-y-auto rounded-md border border-line bg-paper p-2 font-mono text-[10px] text-graphite/80 flex flex-col gap-0.5">
                      {engineLog.length === 0 ? (
                        <span className="text-graphite/40 italic">
                          Engine idle.
                        </span>
                      ) : (
                        engineLog.map((line, idx) => (
                          <span key={idx}>{line}</span>
                        ))
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={resetSpar}
                    variant="outline"
                    className="w-full mt-2"
                    size="sm"
                    disabled={engineLoading}
                  >
                    Reset Sparring Board
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">
                    Endgame Drill (vs engine)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-graphite font-serif text-sm leading-relaxed">
                    Objective: <strong>win</strong>. White to play and mate:
                    play <code>Qa7#</code> (queen g7 → a7) to convert this King
                    + Queen vs King endgame.
                  </p>

                  <div className="flex flex-col gap-2 rounded-md border border-line bg-paper/50 p-4">
                    <span className="text-ink font-mono text-xs font-semibold uppercase tracking-wider">
                      Endgame Result:
                    </span>
                    <span
                      id="endgame-status"
                      className={cn(
                        "font-serif text-lg font-semibold",
                        endgameResult?.correct && "text-evergreen-bright",
                        endgameResult &&
                          !endgameResult.correct &&
                          "text-destructive",
                        !endgameResult && "text-graphite",
                      )}
                    >
                      {!endgameResult && "Playing… your move"}
                      {endgameResult?.correct && "✓ Endgame won!"}
                      {endgameResult &&
                        !endgameResult.correct &&
                        "✗ Objective not met"}
                    </span>
                  </div>

                  <Button
                    onClick={resetEndgame}
                    className="w-full mt-2"
                    size="sm"
                  >
                    Reset Endgame
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
