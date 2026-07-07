"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { PageShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  resultLabel,
  colorWord,
  platformLabel,
  formatGameDate,
} from "@/lib/format-game";

function resultChipClass(result: string | null | undefined): string {
  if (result === "win") return "bg-grade-a/10 text-grade-a";
  if (result === "loss") return "bg-grade-d/10 text-grade-d";
  return "bg-grade-c/10 text-grade-c";
}

// Bounded analysis depth (infrastructure: responsive UI / sane battery — not science, mirrors
// the same constant in settings/analysis-runner.tsx).
const ANALYSIS_DEPTH = 12;

type BatchStatus = "idle" | "running" | "error" | "partial";

// The client-side Stockfish adapter type (imported lazily at call time, typed here).
type AnalysisEngine = import("@/analysis").StockfishAnalysisEngine;

export function AnalysisDashboard() {
  const utils = trpc.useUtils();
  const suggestionsQuery = trpc.analysis.suggestions.useQuery();
  const libraryQuery = trpc.analysis.library.useQuery();

  const setPrimary = trpc.analysis.setPrimaryPlatform.useMutation({
    onSuccess: () => void utils.analysis.library.invalidate(),
  });
  const sync = trpc.import.sync.useMutation({
    onSuccess: () => {
      void utils.analysis.library.invalidate();
      void utils.analysis.suggestions.invalidate();
    },
  });
  const saveAnalysis = trpc.analysis.save.useMutation();

  const [platformOverride, setPlatformOverride] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus>("idle");
  const [batchProgress, setBatchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  // The id of the single game whose engine analysis is running (per-row "Engine analysis").
  const [analyzingGameId, setAnalyzingGameId] = useState<string | null>(null);

  const ratio = suggestionsQuery.data?.ratio;

  const library = libraryQuery.data;
  const platforms = library?.platforms ?? [];
  const selectedPlatform =
    platformOverride ?? library?.effectivePlatform ?? null;
  const games = (library?.games ?? []).filter(
    (g) => !selectedPlatform || g.platform === selectedPlatform,
  );

  const choosePlatform = (p: string) => {
    setPlatformOverride(p);
    if (p === "lichess" || p === "chesscom") setPrimary.mutate({ platform: p });
  };

  // Analyse one game with an already-initialised engine and persist its raw features.
  // Shared by the batch runner and the per-game "Engine analysis" button.
  async function analyzeAndSave(
    engine: AnalysisEngine,
    game: { id: string; pgn: string; color: string | null },
  ) {
    const features = await engine.analyzeGame(
      game.pgn,
      { depth: ANALYSIS_DEPTH },
      { userColor: game.color === "b" ? "b" : "w" },
    );
    await saveAnalysis.mutateAsync({
      gameId: game.id,
      engineVersion: engine.engineVersion,
      depth: ANALYSIS_DEPTH,
      rawFeatures: features,
    });
  }

  // Per-game engine analysis: turn Stockfish on for ONE game (the row's "Engine analysis"
  // button). Once its raw features are saved, the row flips to the "Analyze" review entry.
  async function runSingleAnalysis(gameId: string) {
    setAnalyzingGameId(gameId);
    setBatchError(null);
    try {
      const game = await utils.analysis.gameSource.fetch({ gameId });
      const { StockfishAnalysisEngine } = await import("@/analysis");
      const engine = new StockfishAnalysisEngine();
      await engine.init();
      try {
        await analyzeAndSave(engine, game);
      } finally {
        engine.dispose();
      }
      await Promise.all([
        utils.analysis.library.invalidate(),
        utils.analysis.summary.invalidate(),
      ]);
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : "Game scanning failed.");
    } finally {
      setAnalyzingGameId(null);
    }
  }

  // Runs Stockfish (browser WASM) over the unanalysed games in a window scoped to the
  // selected primary platform. `limit` omitted = every unanalysed game currently in view;
  // otherwise the `limit` most recent games on that platform ("Analyse last N games").
  async function runBatchAnalysis(limit?: number) {
    const platform =
      selectedPlatform === "lichess" || selectedPlatform === "chesscom"
        ? selectedPlatform
        : undefined;
    setBatchStatus("running");
    setBatchError(null);
    try {
      const pendingGames = await utils.analysis.pending.fetch(
        limit != null
          ? { limit, platform }
          : platform
            ? { platform }
            : undefined,
      );
      if (pendingGames.length === 0) {
        setBatchStatus("idle");
        return;
      }
      setBatchProgress({ done: 0, total: pendingGames.length });

      const { StockfishAnalysisEngine } = await import("@/analysis");
      const engine = new StockfishAnalysisEngine();
      await engine.init();
      const failures: string[] = [];
      try {
        let done = 0;
        for (const game of pendingGames) {
          try {
            await analyzeAndSave(engine, game);
          } catch (e) {
            failures.push(e instanceof Error ? e.message : "Analysis failed.");
            continue;
          }
          done += 1;
          setBatchProgress({ done, total: pendingGames.length });
        }
      } finally {
        engine.dispose();
      }

      await Promise.all([
        utils.analysis.library.invalidate(),
        utils.analysis.summary.invalidate(),
      ]);
      if (failures.length > 0) {
        setBatchError(
          `${failures.length} game${failures.length === 1 ? "" : "s"} failed and were skipped: ${failures[0]}`,
        );
        setBatchStatus("partial");
      } else {
        setBatchStatus("idle");
      }
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : "Analysis failed.");
      setBatchStatus("error");
    }
  }

  return (
    <PageShell
      eyebrow="Structured Game Review"
      title="Review Own Games"
      lede="Pick one of your games and walk through a 3-step, science-backed review. We prioritise wins for pattern reinforcement and self-correction, avoiding ego-threat while training."
      width="default"
    >
      <div className="flex flex-col gap-8">
        {/* Pick a game — the library, most recent first, filtered by primary platform. */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="eyebrow">Your games · pick one to review</h2>
              <p className="text-graphite font-serif text-xs">
                Most recent first.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {platforms.length > 0 && (
                <div
                  role="tablist"
                  aria-label="Primary platform"
                  className="flex items-center gap-0.5 rounded-md border border-line bg-card p-0.5"
                >
                  {platforms.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="tab"
                      aria-selected={selectedPlatform === p}
                      onClick={() => choosePlatform(p)}
                      className={cn(
                        "rounded px-2.5 py-1 font-mono text-xs transition-colors",
                        selectedPlatform === p
                          ? "bg-evergreen text-paper"
                          : "text-graphite hover:text-ink",
                      )}
                    >
                      {platformLabel(p)}
                    </button>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={sync.isPending}
                onClick={() => sync.mutate()}
              >
                {sync.isPending ? "Syncing…" : "Sync now"}
              </Button>
            </div>
          </div>

          {library?.primaryPlatform == null && platforms.length > 1 && (
            <p className="text-graphite font-serif text-xs italic">
              Pick a platform tab to set it as your primary. We&apos;ll default
              here next time.
            </p>
          )}

          {selectedPlatform && games.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={batchStatus === "running" || analyzingGameId !== null}
                onClick={() => void runBatchAnalysis()}
              >
                Scan all games
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={batchStatus === "running" || analyzingGameId !== null}
                onClick={() => void runBatchAnalysis(20)}
              >
                Scan recent 20
              </Button>
              {batchStatus === "running" && batchProgress && (
                <span className="text-graphite font-mono text-xs">
                  Scanning {batchProgress.done}/{batchProgress.total}…
                </span>
              )}
              {(batchStatus === "error" || batchStatus === "partial") &&
                batchError && (
                  <span className="text-grade-d font-mono text-xs" role="alert">
                    {batchError}
                  </span>
                )}
            </div>
          )}

          {libraryQuery.isLoading ? (
            <p className="text-graphite font-mono text-sm">
              Loading your games…
            </p>
          ) : games.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-graphite font-serif text-sm">
                  {platforms.length === 0
                    ? "No games imported yet. Connect a chess account, then sync to pull your most recent games."
                    : `No ${platformLabel(selectedPlatform)} games imported yet. Try syncing, or switch platform.`}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    size="sm"
                    disabled={sync.isPending}
                    onClick={() => sync.mutate()}
                  >
                    {sync.isPending ? "Syncing…" : "Sync games now"}
                  </Button>
                  <Link
                    href="/connections"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    {platforms.length === 0
                      ? "Connect an account"
                      : "Manage connections"}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {games.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-line bg-card px-4 py-3 shadow-sheet transition-all hover:-translate-y-px"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase",
                          resultChipClass(g.result),
                        )}
                      >
                        {resultLabel(g.result)}
                      </span>
                      <span className="truncate font-serif text-sm font-semibold text-ink">
                        {colorWord(g.color)} vs {g.opponent ?? "Opponent"}
                        {g.opponentRating != null && (
                          <span className="text-graphite font-mono text-xs">
                            {" "}
                            ({g.opponentRating})
                          </span>
                        )}
                      </span>
                      {g.analyzed && (
                        <span className="rounded bg-evergreen/10 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-wide text-evergreen">
                          Scanned
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-graphite font-mono text-[0.7rem]">
                      <span>{platformLabel(g.platform)}</span>
                      {g.timeControl && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{g.timeControl}</span>
                        </>
                      )}
                      <span aria-hidden>·</span>
                      <span>{formatGameDate(g.playedAt)}</span>
                      {g.opening && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{g.opening}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {g.analyzed ? (
                    <Link
                      href={`/analysis/${g.id}`}
                      className={cn(
                        buttonVariants({ size: "sm", variant: "default" }),
                        "shrink-0",
                      )}
                    >
                      Review Game
                    </Link>
                  ) : (
                    // Not scanned yet — turn the engine on for just this game. Neutral
                    // outline, so it never looks like the same control as "Review Game".
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={
                        analyzingGameId !== null || batchStatus === "running"
                      }
                      onClick={() => void runSingleAnalysis(g.id)}
                    >
                      {analyzingGameId === g.id ? "Scanning…" : "Scan game"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Honest one-line recommendation (Seam 4.1 §Step5) — no curated list, since the
            player can already pick any game above. */}
        {ratio && (
          <section className="flex flex-col gap-3 rounded-lg border border-line bg-card px-5 py-4 shadow-sheet">
            <p className="text-ink font-serif text-sm leading-relaxed">
              When picking a game above, aim for roughly{" "}
              <span className="font-mono font-semibold">
                {ratio.winPct}% wins
              </span>{" "}
              to{" "}
              <span className="font-mono font-semibold">
                {ratio.lossPct}% losses
              </span>{" "}
              : {ratio.focusDescription}.
            </p>
          </section>
        )}
      </div>
    </PageShell>
  );
}
