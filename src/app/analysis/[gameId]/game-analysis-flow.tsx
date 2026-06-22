"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chess, type Square } from "chess.js";
import { trpc } from "@/lib/trpc/react";
import { PageShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransparencyCard } from "@/components/transparency-card";
import { type EngineLine } from "@/methodology";
import { cn } from "@/lib/utils";

// Unicode piece representation
const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  w: {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔",
  },
  b: {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚",
  },
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export function GameAnalysisFlow() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const sessionQuery = trpc.analysis.session.useQuery({ gameId });
  const saveSessionMutation = trpc.analysis.saveSession.useMutation();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [reflectionNote, setReflectionNote] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Active reproduction state
  const [currentMomentIdx, setCurrentMomentIdx] = useState(0);
  const [guesses, setGuesses] = useState<Record<number, { uciMove: string; comment: string; correct?: boolean }>>({});
  const [currentComment, setCurrentComment] = useState("");
  const [momentTimer, setMomentTimer] = useState<number | null>(null);

  // Chess board state
  const [chess, setChess] = useState<Chess | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validDestinations, setValidDestinations] = useState<string[]>([]);

  // Engine evaluation states (Step 3)
  const [analyzingPosition, setAnalyzingPosition] = useState(false);
  const [rawEngineLines, setRawEngineLines] = useState<EngineLine[]>([]);

  const session = sessionQuery.data?.session;
  const game = sessionQuery.data?.game;
  const rationales = sessionQuery.data?.rationales;

  // Query hook to filter engine lines
  const filterLinesQuery = trpc.analysis.filterLines.useQuery(
    { lines: rawEngineLines },
    { enabled: step === 3 && rawEngineLines.length > 0 }
  );
  const engineLines = filterLinesQuery.data ?? [];

  // Initialize Step 1 Countdown Delay
  useEffect(() => {
    if (session) {
      setCountdown(Math.ceil(session.analysisUnlockDelay / 1000));
    }
  }, [session]);

  // Calibration unlock timer
  useEffect(() => {
    if (step === 1 && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step, countdown]);

  // Load chess position for the current critical moment in Step 2
  useEffect(() => {
    if (step === 2 && session && game) {
      const moment = session.criticalMoments[currentMomentIdx];
      if (moment) {
        const c = new Chess();
        c.loadPgn(game.pgn);
        const history = c.history({ verbose: true });
        
        // Reconstruct position right BEFORE the blunder (ply is 1-indexed)
        const targetChess = new Chess();
        for (let i = 0; i < moment.ply - 1; i++) {
          const histMove = history[i];
          if (histMove) targetChess.move(histMove.san);
        }
        setChess(targetChess);
        setSelectedSquare(null);
        setValidDestinations([]);
        setCurrentComment("");

        // Setup timer limit (e.g. 180 seconds = 3 minutes)
        setMomentTimer(180);
      }
    }
  }, [step, currentMomentIdx, session, game]);

  const handleReproductionSubmit = useCallback(() => {
    if (currentComment) {
      setGuesses(prev => ({
        ...prev,
        [currentMomentIdx]: {
          ...prev[currentMomentIdx]!,
          comment: currentComment,
        },
      }));
    }
    setStep(3);
  }, [currentComment, currentMomentIdx]);

  // Moment timer countdown
  useEffect(() => {
    if (step === 2 && momentTimer !== null && momentTimer > 0) {
      const timer = setTimeout(() => {
        setMomentTimer(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (step === 2 && momentTimer === 0) {
      handleReproductionSubmit();
    }
  }, [step, momentTimer, handleReproductionSubmit]);

  // Step 3 client-side engine analysis
  useEffect(() => {
    if (step === 3 && session && game) {
      const runEngineAnalysis = async () => {
        setAnalyzingPosition(true);
        try {
          const moment = session.criticalMoments[currentMomentIdx];
          if (!moment || !moment.fen) {
            setAnalyzingPosition(false);
            return;
          }

          const { StockfishAnalysisEngine } = await import("@/analysis");
          const engine = new StockfishAnalysisEngine();
          await engine.init();
          
          const evalLines = await engine.analyzeLines(moment.fen, {
            depth: 12,
            multiPv: 3,
          });
          engine.dispose();

          // Map the engine's REAL MultiPV output to display lines. We never fabricate
          // moves or evals (radical-honesty brand, VISION §2); the RPL filter (server)
          // decides which of these genuine lines are within the player's band.
          const lines: EngineLine[] = evalLines.map((l) => ({
            pv: l.pv,
            depth: l.depth,
            evaluation: l.scoreCp,
            mate: l.mate !== null,
          }));
          setRawEngineLines(lines);

          // Grade the user's guess against the engine's best move (rank 1).
          const bestMove = evalLines[0]?.pv[0];
          setGuesses(prev => {
            const userMove = prev[currentMomentIdx]?.uciMove;
            const isCorrect = !!bestMove && userMove === bestMove;
            return {
              ...prev,
              [currentMomentIdx]: { ...prev[currentMomentIdx]!, correct: isCorrect },
            };
          });
        } catch (e) {
          console.error("Failed to run Stockfish client analysis", e);
        } finally {
          setAnalyzingPosition(false);
        }
      };

      void runEngineAnalysis();
    }
  }, [step, currentMomentIdx, session, game]);

  if (sessionQuery.isLoading) {
    return (
      <PageShell width="default">
        <p className="text-graphite font-mono text-sm">Loading game analysis session…</p>
      </PageShell>
    );
  }

  if (!session || !game) {
    return (
      <PageShell width="default">
        <p className="text-graphite font-serif text-sm">Game analysis session not found.</p>
      </PageShell>
    );
  }

  // Handle Chess Board square clicks
  const handleSquareClick = (square: string) => {
    if (!chess || step === 3) return; // Board read-only during Step 3

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setValidDestinations([]);
      return;
    }

    if (validDestinations.includes(square) && selectedSquare) {
      try {
        const move = chess.move({
          from: selectedSquare,
          to: square,
          promotion: "q",
        });

        // Record the move guess
        setGuesses(prev => ({
          ...prev,
          [currentMomentIdx]: {
            uciMove: move.lan || `${selectedSquare}${square}`,
            comment: currentComment,
          },
        }));

        setChess(new Chess(chess.fen())); // force re-render
        setSelectedSquare(null);
        setValidDestinations([]);
      } catch (e) {
        console.error("Invalid move attempted", e);
      }
      return;
    }

    const piece = chess.get(square as Square);
    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      const moves = chess.moves({ square: square as Square, verbose: true });
      setValidDestinations(moves.map(m => m.to));
    } else {
      setSelectedSquare(null);
      setValidDestinations([]);
    }
  };

  const handleStep3Next = () => {
    if (currentMomentIdx + 1 < session.criticalMoments.length) {
      setCurrentMomentIdx(prev => prev + 1);
      setRawEngineLines([]);
      setStep(2);
    } else {
      setStep(4);
    }
  };

  const handleSaveSession = async () => {
    const outcomes = session.criticalMoments.map((moment, idx) => ({
      ply: moment.ply,
      correct: guesses[idx]?.correct ?? false,
    }));

    await saveSessionMutation.mutateAsync({
      gameId,
      reflectionNote,
      outcomes,
    });

    router.push("/analysis");
  };

  return (
    <PageShell
      eyebrow={`Step ${step} of 4 · Analysis`}
      title={
        step === 1
          ? "Emotional Calibration"
          : step === 2
            ? "Active Reproduction"
            : step === 3
              ? "Engine Feedback"
              : "SRS Spaced Repetition"
      }
      width="default"
    >
      <div className="flex flex-col gap-6">
        {/* Step 1: Calibration View */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Reflect Before You Analyze</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-ink font-serif text-base leading-relaxed">
                {session.calibrationPrompt}
              </p>

              <textarea
                value={reflectionNote}
                onChange={e => setReflectionNote(e.target.value)}
                placeholder="Write your metacognitive reflection note..."
                rows={4}
                className="w-full rounded-md border border-line bg-paper p-3 font-serif text-sm text-ink outline-none focus:border-evergreen"
              />

              <div className="flex items-center justify-between gap-4 mt-2">
                {countdown > 0 ? (
                  <span className="text-graphite font-mono text-xs">
                    Analysis unlocks in {Math.floor(countdown / 60)}:
                    {String(countdown % 60).padStart(2, "0")}
                  </span>
                ) : (
                  <span className="text-evergreen font-mono text-xs font-semibold">
                    ✓ Calibration delay completed
                  </span>
                )}

                <Button
                  disabled={countdown > 0 || reflectionNote.trim().length < 3}
                  onClick={() => setStep(2)}
                >
                  Start Active Reproduction
                </Button>
              </div>

              {rationales && (
                <div className="mt-4 border-t border-line/60 pt-4 flex flex-col gap-4">
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
                  {rationales.analyse_own_games && (
                    <TransparencyCard
                      rationaleText={rationales.analyse_own_games.value}
                      evidenceGrade={rationales.analyse_own_games.grade}
                      evidenceTier={rationales.analyse_own_games.tier}
                      citationKey={rationales.analyse_own_games.citationKey}
                      confidence="medium"
                      soften={rationales.analyse_own_games.soften}
                      flag={rationales.analyse_own_games.flag}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Steps 2 & 3: Interactive Board View */}
        {(step === 2 || step === 3) && chess && (
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            {/* Chessboard Card */}
            <div className="flex flex-col gap-3">
              <div className="relative aspect-square w-full max-w-md rounded-lg overflow-hidden border-2 border-ink shadow-sheet bg-ink">
                <div className="grid grid-cols-8 grid-rows-8 gap-0 h-full w-full">
                  {RANKS.map((rank, rIdx) =>
                    FILES.map((file, cIdx) => {
                      const square = `${file}${rank}`;
                      const isDark = (rIdx + cIdx) % 2 === 1;
                      const piece = chess.get(square as Square);
                      const isSelected = selectedSquare === square;
                      const isValidDest = validDestinations.includes(square);
                      const colorSymbols = piece ? PIECE_SYMBOLS[piece.color] : null;

                      return (
                        <div
                          key={square}
                          onClick={() => handleSquareClick(square)}
                          className={cn(
                            "relative flex items-center justify-center select-none cursor-pointer text-4xl sm:text-5xl",
                            isDark ? "bg-[#4b7399]" : "bg-[#eae9d2]",
                            isSelected && "ring-4 ring-inset ring-evergreen-bright/60",
                            isValidDest && "after:absolute after:h-4 after:w-4 after:rounded-full after:bg-evergreen-bright/40"
                          )}
                        >
                          {piece && colorSymbols && (
                            <span
                              className={cn(
                                "z-10",
                                piece.color === "w" ? "text-paper" : "text-black"
                              )}
                            >
                              {colorSymbols[piece.type] || ""}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {step === 2 && momentTimer !== null && (
                <div className="flex items-center justify-between max-w-md px-1">
                  <span className="text-graphite font-mono text-xs">
                    Time remaining: {Math.floor(momentTimer / 60)}:
                    {String(momentTimer % 60).padStart(2, "0")}
                  </span>
                  <span className="text-graphite font-mono text-xs">
                    Moment {currentMomentIdx + 1} of {session.criticalMoments.length}
                  </span>
                </div>
              )}
            </div>

            {/* Sidebar View */}
            <div className="flex flex-col gap-4">
              {step === 2 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif text-lg">
                      Identify Your Mistake
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <p className="text-graphite font-serif text-sm leading-relaxed">
                      The engine is strictly off. Recreate the position and enter a better alternative move directly on the board.
                    </p>

                    <div className="flex flex-col gap-2">
                      <label className="text-ink font-mono text-xs font-semibold uppercase">
                        Plan Annotation (Optional)
                      </label>
                      <textarea
                        value={currentComment}
                        onChange={e => setCurrentComment(e.target.value)}
                        placeholder="What was your plan here?"
                        rows={3}
                        className="w-full rounded-md border border-line bg-paper p-2.5 font-serif text-sm text-ink outline-none focus:border-evergreen"
                      />
                    </div>

                    <Button
                      disabled={!guesses[currentMomentIdx]}
                      onClick={handleReproductionSubmit}
                      className="w-full mt-2"
                    >
                      Submit Alternative Guess
                    </Button>

                    {rationales && rationales.analysis_engine_delay && (
                      <TransparencyCard
                        rationaleText={rationales.analysis_engine_delay.value}
                        evidenceGrade={rationales.analysis_engine_delay.grade}
                        evidenceTier={rationales.analysis_engine_delay.tier}
                        citationKey={rationales.analysis_engine_delay.citationKey}
                        confidence="medium"
                        soften={rationales.analysis_engine_delay.soften}
                        flag={rationales.analysis_engine_delay.flag}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {step === 3 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif text-lg">
                      Engine Evaluation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {analyzingPosition || filterLinesQuery.isLoading ? (
                      <p className="text-graphite font-mono text-sm">
                        Stockfish analyzing position…
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="rounded-md bg-ink/[0.03] border p-4 flex flex-col gap-2">
                          <p className="font-mono text-xs uppercase text-graphite">
                            Your guess:{" "}
                            <span className="font-bold text-ink">
                              {guesses[currentMomentIdx]?.uciMove || "None"}
                            </span>
                          </p>
                          <p className="font-mono text-xs uppercase text-graphite">
                            Verdict:{" "}
                            <span
                              className={cn(
                                "font-bold",
                                guesses[currentMomentIdx]?.correct
                                  ? "text-grade-a"
                                  : "text-grade-d"
                              )}
                            >
                              {guesses[currentMomentIdx]?.correct
                                ? "Correct alternative"
                                : "Incorrect"}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-col gap-2">
                          <h4 className="font-mono text-xs font-semibold uppercase text-graphite">
                            Filtered Engine Suggestions:
                          </h4>
                          {engineLines.map((line, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "border rounded-md p-3 flex flex-col gap-1 text-xs",
                                line.visible
                                  ? "bg-card border-line"
                                  : "bg-ink/5 border-dashed border-line/50 opacity-60"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold font-mono">
                                  {idx + 1}. {line.pv.slice(0, 8).join(" ")}
                                  {line.pv.length > 8 ? " …" : ""}
                                </span>
                                <span className="font-mono text-graphite">
                                  {line.mate
                                    ? "Mate"
                                    : `${line.evaluation > 0 ? "+" : ""}${line.evaluation / 100}`}
                                </span>
                              </div>
                              {!line.visible && (
                                <p className="text-grade-d font-serif italic text-[0.7rem] mt-1">
                                  [Filtered: {line.reason}]
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <Button onClick={handleStep3Next} className="w-full mt-3">
                          {currentMomentIdx + 1 < session.criticalMoments.length
                            ? "Next Critical Moment"
                            : "Proceed to spaced repetition"}
                        </Button>
                      </div>
                    )}

                    {rationales && (
                      <div className="mt-4 border-t border-line/60 pt-4 flex flex-col gap-4">
                        {rationales.analysis_rpl_filter && (
                          <TransparencyCard
                            rationaleText={rationales.analysis_rpl_filter.value}
                            evidenceGrade={rationales.analysis_rpl_filter.grade}
                            evidenceTier={rationales.analysis_rpl_filter.tier}
                            citationKey={rationales.analysis_rpl_filter.citationKey}
                            confidence="medium"
                            soften={rationales.analysis_rpl_filter.soften}
                            flag={rationales.analysis_rpl_filter.flag}
                          />
                        )}
                        {rationales.analysis_entropy && (
                          <TransparencyCard
                            rationaleText={rationales.analysis_entropy.value}
                            evidenceGrade={rationales.analysis_entropy.grade}
                            evidenceTier={rationales.analysis_entropy.tier}
                            citationKey={rationales.analysis_entropy.citationKey}
                            confidence="medium"
                            soften={rationales.analysis_entropy.soften}
                            flag={rationales.analysis_entropy.flag}
                          />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Spaced Repetition confirmation */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Spaced Repetition (SRS) Integration</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-ink font-serif text-base leading-relaxed">
                We have generated <strong>{session.criticalMoments.length} mistake puzzles</strong> from this game. These will be automatically scheduled using the FSRS spacing algorithm.
              </p>

              <div className="rounded-md border bg-card p-4 flex flex-col gap-3">
                <h4 className="font-mono text-xs font-semibold uppercase text-graphite">
                  SRS Puzzles to Create:
                </h4>
                {session.criticalMoments.map((moment, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs font-mono border-b pb-2 last:border-0 last:pb-0">
                    <span>Moment at ply {moment.ply}</span>
                    <span className={cn("font-bold", guesses[idx]?.correct ? "text-grade-a" : "text-grade-d")}>
                      {guesses[idx]?.correct ? "Good (Standard Schedule)" : "Again (Lapse Schedule)"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-4 mt-2">
                <Button
                  disabled={saveSessionMutation.isPending}
                  onClick={handleSaveSession}
                >
                  {saveSessionMutation.isPending ? "Saving..." : "Save Session & Finish"}
                </Button>
              </div>

              {rationales && rationales.analysis_srs_puzzle && (
                <div className="mt-4 border-t border-line/60 pt-4">
                  <TransparencyCard
                    rationaleText={rationales.analysis_srs_puzzle.value}
                    evidenceGrade={rationales.analysis_srs_puzzle.grade}
                    evidenceTier={rationales.analysis_srs_puzzle.tier}
                    citationKey={rationales.analysis_srs_puzzle.citationKey}
                    confidence="medium"
                    soften={rationales.analysis_srs_puzzle.soften}
                    flag={rationales.analysis_srs_puzzle.flag}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
