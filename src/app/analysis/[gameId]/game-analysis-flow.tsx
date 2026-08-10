"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { trpc } from "@/lib/trpc/react";
import { PageShell } from "@/components/app-shell";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import type { BoardMove } from "@/components/interactive-board";
import { winProb } from "@/engine/math/winprob";
import {
  ActiveReproductionStep,
  type AnalysisStatus,
} from "@/app/analysis/[gameId]/game-analysis-active";
import { CalibrationStep } from "@/app/analysis/[gameId]/game-analysis-calibration";
import {
  pctBetterThanGame,
  playerEvalAfter,
  rootEval,
  uciToSan,
  type Attempt,
  type MomentAnalysis,
  type TopMove,
} from "@/app/analysis/[gameId]/game-analysis-evaluation";
import { SaveReviewStep } from "@/app/analysis/[gameId]/game-analysis-save";
import { GameIdentity } from "@/app/analysis/[gameId]/game-analysis-shared";
import { errorMessage } from "@/lib/error-presentation";
import { DEFAULT_ANALYSIS_DEPTH } from "@/analysis/worker-config";

// Loaded lazily so Stockfish stays client-side.
type AnalysisEngine = import("@/analysis").StockfishAnalysisEngine;

export function GameAnalysisFlow() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  // Refetching during a sitting must not reset in-progress attempts or board state.
  const sessionQuery = trpc.analysis.session.useQuery(
    { gameId },
    { refetchOnWindowFocus: false, staleTime: Infinity },
  );
  const saveSessionMutation = trpc.analysis.saveSession.useMutation();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reflectionNote, setReflectionNote] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [skipCalibration, setSkipCalibration] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [currentMomentIdx, setCurrentMomentIdx] = useState(0);
  const [momentBaseFen, setMomentBaseFen] = useState<string | null>(null);
  const [boardFen, setBoardFen] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MomentAnalysis | null>(null);
  const [analysisStatus, setAnalysisStatus] =
    useState<AnalysisStatus>("loading");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [grading, setGrading] = useState(false);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<number, boolean>>({});
  const [bestUcis, setBestUcis] = useState<Record<number, string>>({});

  // One worker is reused; the promise chain prevents overlapping UCI searches.
  const engineRef = useRef<AnalysisEngine | null>(null);
  const engineQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveRequestIdRef = useRef<string | null>(null);

  const session = sessionQuery.data?.session;
  const game = sessionQuery.data?.game;
  const rationales = sessionQuery.data?.rationales;

  const getEngine = useCallback(async (): Promise<AnalysisEngine> => {
    if (engineRef.current) return engineRef.current;
    const { StockfishAnalysisEngine } = await import("@/analysis");
    const engine = new StockfishAnalysisEngine();
    await engine.init();
    engineRef.current = engine;
    return engine;
  }, []);

  const withEngine = useCallback(
    <T,>(fn: (engine: AnalysisEngine) => Promise<T>): Promise<T> => {
      const run = engineQueueRef.current.then(async () => {
        const engine = await getEngine();
        return fn(engine);
      });
      engineQueueRef.current = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    [getEngine],
  );

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (session) setCountdown(Math.ceil(session.analysisUnlockDelay / 1000));
  }, [session]);

  useEffect(() => {
    if (step === 1 && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, countdown]);

  useEffect(() => {
    if (step !== 2 || !session || !game) return;
    const moment = session.criticalMoments[currentMomentIdx];
    if (!moment || !moment.fen) {
      setAnalysisStatus("error");
      return;
    }

    const baseFen = moment.fen;
    setMomentBaseFen(baseFen);
    setBoardFen(baseFen);
    setAttempts([]);
    setSolved(false);
    setRevealed(false);
    setGrading(false);
    setAnalysis(null);
    setAnalysisStatus("loading");

    // Match the played move by FEN, with ply as a fallback.
    let gameMoveSan: string | null = null;
    let gameMoveResultFen: string | null = null;
    try {
      const replay = new Chess();
      replay.loadPgn(game.pgn);
      const history = replay.history({ verbose: true });
      const played =
        history.find((m) => m.before === baseFen) ?? history[moment.ply - 1];
      if (played) {
        gameMoveSan = played.san;
        gameMoveResultFen = played.after;
      }
    } catch {
      // Fall back to stored loss for irregular PGN.
    }

    let aborted = false;
    void withEngine(async (engine) => {
      const rootLines = await engine.analyzeLines(baseFen, {
        depth: DEFAULT_ANALYSIS_DEPTH,
        multiPv: 3,
      });
      if (aborted) return;
      const rootBestCp = rootEval(rootLines[0]);

      const rootBestWinProb = winProb(rootBestCp);

      // Compare the played move against this same root evaluation. Win-probability drop
      // avoids huge, misleading centipawn differences around forced mates.
      let gameCpLoss = moment.cpLoss;
      let gameWinProbDrop = 0;
      if (gameMoveResultFen) {
        const gameLines = await engine.analyzeLines(gameMoveResultFen, {
          depth: DEFAULT_ANALYSIS_DEPTH,
          multiPv: 1,
        });
        if (aborted) return;
        const gameEval = playerEvalAfter(gameLines[0]);
        gameCpLoss = Math.max(0, rootBestCp - gameEval);
        gameWinProbDrop = Math.max(0, rootBestWinProb - winProb(gameEval));
      }

      const topMoves: TopMove[] = rootLines.slice(0, 3).map((line) => {
        const uci = line.pv[0] ?? "";
        const cp = rootEval(line);
        const engineCpLoss = Math.max(0, rootBestCp - cp);
        return {
          uci,
          san: uciToSan(baseFen, uci),
          cp,
          mate: line.mate,
          pctBetter: pctBetterThanGame(gameCpLoss, engineCpLoss),
        };
      });

      if (aborted) return;
      const bestMove = topMoves[0];
      if (bestMove) {
        const uci = bestMove.uci;
        setBestUcis((prev) => ({ ...prev, [currentMomentIdx]: uci }));
      }
      setAnalysis({
        rootBestCp,
        rootBestWinProb,
        gameCpLoss,
        gameWinProbDrop,
        gameMoveSan,
        topMoves,
      });
      setAnalysisStatus("ready");
    }).catch(() => {
      if (!aborted) setAnalysisStatus("error");
    });

    return () => {
      aborted = true;
    };
  }, [step, currentMomentIdx, session, game, withEngine]);

  const submitGuess = useCallback(
    (move: BoardMove) => {
      if (!session || !analysis || !momentBaseFen) return;
      if (analysisStatus !== "ready" || grading || solved || revealed) return;
      const moment = session.criticalMoments[currentMomentIdx];
      if (!moment) return;

      let resultFen: string;
      try {
        const c = new Chess(momentBaseFen);
        c.move(move.san);
        resultFen = c.fen();
      } catch {
        return;
      }

      setBoardFen(resultFen);
      setGrading(true);
      void withEngine(async (engine) => {
        const lines = await engine.analyzeLines(resultFen, {
          depth: DEFAULT_ANALYSIS_DEPTH,
          multiPv: 1,
        });
        const moveEval = playerEvalAfter(lines[0]);
        const cpLoss = Math.max(0, analysis.rootBestCp - moveEval);
        const dropWinProb = Math.max(
          0,
          analysis.rootBestWinProb - winProb(moveEval),
        );
        // Prefer mate-safe win-probability grading; use cp tolerance only as fallback.
        const correct =
          moment.maxAcceptableWinProbDrop > 0
            ? dropWinProb <= moment.maxAcceptableWinProbDrop
            : cpLoss <= moment.maxAcceptableCpLoss;
        const attempt: Attempt = {
          uci: move.uci,
          san: move.san,
          winProbDrop: dropWinProb,
          correct,
          pctBetter: pctBetterThanGame(analysis.gameCpLoss, cpLoss),
        };
        setAttempts((prev) => [...prev, attempt]);
        if (correct) {
          setSolved(true);
          setOutcomes((prev) => ({ ...prev, [currentMomentIdx]: true }));
        } else {
          setBoardFen(momentBaseFen); // snap back so they can try again
        }
      })
        .catch(() => setBoardFen(momentBaseFen))
        .finally(() => setGrading(false));
    },
    [
      session,
      analysis,
      momentBaseFen,
      analysisStatus,
      grading,
      solved,
      revealed,
      currentMomentIdx,
      withEngine,
    ],
  );

  const reveal = useCallback(() => {
    setRevealed(true);
    setOutcomes((prev) => ({ ...prev, [currentMomentIdx]: false }));
  }, [currentMomentIdx]);

  const goNext = useCallback(() => {
    if (!session) return;
    setOutcomes((prev) =>
      currentMomentIdx in prev ? prev : { ...prev, [currentMomentIdx]: false },
    );
    if (currentMomentIdx + 1 < session.criticalMoments.length) {
      setCurrentMomentIdx((i) => i + 1);
    } else {
      setStep(3);
    }
  }, [session, currentMomentIdx]);

  const handleSaveSession = async () => {
    if (!session) return;
    setSaveError(null);
    const saveOutcomes = session.criticalMoments.map((moment, idx) => ({
      ply: moment.ply,
      correct: outcomes[idx] ?? false,
      bestUci: bestUcis[idx],
    }));
    try {
      saveRequestIdRef.current ??= crypto.randomUUID();
      await saveSessionMutation.mutateAsync({
        gameId,
        requestId: saveRequestIdRef.current,
        reflectionNote,
        outcomes: saveOutcomes,
      });
      router.push("/analysis");
    } catch (error) {
      setSaveError(
        errorMessage(
          error,
          "The review was not saved. Your notes remain on this page, so try saving again.",
        ),
      );
    }
  };

  if (sessionQuery.isLoading) {
    return (
      <PageShell width="default">
        <StatusMessage tone="loading">
          Loading game review session…
        </StatusMessage>
      </PageShell>
    );
  }

  if (!session || !game || !rationales) {
    return (
      <PageShell width="default">
        <ErrorNotice
          error={sessionQuery.error}
          heading="Review unavailable"
          message="Mainline could not load this game review. Try it again, or return to Analysis and choose another game."
          onRetry={() => void sessionQuery.refetch()}
          retrying={sessionQuery.isFetching}
          retryLabel="Reload review"
        />
      </PageShell>
    );
  }

  const moment = session.criticalMoments[currentMomentIdx];
  const revealAfterMisses = session.revealAfterMisses;
  const wrongCount = attempts.filter((a) => !a.correct).length;
  const lastAttempt = attempts[attempts.length - 1];
  const canReveal = !solved && !revealed && wrongCount >= revealAfterMisses;
  const triesLeft = Math.max(0, revealAfterMisses - wrongCount);
  const showMoveOnBoard =
    boardFen != null && momentBaseFen != null && boardFen !== momentBaseFen;
  const highlightedSquares =
    showMoveOnBoard && lastAttempt
      ? [lastAttempt.uci.slice(0, 2), lastAttempt.uci.slice(2, 4)]
      : [];
  // Base orientation must not flip after the user moves.
  const boardOrientation =
    (momentBaseFen ?? moment?.fen ?? "").split(" ")[1] === "b"
      ? "black"
      : "white";

  return (
    <PageShell
      eyebrow={`Step ${step} of 3 · Game Review`}
      title={
        step === 1
          ? "Emotional Calibration"
          : step === 2
            ? "Active Reproduction"
            : "Spaced Repetition"
      }
      width="wide"
    >
      <div className="flex flex-col gap-6">
        <div className="h-1 w-full rounded-full bg-ink/10">
          <div
            className="h-1 rounded-full bg-evergreen transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
        <GameIdentity game={game} />
        {step === 1 && (
          <CalibrationStep
            prompt={session.calibrationPrompt}
            reflectionNote={reflectionNote}
            countdown={countdown}
            skipped={skipCalibration}
            rationale={rationales.analysis_tilt_pause}
            onReflectionChange={setReflectionNote}
            onSkip={() => setSkipCalibration(true)}
            onContinue={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <ActiveReproductionStep
            session={session}
            moment={moment}
            boardFen={boardFen}
            boardOrientation={boardOrientation}
            highlightedSquares={highlightedSquares}
            currentMomentIndex={currentMomentIdx}
            analysis={analysis}
            analysisStatus={analysisStatus}
            lastAttempt={lastAttempt}
            grading={grading}
            solved={solved}
            revealed={revealed}
            canReveal={canReveal}
            triesLeft={triesLeft}
            engineDelayRationale={rationales.analysis_engine_delay}
            filterRationale={rationales.analysis_rpl_filter}
            guessToleranceRationale={rationales.analysis_guess_tolerance}
            onMove={submitGuess}
            onReveal={reveal}
            onContinue={goNext}
            onFinish={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <SaveReviewStep
            session={session}
            outcomes={outcomes}
            rationale={rationales.analysis_srs_puzzle}
            saveError={saveError}
            saving={saveSessionMutation.isPending}
            onSave={() => void handleSaveSession()}
          />
        )}
      </div>
    </PageShell>
  );
}
