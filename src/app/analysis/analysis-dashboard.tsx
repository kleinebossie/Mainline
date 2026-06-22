"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { PageShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { TransparencyCard } from "@/components/transparency-card";
import { AnalysisRunner } from "@/app/settings/analysis-runner";
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

  const [platformOverride, setPlatformOverride] = useState<string | null>(null);

  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const tilt = suggestionsQuery.data?.tilt;
  const successBiasRationale = suggestionsQuery.data?.rationale;

  const library = libraryQuery.data;
  const platforms = library?.platforms ?? [];
  const selectedPlatform = platformOverride ?? library?.effectivePlatform ?? null;
  const games = (library?.games ?? []).filter(
    (g) => !selectedPlatform || g.platform === selectedPlatform,
  );

  const choosePlatform = (p: string) => {
    setPlatformOverride(p);
    if (p === "lichess" || p === "chesscom") setPrimary.mutate({ platform: p });
  };

  return (
    <PageShell
      eyebrow="Structured Game Analysis"
      title="Analyse Own Games"
      lede="Pick one of your games and walk through a 5-step, science-backed review. We prioritise wins for pattern reinforcement and self-correction, avoiding ego-threat while training."
      width="default"
    >
      <div className="flex flex-col gap-8">
        {/* Tilt Cooldown Banner */}
        {tilt?.tilted && (
          <div className="relative overflow-hidden rounded-lg border border-grade-d/30 bg-ink p-6 text-paper shadow-sheet settle animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-grade-d font-mono text-2xl font-bold">!!</span>
              <div>
                <h3 className="font-serif text-lg font-semibold tracking-tight">
                  Tilt Prevention Cooldown Active
                </h3>
                <p className="text-paper/70 mt-1 text-sm">{tilt.reason}</p>
              </div>
            </div>
            {suggestionsQuery.data?.tilt_rationale && (
              <div className="mt-4 border-t border-paper/10 pt-4">
                <TransparencyCard
                  rationaleText={suggestionsQuery.data.tilt_rationale.value}
                  evidenceGrade={suggestionsQuery.data.tilt_rationale.grade}
                  evidenceTier={suggestionsQuery.data.tilt_rationale.tier}
                  citationKey={suggestionsQuery.data.tilt_rationale.citationKey}
                  confidence="medium"
                  soften={suggestionsQuery.data.tilt_rationale.soften}
                  flag={suggestionsQuery.data.tilt_rationale.flag}
                  className="bg-paper/5 border-none text-paper"
                />
              </div>
            )}
          </div>
        )}

        {/* Pick a game — the library, most recent first, filtered by primary platform. */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="eyebrow">Your games · pick one to analyse</h2>
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
              Pick a platform tab to set it as your primary — we&apos;ll default
              here next time.
            </p>
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
                    className={buttonVariants({ variant: "outline", size: "sm" })}
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
                          Analysed
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
                  <Link
                    href={`/analysis/${g.id}`}
                    className={cn(
                      buttonVariants({
                        size: "sm",
                        variant: g.analyzed ? "outline" : "default",
                      }),
                      "shrink-0",
                      tilt?.tilted && "pointer-events-none opacity-40",
                    )}
                  >
                    {g.analyzed ? "Review" : "Analyse"}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Suggested Games Section — methodology-curated picks, now named. */}
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Suggested for review</h2>
            {suggestions.length > 0 && (
              <span className="text-graphite font-mono text-xs">
                Target ratio: {suggestions.filter((s) => s.result === "win").length}
                /5 wins
              </span>
            )}
          </div>

          {suggestionsQuery.isLoading ? (
            <p className="text-graphite font-mono text-sm">
              Loading suggestions…
            </p>
          ) : suggestions.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-graphite font-serif text-sm">
                  No analysed games yet. Pick any game above to run your first
                  review — suggestions appear here once games are analysed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {suggestions.map((game) => (
                <div
                  key={game.gameId}
                  className={cn(
                    "flex flex-col justify-between gap-4 rounded-lg border p-5 shadow-sheet transition-all hover:translate-y-[-1px] sm:flex-row sm:items-center",
                    game.result === "win"
                      ? "border-l-4 border-l-grade-a bg-card"
                      : "border-l-4 border-l-grade-c bg-card/50",
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase",
                          resultChipClass(game.result),
                        )}
                      >
                        {resultLabel(game.result)}
                      </span>
                      {game.opponent && (
                        <span className="font-serif text-sm font-semibold text-ink">
                          vs {game.opponent}
                        </span>
                      )}
                      <span className="text-graphite font-mono text-xs">
                        {game.score > 200
                          ? "Active moments to review"
                          : "Standard review"}
                      </span>
                    </div>
                    <h3 className="font-serif text-base font-semibold text-ink">
                      {game.suggestedReason}
                    </h3>
                    <p className="text-graphite font-mono text-[0.7rem]">
                      {[
                        platformLabel(game.platform),
                        game.playedAt ? formatGameDate(game.playedAt) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <Link
                    href={`/analysis/${game.gameId}`}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "shrink-0",
                      tilt?.tilted && "pointer-events-none opacity-40",
                    )}
                  >
                    Start Analysis
                  </Link>
                </div>
              ))}
            </div>
          )}

          {successBiasRationale && (
            <TransparencyCard
              rationaleText={successBiasRationale.value}
              evidenceGrade={successBiasRationale.grade}
              evidenceTier={successBiasRationale.tier}
              citationKey={successBiasRationale.citationKey}
              confidence="medium"
              soften={successBiasRationale.soften}
              flag={successBiasRationale.flag}
              className="mt-2"
            />
          )}
        </section>

        {/* Stockfish WASM Runner Section */}
        <Card className="border-line/80">
          <CardContent className="pt-6">
            <AnalysisRunner />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
