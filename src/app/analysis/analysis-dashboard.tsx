"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { DEFAULT_ANALYSIS_DEPTH } from "@/analysis/worker-config";
import {
  getGuestSession,
  hasGuestData,
  type GuestConnection,
} from "@/lib/guest-session";

function resultChipClass(result: string | null | undefined): string {
  if (result === "win") return "bg-grade-a/10 text-grade-a";
  if (result === "loss") return "bg-grade-d/10 text-grade-d";
  return "bg-grade-c/10 text-grade-c";
}

type BatchStatus = "idle" | "running" | "error" | "partial";

// The client-side Stockfish adapter type (imported lazily at call time, typed here).
type AnalysisEngine = import("@/analysis").StockfishAnalysisEngine;

interface AnalysisGameItem {
  id: string;
  platform: string;
  playedAt: string | null;
  color: string | null;
  result: string | null;
  timeControl: string | null;
  opening: string | null;
  opponent: string | null;
  event: string | null;
  opponentRating: number | null;
  you: string | null;
  userRating?: number | null;
  analyzed: boolean;
  pgn: string;
  rawFeatures?: unknown;
}

export function AnalysisDashboard() {
  const utils = trpc.useUtils();
  const [isGuest, setIsGuest] = useState(false);
  const [guestConnections, setGuestConnections] = useState<GuestConnection[]>(
    [],
  );
  const [guestGames, setGuestGames] = useState<AnalysisGameItem[]>([]);
  const [isGuestSyncing, setIsGuestSyncing] = useState(false);

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
  const fetchGuestGames = trpc.analysis.fetchGuestGames.useMutation();

  const [platformOverride, setPlatformOverride] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus>("idle");
  const [batchProgress, setBatchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  // The id of the single game whose engine analysis is running (per-row "Engine analysis").
  const [analyzingGameId, setAnalyzingGameId] = useState<string | null>(null);

  const syncGuestAccounts = useCallback(
    async (conns: GuestConnection[]) => {
      if (conns.length === 0) return;
      setIsGuestSyncing(true);
      try {
        const allFetched: AnalysisGameItem[] = [];
        for (const conn of conns) {
          const fetched = await fetchGuestGames.mutateAsync({
            platform: conn.platform,
            username: conn.externalUsername,
          });
          allFetched.push(...fetched);
        }
        setGuestGames((prev) => {
          const map = new Map<string, AnalysisGameItem>();
          for (const g of allFetched) map.set(g.id, g);
          for (const g of prev) {
            if (map.has(g.id)) {
              map.set(g.id, {
                ...map.get(g.id)!,
                analyzed: g.analyzed,
                rawFeatures: g.rawFeatures,
              });
            } else {
              map.set(g.id, g);
            }
          }
          const merged = Array.from(map.values());
          try {
            localStorage.setItem(
              "mainline_guest_games",
              JSON.stringify(merged),
            );
          } catch {}
          return merged;
        });
      } catch {
        // Ignored
      } finally {
        setIsGuestSyncing(false);
      }
    },
    [fetchGuestGames],
  );

  const syncGuestAccountsRef = useRef(syncGuestAccounts);
  syncGuestAccountsRef.current = syncGuestAccounts;

  useEffect(() => {
    const session = getGuestSession();
    const conns = session.connections ?? [];
    setGuestConnections(conns);
    setIsGuest(hasGuestData());
    let initialGuestGames: AnalysisGameItem[] = [];
    try {
      const cached = localStorage.getItem("mainline_guest_games");
      if (cached) {
        initialGuestGames = JSON.parse(cached);
        setGuestGames(initialGuestGames);
      }
    } catch {}

    if (conns.length > 0 && initialGuestGames.length === 0) {
      void syncGuestAccountsRef.current(conns);
    }
  }, []);

  const handleSync = async () => {
    if (guestConnections.length > 0) {
      await syncGuestAccounts(guestConnections);
    } else {
      sync.mutate();
    }
  };

  const ratio = suggestionsQuery.data?.ratio;
  const ownGamesRationale = suggestionsQuery.data?.ownGamesRationale;
  const successBiasRationale = suggestionsQuery.data?.successBiasRationale;

  const library = libraryQuery.data;
  const platforms = Array.from(
    new Set([
      ...(library?.platforms ?? []),
      ...guestConnections.map((c) => c.platform),
      ...(guestGames.some((g) => g.platform === "manual") ? ["manual"] : []),
    ]),
  );
  const selectedPlatform =
    platformOverride ??
    library?.effectivePlatform ??
    guestConnections[0]?.platform ??
    platforms[0] ??
    null;

  const allGames = [...(library?.games ?? []), ...guestGames];
  const games = allGames.filter(
    (g) => !selectedPlatform || g.platform === selectedPlatform,
  );

  const choosePlatform = (p: string) => {
    setPlatformOverride(p);
    if (!isGuest && (p === "lichess" || p === "chesscom")) {
      setPrimary.mutate({ platform: p });
    }
  };

  // Analyse one game with an already-initialised engine and persist its raw features.
  // Shared by the batch runner and the per-game "Engine analysis" button.
  async function analyzeAndSave(
    engine: AnalysisEngine,
    game: { id: string; pgn: string; color: string | null },
  ) {
    const features = await engine.analyzeGame(
      game.pgn,
      { depth: DEFAULT_ANALYSIS_DEPTH },
      { userColor: game.color === "b" ? "b" : "w" },
    );
    if (!isGuest) {
      await saveAnalysis.mutateAsync({
        gameId: game.id,
        engineVersion: engine.engineVersion,
        depth: DEFAULT_ANALYSIS_DEPTH,
        rawFeatures: features,
      });
    } else {
      setGuestGames((prev) => {
        const updated = prev.map((g) =>
          g.id === game.id
            ? { ...g, analyzed: true, rawFeatures: features }
            : g,
        );
        try {
          localStorage.setItem("mainline_guest_games", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  }

  // Per-game engine analysis: turn Stockfish on for ONE game (the row's "Engine analysis"
  // button). Once its raw features are saved, the row flips to the "Analyze" review entry.
  async function runSingleAnalysis(gameId: string) {
    setAnalyzingGameId(gameId);
    setBatchError(null);
    try {
      const targetGame = games.find((g) => g.id === gameId);
      if (!targetGame?.pgn) {
        throw new Error("Game PGN is not available.");
      }
      const { StockfishAnalysisEngine } = await import("@/analysis");
      const engine = new StockfishAnalysisEngine();
      await engine.init();
      try {
        await analyzeAndSave(engine, targetGame);
      } finally {
        engine.dispose();
      }
      if (!isGuest) {
        await Promise.all([
          utils.analysis.library.invalidate(),
          utils.analysis.summary.invalidate(),
        ]);
      }
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
    setBatchStatus("running");
    setBatchError(null);
    try {
      const targetGames = games.filter((g) => !g.analyzed).slice(0, limit);
      if (targetGames.length === 0) {
        setBatchStatus("idle");
        return;
      }
      setBatchProgress({ done: 0, total: targetGames.length });

      const { StockfishAnalysisEngine } = await import("@/analysis");
      const engine = new StockfishAnalysisEngine();
      await engine.init();
      let failures = 0;
      try {
        let done = 0;
        for (const game of targetGames) {
          try {
            await analyzeAndSave(engine, game);
          } catch {
            failures += 1;
            continue;
          }
          done += 1;
          setBatchProgress({ done, total: targetGames.length });
        }
      } finally {
        engine.dispose();
      }

      if (!isGuest) {
        await Promise.all([
          utils.analysis.library.invalidate(),
          utils.analysis.summary.invalidate(),
        ]);
      }
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
      eyebrow="Structured game review"
      title="Review your games"
      lede="Pick one of your games, think through its critical moments before seeing engine feedback, then schedule the mistakes for review."
      width="default"
    >
      <div className="flex flex-col gap-8">
        {!isGuest && suggestionsQuery.error && (
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
        {/* Pick a game: the library, most recent first, filtered by primary platform. */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="eyebrow">Your games · pick one to review</h2>
              <p className="text-graphite font-serif text-xs">
                Most recent first.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                  disabled={sync.isPending || isGuestSyncing}
                  onClick={() => void handleSync()}
                >
                  {sync.isPending || isGuestSyncing ? "Syncing…" : "Sync now"}
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

          {!isGuest && sync.error && (
            <ErrorNotice
              error={sync.error}
              heading="Games not synced"
              message="No new games were imported. Your existing library is unchanged."
              onRetry={() => sync.mutate()}
              retrying={sync.isPending}
              retryLabel="Try sync again"
            />
          )}

          {!isGuest && setPrimary.error && (
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

          {platforms.length === 0 && games.length === 0 ? (
            <Card className="border-line bg-card shadow-sheet">
              <CardContent className="flex flex-col gap-5 py-6">
                <div className="flex flex-col gap-2">
                  <p className="eyebrow text-evergreen">
                    Automatic game imports
                  </p>
                  <h3 className="font-serif text-xl font-semibold text-ink">
                    Connect a chess account to sync your games automatically.
                  </h3>
                  <p className="font-serif text-sm text-graphite leading-relaxed max-w-xl">
                    Link your Lichess or Chess.com account to automatically
                    import your games, scan for tactical mistakes, and build
                    your daily blunder drills.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-line/80 pt-4">
                  <Link
                    href="/connections"
                    className={buttonVariants({
                      variant: "default",
                      size: "sm",
                    })}
                  >
                    Connect chess account →
                  </Link>
                  <Link
                    href="/signin"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Sign in
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : !isGuest && libraryQuery.isLoading ? (
            <StatusMessage tone="loading">Loading your games…</StatusMessage>
          ) : !isGuest && libraryQuery.error ? (
            <ErrorNotice
              error={libraryQuery.error}
              heading="Games unavailable"
              message="Mainline could not load your imported games. Try the list again."
              onRetry={() => void libraryQuery.refetch()}
              retrying={libraryQuery.isFetching}
              retryLabel="Reload games"
            />
          ) : isGuestSyncing && games.length === 0 ? (
            <StatusMessage tone="loading">
              Fetching your recent games…
            </StatusMessage>
          ) : games.length === 0 ? (
            <Card gutter="B">
              <CardContent className="flex flex-col gap-6 py-6">
                <div className="flex flex-col gap-2 text-center">
                  <h3 className="font-serif text-xl font-bold text-ink">
                    Start converting your real games into personal drills
                  </h3>
                  <p className="text-graphite font-serif text-sm max-w-xl mx-auto leading-relaxed">
                    {selectedPlatform === "manual"
                      ? "Import PGN files or paste raw game text above. Mainline scans your moves for critical blunders and queues them for interactive practice."
                      : platforms.length === 0
                        ? "Connect your Lichess or Chess.com username. Mainline automatically pulls your recent games, identifies tactical mistakes, and generates custom training blocks."
                        : `No ${platformLabel(selectedPlatform)} games imported yet. Click sync below to fetch your latest games or manage connected accounts.`}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 border-t border-line/80 pt-5">
                  <div className="flex flex-col gap-1 p-3 rounded-md bg-paper/60 border border-line">
                    <span className="eyebrow !text-[0.6rem]">Step 1</span>
                    <span className="font-serif text-sm font-semibold text-ink">
                      Link account or PGN
                    </span>
                    <span className="text-graphite font-serif text-xs">
                      Add your username or upload raw game text.
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-md bg-paper/60 border border-line">
                    <span className="eyebrow !text-[0.6rem]">Step 2</span>
                    <span className="font-serif text-sm font-semibold text-ink">
                      Run engine scan
                    </span>
                    <span className="text-graphite font-serif text-xs">
                      Client Stockfish finds critical turning points.
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-md bg-paper/60 border border-line">
                    <span className="eyebrow !text-[0.6rem]">Step 3</span>
                    <span className="font-serif text-sm font-semibold text-ink">
                      Train your mistakes
                    </span>
                    <span className="text-graphite font-serif text-xs">
                      Mistakes schedule into daily training blocks.
                    </span>
                  </div>
                </div>

                {selectedPlatform !== "manual" && (
                  <div className="flex flex-wrap justify-center gap-3 border-t border-line/80 pt-4">
                    <Button
                      size="sm"
                      disabled={sync.isPending || isGuestSyncing}
                      onClick={() => void handleSync()}
                    >
                      {sync.isPending || isGuestSyncing
                        ? "Syncing games…"
                        : "Sync games now"}
                    </Button>
                    <Link
                      href="/connections"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {platforms.length === 0
                        ? "Connect Lichess or Chess.com"
                        : "Manage connected accounts"}
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
                      Review game
                    </Link>
                  ) : (
                    // Not scanned yet — turn the engine on for just this game. Neutral
                    // outline, so it never looks like the same control as "Review game".
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

        {/* Honest one-line recommendation (Seam 4.1 §Step5): no curated list, since the
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
