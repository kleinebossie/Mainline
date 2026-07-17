"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { PageShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import { MethodologyRationaleCard } from "@/components/methodology-rationale-card";
import { cn } from "@/lib/utils";
import {
  resultLabel,
  colorWord,
  platformLabel,
  formatGameDate,
} from "@/lib/format-game";
import { errorMessage } from "@/lib/error-presentation";
import { ManualGameImport } from "@/app/analysis/manual-game-import";

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
  const ownGamesRationale = suggestionsQuery.data?.ownGamesRationale;
  const successBiasRationale = suggestionsQuery.data?.successBiasRationale;

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
      setBatchError(
        errorMessage(
          e,
          "This game could not be scanned. No result was saved. Try it again.",
        ),
      );
    } finally {
      setAnalyzingGameId(null);
    }
  }

  // Runs Stockfish (browser WASM) over a bounded recent window scoped to the selected
  // platform. The caller passes either the visible game count or the explicit recent count.
  async function runBatchAnalysis(limit: number) {
    const platform =
      selectedPlatform === "lichess" ||
      selectedPlatform === "chesscom" ||
      selectedPlatform === "manual"
        ? selectedPlatform
        : undefined;
    setBatchStatus("running");
    setBatchError(null);
    try {
      const pendingGames = await utils.analysis.pending.fetch({
        limit,
        ...(platform ? { platform } : {}),
      });
      if (pendingGames.length === 0) {
        setBatchStatus("idle");
        return;
      }
      setBatchProgress({ done: 0, total: pendingGames.length });

      const { StockfishAnalysisEngine } = await import("@/analysis");
      const engine = new StockfishAnalysisEngine();
      await engine.init();
      let failures = 0;
      try {
        let done = 0;
        for (const game of pendingGames) {
          try {
            await analyzeAndSave(engine, game);
          } catch {
            failures += 1;
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
      if (failures > 0) {
        setBatchError(
          `${failures} game${failures === 1 ? "" : "s"} could not be scanned. Completed scans were saved. Try the remaining games again individually.`,
        );
        setBatchStatus("partial");
      } else {
        setBatchStatus("idle");
      }
    } catch (e) {
      setBatchError(
        errorMessage(
          e,
          "The scan stopped before it finished. Completed games are saved. Try the scan again.",
        ),
      );
      setBatchStatus("error");
    }
  }

  return (
    <PageShell
      eyebrow="Structured Game Review"
      title="Review Own Games"
      lede="Pick one of your games, think through its critical moments before seeing engine feedback, then schedule the mistakes for review."
      width="default"
    >
      <div className="flex flex-col gap-8">
        {suggestionsQuery.error && (
          <ErrorNotice
            error={suggestionsQuery.error}
            heading="Review guidance unavailable"
            message="Your games can still be reviewed, but Mainline could not load the explanation for this recommendation."
            onRetry={() => void suggestionsQuery.refetch()}
            retrying={suggestionsQuery.isFetching}
            retryLabel="Reload guidance"
          />
        )}
        {ownGamesRationale && (
          <MethodologyRationaleCard rationale={ownGamesRationale} />
        )}
        <ManualGameImport onImported={() => setPlatformOverride("manual")} />
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
                  role="group"
                  aria-label="Primary platform"
                  className="flex items-center gap-0.5 rounded-md border border-line bg-card p-0.5"
                >
                  {platforms.map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={selectedPlatform === p}
                      onClick={() => choosePlatform(p)}
                      className={cn(
                        "min-h-8 rounded px-2.5 py-1 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-paper",
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
              {selectedPlatform !== "manual" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sync.isPending}
                  onClick={() => sync.mutate()}
                >
                  {sync.isPending ? "Syncing…" : "Sync now"}
                </Button>
              )}
            </div>
          </div>

          {library?.primaryPlatform == null &&
            platforms.filter((platform) => platform !== "manual").length >
              1 && (
              <p className="text-graphite font-serif text-xs italic">
                Pick Lichess or Chess.com to set a primary rating platform.
                Manual PGN remains a library filter only.
              </p>
            )}

          {sync.error && (
            <ErrorNotice
              error={sync.error}
              heading="Games not synced"
              message="No new games were imported. Your existing library is unchanged."
              onRetry={() => sync.mutate()}
              retrying={sync.isPending}
              retryLabel="Try sync again"
            />
          )}

          {setPrimary.error && (
            <ErrorNotice
              error={setPrimary.error}
              heading="Platform not saved"
              message="The game list changed for this visit, but your default platform is unchanged. Choose it again to retry."
            />
          )}

          {selectedPlatform && games.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={batchStatus === "running" || analyzingGameId !== null}
                onClick={() => void runBatchAnalysis(games.length)}
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
              {batchStatus === "running" && (
                <span className="text-graphite font-mono text-xs">
                  {batchProgress
                    ? `Scanning ${batchProgress.done}/${batchProgress.total}…`
                    : "Starting scan…"}
                </span>
              )}
              {(batchStatus === "error" || batchStatus === "partial") &&
                batchError && (
                  <ErrorNotice
                    className="basis-full"
                    heading={
                      batchStatus === "partial"
                        ? "Some games were not scanned"
                        : "Game scan stopped"
                    }
                    message={batchError}
                    onRetry={() => void runBatchAnalysis(games.length)}
                    retryLabel="Scan remaining games"
                  />
                )}
            </div>
          )}

          {libraryQuery.isLoading ? (
            <StatusMessage tone="loading">Loading your games…</StatusMessage>
          ) : libraryQuery.error ? (
            <ErrorNotice
              error={libraryQuery.error}
              heading="Games unavailable"
              message="Mainline could not load your imported games. Try the list again."
              onRetry={() => void libraryQuery.refetch()}
              retrying={libraryQuery.isFetching}
              retryLabel="Reload games"
            />
          ) : games.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-graphite font-serif text-sm">
                  {selectedPlatform === "manual"
                    ? "No manual games imported yet. Paste one game or choose a PGN file above."
                    : platforms.length === 0
                      ? "No games imported yet. Connect a chess account, then sync to pull your most recent games."
                      : `No ${platformLabel(selectedPlatform)} games imported yet. Try syncing, or switch platform.`}
                </p>
                {selectedPlatform !== "manual" && (
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
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {games.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-col gap-3 rounded-lg border border-line bg-card px-4 py-3 shadow-sheet transition-colors hover:border-ink/20 sm:flex-row sm:items-center sm:justify-between"
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
                      <span>{formatGameDate(g.playedAt, g.platform)}</span>
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
                        "self-start shrink-0 sm:self-auto",
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
                      className="self-start shrink-0 sm:self-auto"
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
        {ratio && successBiasRationale && (
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
            <MethodologyRationaleCard rationale={successBiasRationale} />
          </section>
        )}
      </div>
    </PageShell>
  );
}
