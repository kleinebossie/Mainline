"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { PageShell } from "@/components/app-shell";
import { Surface } from "@/components/ui/surface";
import { Button, buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { WhyButton } from "@/components/ui/why-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  type GuestConnection,
} from "@/lib/guest-session";

function resultChipClass(result: string | null | undefined): string {
  if (result === "win") return "bg-evergreen/10 text-evergreen border border-evergreen/30";
  if (result === "loss") return "bg-clay/10 text-clay border border-clay/30";
  return "bg-amber/10 text-amber border border-amber/30";
}

type BatchStatus = "idle" | "running" | "error" | "partial";

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
  const me = trpc.account.me.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const [guestConnections, setGuestConnections] = useState<GuestConnection[]>(
    [],
  );
  const [guestGames, setGuestGames] = useState<AnalysisGameItem[]>([]);
  const [isGuestSyncing, setIsGuestSyncing] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [resultFilter, setResultFilter] = useState<"all" | "win" | "loss">("all");

  const isGuest = me.data ? !me.data.authenticated : true;

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
    } else if (!isGuest) {
      sync.mutate();
    }
  };

  const ratio = suggestionsQuery.data?.ratio;
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
  const gamesForPlatform = allGames.filter(
    (g) => !selectedPlatform || g.platform === selectedPlatform,
  );
  const games = gamesForPlatform.filter((g) => {
    if (resultFilter === "win") return g.result === "win";
    if (resultFilter === "loss") return g.result === "loss";
    return true;
  });

  const choosePlatform = (p: string) => {
    setPlatformOverride(p);
    if (!isGuest && (p === "lichess" || p === "chesscom")) {
      setPrimary.mutate({ platform: p });
    }
  };

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
      title="Review your games"
      lede="Pick one of your games, think through its critical moments before seeing engine feedback, then schedule the mistakes for review."
      width="default"
    >
      <div className="flex flex-col gap-6">
        {!isGuest && suggestionsQuery.error && (
          <Notice
            tone="error"
            heading="Review guidance unavailable"
          >
            Your games can still be reviewed, but Mainline could not load the explanation for this recommendation.
          </Notice>
        )}

        {/* Import PGN Sheet */}
        <Sheet open={isImportOpen} onOpenChange={setIsImportOpen}>
          <SheetContent side="responsive" className="overflow-y-auto max-h-screen">
            <SheetHeader>
              <SheetTitle>Import games from PGN</SheetTitle>
              <SheetDescription>
                Upload a PGN file or paste raw moves to analyze games in your browser.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <ManualGameImport
                onImported={() => {
                  setIsImportOpen(false);
                  setPlatformOverride("manual");
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Header Actions & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-ink">
              Your games
            </h2>
            <p className="font-mono text-xs text-graphite mt-0.5">
              Select a game to review critical decisions and tactical mistakes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsImportOpen(true)}
            >
              Import PGN
            </Button>
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

        {/* Filter Tabs & Platform Switcher */}
        {allGames.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-sm border border-line bg-paper-raised p-0.5">
              {(["all", "win", "loss"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setResultFilter(tab)}
                  className={cn(
                    "px-3 py-1 rounded-xs font-mono text-xs transition-colors",
                    resultFilter === tab
                      ? "bg-ink text-paper font-semibold"
                      : "text-graphite hover:text-ink",
                  )}
                >
                  {tab === "all" ? "All" : tab === "win" ? "Wins" : "Losses"}
                </button>
              ))}
            </div>

            {platforms.length > 1 && (
              <div
                role="group"
                aria-label="Filter by platform"
                className="flex items-center gap-1 font-mono text-xs"
              >
                {platforms.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={selectedPlatform === p}
                    onClick={() => choosePlatform(p)}
                    className={cn(
                      "px-2.5 py-1 rounded-sm border transition-colors",
                      selectedPlatform === p
                        ? "border-evergreen bg-evergreen/10 text-evergreen font-semibold"
                        : "border-line text-graphite hover:text-ink",
                    )}
                  >
                    {platformLabel(p)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scanning Controls */}
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
              <span className="font-mono text-xs text-graphite">
                {batchProgress
                  ? `Scanning ${batchProgress.done}/${batchProgress.total}…`
                  : "Starting scan…"}
              </span>
            )}
            {(batchStatus === "error" || batchStatus === "partial") &&
              batchError && (
                <Notice
                  tone="error"
                  heading={
                    batchStatus === "partial"
                      ? "Some games were not scanned"
                      : "Game scan stopped"
                  }
                  className="basis-full"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>{batchError}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void runBatchAnalysis(games.length)}
                    >
                      Scan remaining games
                    </Button>
                  </div>
                </Notice>
              )}
          </div>
        )}

        {/* Empty State */}
        {platforms.length === 0 && games.length === 0 ? (
          <EmptyState
            message="Connect a chess account to sync your games automatically, or import a PGN to analyze games right now."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/connections"
                  className={buttonVariants({
                    variant: "default",
                    size: "sm",
                  })}
                >
                  Connect chess account
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportOpen(true)}
                >
                  Import PGN
                </Button>
              </div>
            }
          />
        ) : !isGuest && libraryQuery.isLoading ? (
          <Notice tone="loading">Loading your games…</Notice>
        ) : !isGuest && libraryQuery.error ? (
          <Notice
            tone="error"
            heading="Games unavailable"
          >
            Mainline could not load your imported games. Try loading them again.
          </Notice>
        ) : isGuestSyncing && games.length === 0 ? (
          <Notice tone="loading">Fetching your recent games…</Notice>
        ) : games.length === 0 ? (
          <EmptyState
            message={
              selectedPlatform === "manual"
                ? "No manual PGN games imported yet. Click Import PGN above to add games."
                : `No ${resultFilter === "win" ? "won" : resultFilter === "loss" ? "lost" : ""} games found for ${platformLabel(selectedPlatform)}.`
            }
            action={
              selectedPlatform === "manual" ? (
                <Button
                  size="sm"
                  onClick={() => setIsImportOpen(true)}
                >
                  Import PGN
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setResultFilter("all")}
                >
                  Show all games
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-2">
            {games.map((g) => (
              <Surface
                key={g.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:border-ink/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-xs px-1.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase",
                        resultChipClass(g.result),
                      )}
                    >
                      {resultLabel(g.result)}
                    </span>
                    <span className="truncate font-serif text-sm font-semibold text-ink">
                      {colorWord(g.color)} vs {g.opponent ?? "Opponent"}
                      {g.opponentRating != null && (
                        <span className="font-mono text-xs text-graphite">
                          {" "}
                          ({g.opponentRating})
                        </span>
                      )}
                    </span>
                    {g.analyzed && (
                      <span className="rounded-xs bg-evergreen/10 px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-evergreen">
                        Scanned
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 font-mono text-[0.7rem] text-graphite">
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
                      "self-start shrink-0 sm:self-auto bg-evergreen hover:bg-evergreen-bright text-paper",
                    )}
                  >
                    Review game
                  </Link>
                ) : (
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
              </Surface>
            ))}
          </div>
        )}

        {/* Win/Loss Balance Rationale */}
        {ratio && successBiasRationale && (
          <Surface className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="font-sans text-sm text-ink leading-relaxed">
              When picking games to review, aim for roughly{" "}
              <span className="font-mono font-semibold">
                {ratio.winPct}% wins
              </span>{" "}
              to{" "}
              <span className="font-mono font-semibold">
                {ratio.lossPct}% losses
              </span>
              : {ratio.focusDescription}.
            </p>
            <WhyButton
              rationaleText={successBiasRationale.value}
              evidenceGrade={successBiasRationale.evidenceGrade}
              evidenceTier={successBiasRationale.evidenceTier}
              citationKey={successBiasRationale.citationKey}
              citationSource={successBiasRationale.citationSource}
              confidence={successBiasRationale.confidence}
              soften={successBiasRationale.soften}
              label="Why this ratio?"
            />
          </Surface>
        )}
      </div>
    </PageShell>
  );
}
