"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InteractiveBoard } from "@/components/interactive-board";
import { TransparencyCard } from "@/components/transparency-card";
import { projectEvalGraph, type EvalGraphPoint } from "@/engine/review";
import { resultLabel, platformLabel, formatGameDate } from "@/lib/format-game";
import { cn } from "@/lib/utils";

type AnalysisEngine = import("@/analysis").StockfishAnalysisEngine;

// Display clamp for the advantage curve (cp). Beyond this it's "winning" — the exact number
// stops mattering, so the line flattens at the top/bottom instead of spiking off-graph.
const GRAPH_CLAMP_CP = 600;

interface BestMove {
  san: string;
  uci: string;
  /** Eval after the move, side-to-move perspective (cp; null shown as mate). */
  cp: number;
  mate: number | null;
}

/** SAN for a UCI move from a position, or the raw UCI if it can't be parsed. */
function uciToSan(fen: string, uci: string): string {
  if (uci.length < 4) return uci;
  try {
    const c = new Chess(fen);
    return c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    }).san;
  } catch {
    return uci;
  }
}

export function ReviewBoard({ gameId }: { gameId: string }) {
  const review = trpc.analysis.review.useQuery(
    { gameId },
    { refetchOnWindowFocus: false, staleTime: Infinity },
  );
  const createDrills = trpc.program.createBlunderDrills.useMutation();

  const game = review.data?.game;
  const userColor: "w" | "b" = game?.color === "b" ? "b" : "w";

  // Step-through positions from the PGN: fens[0] = start, fens[i] = after half-move i.
  const { fens, sans } = useMemo(() => {
    if (!game) return { fens: [], sans: [] as string[] };
    try {
      const c = new Chess();
      c.loadPgn(game.pgn);
      const hist = c.history({ verbose: true });
      if (hist.length === 0) return { fens: [new Chess().fen()], sans: [] };
      return {
        fens: [hist[0]!.before, ...hist.map((m) => m.after)],
        sans: hist.map((m) => m.san),
      };
    } catch {
      return { fens: [new Chess().fen()], sans: [] };
    }
  }, [game]);

  const evalPoints: EvalGraphPoint[] = useMemo(() => {
    if (!review.data) return [];
    const blunderPlies = new Set(review.data.blunders.map((b) => b.ply));
    return projectEvalGraph(review.data.moveEvals, userColor, blunderPlies);
  }, [review.data, userColor]);
  const pointByPly = useMemo(
    () => new Map(evalPoints.map((p) => [p.ply, p])),
    [evalPoints],
  );

  const [idx, setIdx] = useState(0);
  const [bestMoves, setBestMoves] = useState<BestMove[] | null>(null);
  const [engineBusy, setEngineBusy] = useState(false);
  const [drillProgress, setDrillProgress] = useState<number | null>(null);

  // One reused Stockfish worker, serialised so a stale search never overlaps a fresh one.
  const engineRef = useRef<AnalysisEngine | null>(null);
  const engineQueueRef = useRef<Promise<unknown>>(Promise.resolve());

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
      const run = engineQueueRef.current.then(async () => fn(await getEngine()));
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

  // Clear a shown best line whenever we move to another position.
  useEffect(() => setBestMoves(null), [idx]);

  const currentFen = fens[idx] ?? fens[0] ?? new Chess().fen();
  const lastPoint = idx >= 1 ? pointByPly.get(idx) : undefined;

  const showBestLine = useCallback(() => {
    setEngineBusy(true);
    void withEngine((engine) => engine.analyzeLines(currentFen, { depth: 12, multiPv: 3 }))
      .then((lines) => {
        setBestMoves(
          lines.slice(0, 3).map((l) => ({
            uci: l.pv[0] ?? "",
            san: uciToSan(currentFen, l.pv[0] ?? ""),
            cp: l.scoreCp,
            mate: l.mate,
          })),
        );
      })
      .catch(() => setBestMoves([]))
      .finally(() => setEngineBusy(false));
  }, [currentFen, withEngine]);

  const drillBlunders = useCallback(() => {
    const blunders = review.data?.blunders ?? [];
    if (blunders.length === 0) return;
    setDrillProgress(0);
    void (async () => {
      const drills: {
        ply: number;
        fen: string;
        bestUci: string;
        cpLoss: number;
      }[] = [];
      for (let i = 0; i < blunders.length; i++) {
        const b = blunders[i]!;
        try {
          const lines = await withEngine((engine) =>
            engine.analyzeLines(b.fen, { depth: 12, multiPv: 1 }),
          );
          const bestUci = lines[0]?.pv[0];
          if (bestUci) {
            drills.push({ ply: b.ply, fen: b.fen, bestUci, cpLoss: b.cpLoss });
          }
        } catch {
          // skip a position the engine couldn't read
        }
        setDrillProgress(i + 1);
      }
      if (drills.length > 0) {
        await createDrills.mutateAsync({ gameId, drills });
      }
      setDrillProgress(null);
    })();
  }, [review.data, withEngine, createDrills, gameId]);

  if (review.isLoading) {
    return (
      <p className="text-graphite font-mono text-sm">Loading game review…</p>
    );
  }
  if (review.error || !review.data || !game) {
    return (
      <p className="text-graphite font-serif text-sm">
        We couldn&apos;t load this game review.
      </p>
    );
  }

  if (!review.data.analyzed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not analysed yet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-graphite font-serif text-sm leading-relaxed">
            Run the engine over this game first — then come back to step through
            it with the advantage graph and drill your blunders.
          </p>
          <Link href="/analysis" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Go to analysis
          </Link>
        </CardContent>
      </Card>
    );
  }

  const orientation = userColor === "b" ? "black" : "white";
  const lastPly = fens.length - 1;
  const blunderCount = review.data.blunders.length;
  const drilledOk = createDrills.isSuccess;

  return (
    <div className="flex flex-col gap-5">
      {/* Game identity */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-card px-5 py-3.5 shadow-sheet settle">
        <span className="font-serif text-base font-semibold text-ink">
          {game.you ?? "You"}
        </span>
        <span className="text-graphite font-mono text-[0.65rem] uppercase tracking-wider">
          vs
        </span>
        <span className="font-serif text-base font-semibold text-ink">
          {game.opponent ?? "Opponent"}
        </span>
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
        {/* Board + advantage graph + nav */}
        <div className="flex flex-col items-center gap-3">
          <InteractiveBoard
            fen={currentFen}
            orientation={orientation}
            disabled
            highlightedSquares={[]}
            showLegalMoveDots={false}
            allowArrows={false}
            allowHover={false}
            className="w-full max-w-[34rem]"
          />

          {/* Advantage graph (user perspective). Click to jump to a ply. */}
          <EvalGraph
            points={evalPoints}
            currentPly={idx}
            onSeek={(ply) => setIdx(ply)}
          />

          {/* Navigation */}
          <div className="flex w-full max-w-[34rem] items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <NavBtn label="⏮" onClick={() => setIdx(0)} disabled={idx === 0} />
              <NavBtn
                label="◀"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
              />
              <NavBtn
                label="▶"
                onClick={() => setIdx((i) => Math.min(lastPly, i + 1))}
                disabled={idx >= lastPly}
              />
              <NavBtn
                label="⏭"
                onClick={() => setIdx(lastPly)}
                disabled={idx >= lastPly}
              />
            </div>
            <span className="text-graphite font-mono text-xs">
              {idx === 0
                ? "Start"
                : `${Math.ceil(idx / 2)}${idx % 2 === 1 ? "." : "..."} ${sans[idx - 1] ?? ""}`}{" "}
              · ply {idx}/{lastPly}
            </span>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg">This position</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {lastPoint?.blunder ? (
                <p className="text-grade-d font-serif text-sm leading-relaxed">
                  You blundered here — this move gave up about{" "}
                  {Math.round(lastPoint.cpLoss)} centipawns.
                </p>
              ) : (
                <p className="text-graphite font-serif text-sm leading-relaxed">
                  Step through your game. Blunders are marked in red on the
                  graph — click one to jump there.
                </p>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={showBestLine}
                disabled={engineBusy}
              >
                {engineBusy ? "Engine thinking…" : "Show best line"}
              </Button>

              {bestMoves && bestMoves.length > 0 && (
                <div className="flex flex-col gap-2">
                  {bestMoves.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-md border border-line bg-card p-2.5"
                    >
                      <span className="font-mono text-sm font-bold text-ink">
                        {i + 1}. {m.san}
                      </span>
                      <span className="text-graphite font-mono text-xs">
                        {m.mate != null
                          ? `#${Math.abs(m.mate)}`
                          : `${m.cp > 0 ? "+" : ""}${(m.cp / 100).toFixed(1)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Blunder drilling */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg">
                Your blunders ({blunderCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {blunderCount === 0 ? (
                <p className="text-graphite font-serif text-sm leading-relaxed">
                  No blunders flagged in this game — nice and clean.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {review.data.blunders.map((b) => (
                      <button
                        key={b.ply}
                        type="button"
                        onClick={() => setIdx(b.ply)}
                        className="rounded-sm border border-grade-d/40 bg-grade-d/10 px-2 py-0.5 font-mono text-xs text-grade-d hover:bg-grade-d/20"
                      >
                        move {Math.ceil(b.ply / 2)}
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    onClick={drillBlunders}
                    disabled={drillProgress !== null || drilledOk}
                  >
                    {drillProgress !== null
                      ? `Building drills… ${drillProgress}/${blunderCount}`
                      : drilledOk
                        ? `✓ ${createDrills.data?.created ?? 0} drill${createDrills.data?.created === 1 ? "" : "s"} scheduled`
                        : "Drill these blunders (spaced)"}
                  </Button>
                  {drilledOk && (
                    <p className="text-graphite font-mono text-xs leading-relaxed">
                      These positions will come back in your daily session,
                      spaced over the next days.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <TransparencyCard
            rationaleText={review.data.rationale.value}
            evidenceGrade={review.data.rationale.grade}
            evidenceTier={review.data.rationale.tier}
            citationKey={review.data.rationale.citationKey}
            confidence="medium"
            soften={review.data.rationale.soften}
            flag={review.data.rationale.flag}
          />
        </div>
      </div>
    </div>
  );
}

function NavBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-line bg-card px-2.5 py-1 font-mono text-sm text-ink shadow-sheet disabled:opacity-40 hover:bg-paper"
      aria-label={label}
    >
      {label}
    </button>
  );
}

/** The user-perspective advantage curve as a clickable SVG sparkline (positive = user ahead).
 *  Blunder plies are red dots; the current ply is a vertical marker. Pure presentation. */
function EvalGraph({
  points,
  currentPly,
  onSeek,
}: {
  points: EvalGraphPoint[];
  currentPly: number;
  onSeek: (ply: number) => void;
}) {
  if (points.length === 0) return null;
  const n = points.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (cp: number) => {
    const c = Math.max(-GRAPH_CLAMP_CP, Math.min(GRAPH_CLAMP_CP, cp));
    return 50 - (c / GRAPH_CLAMP_CP) * 48;
  };
  const line = points.map((p, i) => `${x(i)},${y(p.cp)}`).join(" ");
  const markerX = currentPly === 0 ? 0 : x(currentPly - 1);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.round(ratio * (n - 1));
    onSeek(Math.max(1, Math.min(n, i + 1)));
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      onClick={handleClick}
      className="h-16 w-full max-w-[34rem] cursor-pointer rounded-md border border-line bg-paper/40"
      role="img"
      aria-label="Advantage graph — click to jump to a move"
    >
      {/* midline (equal) */}
      <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.5" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((p, i) =>
        p.blunder ? (
          <circle key={i} cx={x(i)} cy={y(p.cp)} r="1.6" className="fill-grade-d" />
        ) : null,
      )}
      <line
        x1={markerX}
        y1="0"
        x2={markerX}
        y2="100"
        className="stroke-evergreen"
        strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
