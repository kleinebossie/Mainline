"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { trpc } from "@/lib/trpc/react";
import { PageShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  InteractiveBoard,
  type BoardMove,
} from "@/components/interactive-board";
import { TransparencyCard } from "@/components/transparency-card";
import { winProb } from "@/engine/math/winprob";
import { cn } from "@/lib/utils";
import { resultLabel, platformLabel, formatGameDate } from "@/lib/format-game";

// The client-side Stockfish adapter + its eval-line shape (imported lazily at call time).
type AnalysisEngine = import("@/analysis").StockfishAnalysisEngine;
type EvalLine = import("@/analysis/engine-adapter").EvalLine;

// A forced mate maps to a large bounded centipawn magnitude, so mate and cp positions share
// one comparison frame. Anything past half of it is "mate territory" (show words, not a %).
const MATE_CP = 100_000;

// One of the engine's candidate moves at the critical position (player to move).
interface TopMove {
  uci: string;
  san: string;
  /** Eval after this move, from the player's perspective (cp; mate → ±MATE_CP). */
  cp: number;
  mate: number | null;
  /** How much worse than the engine's best move (0 for the best line). */
  engineCpLoss: number;
  /** How much better than the move actually played, as a %; null when a mate is involved. */
  pctBetter: number | null;
}

// Everything Stockfish tells us about one critical moment, computed once when it loads.
interface MomentAnalysis {
  /** The best achievable eval at the position, player's perspective (cp; mate → ±MATE_CP). */
  rootBestCp: number;
  /** Win probability (0..1) of the best line — the mate-safe grading baseline. */
  rootBestWinProb: number;
  /** Centipawns the move actually played gave away (the denominator for "% better"). */
  gameCpLoss: number;
  /** Win-probability the played move gave away (mate-safe; ~0 for a missed-mate-still-winning). */
  gameWinProbDrop: number;
  /** The move the player actually made in the game (SAN), or null if it can't be resolved. */
  gameMoveSan: string | null;
  /** Top engine candidate moves (best first). */
  topMoves: TopMove[];
}

// One attempt the player made at finding a better move.
interface Attempt {
  uci: string;
  san: string;
  cpLoss: number;
  /** Win-probability this attempt gave away vs the best line (mate-safe grading). */
  winProbDrop: number;
  correct: boolean;
  pctBetter: number | null;
}

type AnalysisStatus = "loading" | "ready" | "error";

// How many misses before the player may reveal the engine's picks (the desirable-difficulty
// dosage) is a graded methodology value (Seam 4 §Step 2/3), read from the session payload —
// never hardcoded here (L1). This is only the safe fallback if the field is ever absent.
const DEFAULT_REVEAL_AFTER_MISSES = 3;

/** Eval at the root (player to move): the line's score is already player-perspective. */
function rootEval(line: EvalLine | undefined): number {
  if (!line) return 0;
  if (line.mate != null) return line.mate > 0 ? MATE_CP : -MATE_CP;
  return line.scoreCp;
}

/** Eval after a move, player-perspective: the resulting position has the OPPONENT to move,
 *  so its score (opponent-perspective) is negated. */
function playerEvalAfter(line: EvalLine | undefined): number {
  if (!line) return -MATE_CP;
  if (line.mate != null) return line.mate < 0 ? MATE_CP : -MATE_CP;
  return -line.scoreCp;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** A win-probability drop (0..1) as whole percentage points of win chance — the mate-safe,
 *  human-readable severity that replaces the misleading raw centipawn figure. */
function pctWinChance(drop: number): number {
  return Math.max(0, Math.round(drop * 100));
}

/** How much less centipawn loss `moveCpLoss` is than the played move, as a %. Null when a
 *  mate is involved (the played move missed a forced mate) — we show words there instead. */
function pctBetterThanGame(
  gameCpLoss: number,
  moveCpLoss: number,
): number | null {
  if (!Number.isFinite(gameCpLoss) || gameCpLoss <= 0) return null;
  if (gameCpLoss >= MATE_CP / 2) return null;
  return clampPct(((gameCpLoss - moveCpLoss) / gameCpLoss) * 100);
}

/** SAN for a UCI move from a position, or the raw UCI if it can't be parsed. */
function uciToSan(fen: string, uci: string): string {
  if (uci.length < 4) return uci;
  try {
    const c = new Chess(fen);
    const move = c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    });
    return move.san;
  } catch {
    return uci;
  }
}

export function GameAnalysisFlow() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  // Keep the session stable for the duration of a sitting: a focus/reconnect refetch must
  // not reset an in-progress moment (cleared attempts / a snapped-back board read as a
  // spurious "jump"). The data is deterministic for a given game, so this is safe.
  const sessionQuery = trpc.analysis.session.useQuery(
    { gameId },
    { refetchOnWindowFocus: false, staleTime: Infinity },
  );
  const saveSessionMutation = trpc.analysis.saveSession.useMutation();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reflectionNote, setReflectionNote] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [skipCalibration, setSkipCalibration] = useState(false);

  // Active-reproduction state, reset per critical moment.
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
  // Final per-moment outcome (found a good move = true) fed to the SRS scheduler on save.
  const [outcomes, setOutcomes] = useState<Record<number, boolean>>({});
  const [bestUcis, setBestUcis] = useState<Record<number, string>>({});

  // One Stockfish worker, reused across moments. Engine calls are serialised through a
  // promise chain so a stale search can never overlap a fresh one on the single worker.
  const engineRef = useRef<AnalysisEngine | null>(null);
  const engineQueueRef = useRef<Promise<unknown>>(Promise.resolve());

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

  // Serialise all engine work — only one UCI search runs at a time.
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

  // Tear the worker down when the flow unmounts.
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Step 1 unlock countdown.
  useEffect(() => {
    if (session) setCountdown(Math.ceil(session.analysisUnlockDelay / 1000));
  }, [session]);

  useEffect(() => {
    if (step === 1 && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, countdown]);

  // Load + analyse the current critical moment when we enter (or advance within) step 2.
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

    // The move actually played from this position — matched by FEN, ply as a fallback.
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
      // Irregular PGN — fall back to the stored cp-loss below.
    }

    let aborted = false;
    void withEngine(async (engine) => {
      const rootLines = await engine.analyzeLines(baseFen, {
        depth: 12,
        multiPv: 3,
      });
      if (aborted) return;
      const rootBestCp = rootEval(rootLines[0]);

      const rootBestWinProb = winProb(rootBestCp);

      // Fresh, coherent denominator: the played move's loss against this same root eval.
      // The win-prob drop is the mate-safe severity — a missed mate that stays winning is
      // ~0 here, where the raw cp difference would be a misleading ~99000.
      let gameCpLoss = moment.cpLoss;
      let gameWinProbDrop = 0;
      if (gameMoveResultFen) {
        const gameLines = await engine.analyzeLines(gameMoveResultFen, {
          depth: 12,
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
          engineCpLoss,
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
          depth: 12,
          multiPv: 1,
        });
        const moveEval = playerEvalAfter(lines[0]);
        const cpLoss = Math.max(0, analysis.rootBestCp - moveEval);
        const dropWinProb = Math.max(
          0,
          analysis.rootBestWinProb - winProb(moveEval),
        );
        // Grade on the mate-safe win-probability drop (config-driven, band-dependent) so a
        // move that keeps the win counts even if it isn't the engine's fastest mate; fall
        // back to the cp tolerance only if the win-prob cap is unset.
        const correct =
          moment.maxAcceptableWinProbDrop > 0
            ? dropWinProb <= moment.maxAcceptableWinProbDrop
            : cpLoss <= moment.maxAcceptableCpLoss;
        const attempt: Attempt = {
          uci: move.uci,
          san: move.san,
          cpLoss,
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
    const saveOutcomes = session.criticalMoments.map((moment, idx) => ({
      ply: moment.ply,
      correct: outcomes[idx] ?? false,
      bestUci: bestUcis[idx],
    }));
    await saveSessionMutation.mutateAsync({
      gameId,
      reflectionNote,
      outcomes: saveOutcomes,
    });
    router.push("/analysis");
  };

  if (sessionQuery.isLoading) {
    return (
      <PageShell width="default">
        <p className="text-graphite font-mono text-sm">
          Loading game review session…
        </p>
      </PageShell>
    );
  }

  if (!session || !game) {
    return (
      <PageShell width="default">
        <p className="text-graphite font-serif text-sm">
          Game review session not found.
        </p>
      </PageShell>
    );
  }

  const moment = session.criticalMoments[currentMomentIdx];
  const revealAfterMisses =
    session.revealAfterMisses ?? DEFAULT_REVEAL_AFTER_MISSES;
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
  // Orientation is the side the player is solving as — fixed to the moment's base position
  // (side-to-move there), NOT the live board FEN. The live FEN's side-to-move flips after
  // the user's move, which previously flipped a Black solver's board to White's view.
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
        {/* Game identity — always say *which* game is on screen. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-card px-5 py-3.5 shadow-sheet settle">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full border border-ink",
                game.color === "w"
                  ? "bg-paper"
                  : game.color === "b"
                    ? "bg-ink"
                    : "border-line bg-line",
              )}
              aria-hidden
            />
            <span className="font-serif text-base font-semibold text-ink">
              {game.you ?? "You"}
            </span>
            {game.userRating != null && (
              <span className="text-graphite font-mono text-xs">
                {game.userRating}
              </span>
            )}
          </div>
          <span className="text-graphite font-mono text-[0.65rem] uppercase tracking-wider">
            vs
          </span>
          <div className="flex items-center gap-2">
            <span className="font-serif text-base font-semibold text-ink">
              {game.opponent ?? "Opponent"}
            </span>
            {game.opponentRating != null && (
              <span className="text-graphite font-mono text-xs">
                {game.opponentRating}
              </span>
            )}
          </div>
          <span
            className={cn(
              "rounded px-2 py-0.5 font-mono text-[0.65rem] font-bold uppercase tracking-wide",
              game.result === "win"
                ? "bg-grade-a/10 text-grade-a"
                : game.result === "loss"
                  ? "bg-grade-d/10 text-grade-d"
                  : "bg-grade-c/10 text-grade-c",
            )}
          >
            {resultLabel(game.result)}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-x-2 text-graphite font-mono text-xs">
            <span>{platformLabel(game.platform)}</span>
            {game.timeControl && (
              <>
                <span aria-hidden>·</span>
                <span>{game.timeControl}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{formatGameDate(game.playedAt)}</span>
          </div>
          {game.opening && (
            <p className="basis-full border-t border-line/60 pt-2 font-serif text-xs text-graphite">
              {game.eco ? `${game.eco} · ` : ""}
              {game.opening}
            </p>
          )}
        </div>

        {/* Step 1: Calibration */}
        {step === 1 && (
          <div className="mx-auto w-full max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Reflect Before You Review</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-ink font-serif text-base leading-relaxed">
                  {session.calibrationPrompt}
                </p>

                <textarea
                  value={reflectionNote}
                  onChange={(e) => setReflectionNote(e.target.value)}
                  placeholder="Write your metacognitive reflection note..."
                  rows={4}
                  className="w-full rounded-md border border-line bg-paper p-3 font-serif text-sm text-ink outline-none focus:border-evergreen"
                />

                <div className="mt-2 flex items-center justify-between gap-4">
                  {countdown > 0 ? (
                    <span className="text-graphite font-mono text-xs">
                      Review unlocks in {Math.floor(countdown / 60)}:
                      {String(countdown % 60).padStart(2, "0")}
                    </span>
                  ) : (
                    <span className="text-evergreen font-mono text-xs font-semibold">
                      ✓ Calibration delay completed
                    </span>
                  )}

                  <Button
                    disabled={
                      !skipCalibration &&
                      (countdown > 0 || reflectionNote.trim().length < 3)
                    }
                    onClick={() => setStep(2)}
                  >
                    Start Active Reproduction
                  </Button>
                </div>

                {(countdown > 0 || reflectionNote.trim().length < 3) &&
                  !skipCalibration && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
                      <p className="text-grade-d font-serif text-xs">
                        Skipping this reflection isn&apos;t recommended — see
                        the rationale below.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSkipCalibration(true)}
                      >
                        Skip anyway
                      </Button>
                    </div>
                  )}
                {skipCalibration && (
                  <p className="text-graphite font-mono text-xs">
                    Calibration skipped for this session.
                  </p>
                )}

                {rationales && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-line/60 pt-4">
                    {rationales.analysis_tilt_pause && (
                      <TransparencyCard
                        rationaleText={rationales.analysis_tilt_pause.value}
                        evidenceGrade={rationales.analysis_tilt_pause.grade}
                        evidenceTier={rationales.analysis_tilt_pause.tier}
                        citationKey={rationales.analysis_tilt_pause.citationKey}
                        confidence="medium"
                        soften={rationales.analysis_tilt_pause.soften}
                        flag={rationales.analysis_tilt_pause.flag}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Active Reproduction — retry until found, reveal the engine after 3 misses */}
        {step === 2 && session.criticalMoments.length === 0 && (
          <div className="mx-auto w-full max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>No critical moments at your level</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-ink font-serif text-base leading-relaxed">
                  We didn&apos;t find a mistake large enough to be worth
                  reproducing in this game at your rating. That&apos;s a good
                  sign — there&apos;s no single move that decided it.
                </p>
                <div className="flex justify-end">
                  <Button onClick={() => setStep(3)}>Finish review</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 &&
          session.criticalMoments.length > 0 &&
          boardFen &&
          moment && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
              {/* Board */}
              <div className="flex flex-col gap-3">
                <InteractiveBoard
                  fen={boardFen}
                  onMove={submitGuess}
                  orientation={boardOrientation}
                  disabled={
                    analysisStatus !== "ready" || grading || solved || revealed
                  }
                  highlightedSquares={highlightedSquares}
                  className="w-full max-w-[32rem]"
                />
                <div className="flex max-w-[32rem] items-center justify-between px-1">
                  <span className="text-graphite font-mono text-xs">
                    Moment {currentMomentIdx + 1} of{" "}
                    {session.criticalMoments.length}
                  </span>
                  {!solved && !revealed && (
                    <span className="text-graphite font-mono text-xs">
                      {triesLeft > 0
                        ? `${triesLeft} ${triesLeft === 1 ? "try" : "tries"} before reveal`
                        : "Reveal available"}
                    </span>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif text-lg">
                      Find a better move
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {analysisStatus === "loading" && (
                      <p className="text-graphite font-mono text-sm">
                        Stockfish is reading the position…
                      </p>
                    )}
                    {analysisStatus === "error" && (
                      <p className="text-grade-d font-serif text-sm">
                        We couldn&apos;t review this position. You can still
                        continue.
                      </p>
                    )}

                    {analysisStatus === "ready" && (
                      <>
                        <p className="text-graphite font-serif text-sm leading-relaxed">
                          The engine is held back. Play a stronger move than the
                          one you chose directly on the board.
                        </p>

                        {analysis?.gameMoveSan && (
                          <p className="text-graphite font-mono text-xs">
                            In the game you played{" "}
                            <span className="font-bold text-ink">
                              {analysis.gameMoveSan}
                            </span>
                            {analysis.gameWinProbDrop < 0.05
                              ? " — you stayed clearly ahead; the engine just had a cleaner finish."
                              : `, dropping ~${pctWinChance(analysis.gameWinProbDrop)}% win chance.`}
                          </p>
                        )}

                        {/* Live verdict */}
                        {grading && (
                          <p className="text-graphite font-mono text-sm">
                            Checking your move…
                          </p>
                        )}

                        {!grading && solved && lastAttempt && (
                          <div className="rounded-md border border-grade-a/30 bg-grade-a/10 p-3">
                            <p className="text-grade-a font-mono text-xs font-bold uppercase">
                              ✓ Found it — {lastAttempt.san}
                            </p>
                            <p className="mt-1 font-serif text-sm text-ink">
                              {lastAttempt.pctBetter != null
                                ? `This move is ${lastAttempt.pctBetter}% better than the move you played in the game.`
                                : "This move steers clear of the mistake you played."}
                            </p>
                          </div>
                        )}

                        {!grading && !solved && !revealed && lastAttempt && (
                          <div className="rounded-md border border-line bg-ink/[0.03] p-3">
                            <p className="text-grade-d font-mono text-xs font-bold uppercase">
                              Not the strongest — {lastAttempt.san}
                            </p>
                            <p className="mt-1 font-serif text-sm text-ink">
                              That move still gives up ~
                              {pctWinChance(lastAttempt.winProbDrop)}% win
                              chance. Try another.
                            </p>
                          </div>
                        )}

                        {/* Reveal control / revealed engine moves */}
                        {canReveal && (
                          <Button variant="outline" onClick={reveal}>
                            Show the top 3 engine moves
                          </Button>
                        )}

                        {revealed && analysis && (
                          <div className="flex flex-col gap-2">
                            <h4 className="text-graphite font-mono text-xs font-semibold uppercase">
                              Top engine moves
                            </h4>
                            {analysis.topMoves.map((m, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 rounded-md border border-line bg-card p-3"
                              >
                                <span className="font-mono text-sm font-bold text-ink">
                                  {idx + 1}. {m.san}
                                </span>
                                <div className="text-right">
                                  <span className="text-graphite font-mono text-xs">
                                    {m.mate != null
                                      ? "Mate"
                                      : `${m.cp > 0 ? "+" : ""}${(m.cp / 100).toFixed(1)}`}
                                  </span>
                                  {m.pctBetter != null && (
                                    <p className="text-evergreen font-mono text-[0.7rem]">
                                      {m.pctBetter}% better than your move
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {(solved || revealed) && (
                          <Button onClick={goNext}>
                            {currentMomentIdx + 1 <
                            session.criticalMoments.length
                              ? "Next critical moment"
                              : "Proceed to spaced repetition"}
                          </Button>
                        )}
                      </>
                    )}

                    {analysisStatus === "error" && (
                      <Button onClick={goNext}>Continue</Button>
                    )}

                    {/* Why the engine is held back (always) + tolerance once a verdict shows. */}
                    {rationales && (
                      <div className="mt-2 flex flex-col gap-4 border-t border-line/60 pt-4">
                        {rationales.analysis_engine_delay && (
                          <TransparencyCard
                            rationaleText={
                              rationales.analysis_engine_delay.value
                            }
                            evidenceGrade={
                              rationales.analysis_engine_delay.grade
                            }
                            evidenceTier={rationales.analysis_engine_delay.tier}
                            citationKey={
                              rationales.analysis_engine_delay.citationKey
                            }
                            confidence="medium"
                            soften={rationales.analysis_engine_delay.soften}
                            flag={rationales.analysis_engine_delay.flag}
                          />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

        {/* Step 3: Spaced Repetition confirmation */}
        {step === 3 && (
          <div className="mx-auto w-full max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Spaced Repetition (SRS) Integration</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {session.criticalMoments.length > 0 ? (
                  <>
                    <p className="text-ink font-serif text-base leading-relaxed">
                      We have generated{" "}
                      <strong>
                        {session.criticalMoments.length} mistake puzzle
                        {session.criticalMoments.length === 1 ? "" : "s"}
                      </strong>{" "}
                      from this game. These will be scheduled with the FSRS
                      spacing algorithm.
                    </p>

                    <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
                      <h4 className="text-graphite font-mono text-xs font-semibold uppercase">
                        SRS puzzles to create:
                      </h4>
                      {session.criticalMoments.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between border-b pb-2 font-mono text-xs last:border-0 last:pb-0"
                        >
                          <span>Moment at ply {m.ply}</span>
                          <span
                            className={cn(
                              "font-bold",
                              outcomes[idx] ? "text-grade-a" : "text-grade-d",
                            )}
                          >
                            {outcomes[idx]
                              ? "Good (Standard Schedule)"
                              : "Again (Lapse Schedule)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-ink font-serif text-base leading-relaxed">
                    No mistake puzzles to schedule from this game. We&apos;ve
                    logged the review.
                  </p>
                )}

                <div className="mt-2 flex items-center justify-end gap-4">
                  <Button
                    disabled={saveSessionMutation.isPending}
                    onClick={handleSaveSession}
                  >
                    {saveSessionMutation.isPending
                      ? "Saving..."
                      : "Save Session & Finish"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}
