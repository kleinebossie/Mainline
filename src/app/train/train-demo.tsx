"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
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

type TrainingMode = "puzzle" | "spar" | "endgame";
type SolveStatus = "pending" | "correct" | "wrong" | "solved";

const INITIAL_POSITION = new Chess().fen();

export function TrainDemo() {
  const [mode, setMode] = useState<TrainingMode>("puzzle");
  const [endgameFen, setEndgameFen] = useState<string>(DEMO_ENDGAME_FEN);
  const [endgameResult, setEndgameResult] = useState<EndgameScore | null>(null);
  const [solveState, setSolveState] = useState<SolveState>({
    position: DEMO_PUZZLE_FEN,
    solutionLine: DEMO_PUZZLE_SOLUTION,
    cursor: 0,
    startedMs: 0,
    attempts: 0,
  });
  const [solveStatus, setSolveStatus] = useState<SolveStatus>("pending");
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sparFen, setSparFen] = useState(INITIAL_POSITION);
  const [engineLoading, setEngineLoading] = useState<boolean>(false);
  const [engineReady, setEngineReady] = useState<boolean>(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [sparHistory, setSparHistory] = useState<string[]>([]);
  const engineRef = useRef<StockfishAnalysisEngine | null>(null);

  const resetPuzzle = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackRef.current) clearTimeout(feedbackRef.current);

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
  }, []);

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
  }, [mode, resetPuzzle]);

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
      if (feedbackRef.current) clearTimeout(feedbackRef.current);
      feedbackRef.current = setTimeout(() => {
        setSolveStatus((prev) => (prev === "wrong" ? "pending" : prev));
      }, 1500);
    } else if (result.step === "continue" || result.step === "correct") {
      setSolveStatus("correct");
      if (feedbackRef.current) clearTimeout(feedbackRef.current);
      feedbackRef.current = setTimeout(() => {
        setSolveStatus((prev) => (prev === "correct" ? "pending" : prev));
      }, 1000);
    }
  };

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

  const initEngine = async () => {
    if (engineRef.current) return;
    setEngineError(null);
    setEngineLoading(true);
    try {
      const engine = new StockfishAnalysisEngine();
      await engine.init();
      engineRef.current = engine;
      setEngineReady(true);
    } catch {
      setEngineError(
        "The local analysis engine could not start. Reload the page, or continue with the puzzle board without it.",
      );
    } finally {
      setEngineLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (feedbackRef.current) clearTimeout(feedbackRef.current);
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  const handleSparMove = async (move: { san: string }) => {
    setSparHistory((prev) => [...prev, `User: ${move.san}`]);

    const chess = new Chess(sparFen);
    chess.move(move.san);
    const afterUserFen = chess.fen();
    setSparFen(afterUserFen);

    if (chess.isGameOver()) {
      setSparHistory((prev) => [...prev, "Game Over!"]);
      return;
    }

    if (engineRef.current) {
      setEngineError(null);
      setEngineLoading(true);
      try {
        const enginePlay = createEnginePlay(engineRef.current, systemClock);
        const opponent = await enginePlay.getOpponentMove(afterUserFen, {
          depth: 8,
        });

        chess.move(opponent.san);
        setSparFen(chess.fen());
        setSparHistory((prev) => [...prev, `Engine: ${opponent.san}`]);
      } catch {
        setEngineError(
          "The local analysis engine could not reply. Your position is still on the board. Try another move or reset the board.",
        );
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
    setSparFen(INITIAL_POSITION);
    setSparHistory([]);
    setEngineError(null);
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

                  {engineError && (
                    <ErrorNotice
                      heading="Local engine unavailable"
                      message={engineError}
                      onRetry={
                        engineReady ? undefined : () => void initEngine()
                      }
                      retrying={engineLoading}
                      retryLabel="Try starting engine again"
                    />
                  )}

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
