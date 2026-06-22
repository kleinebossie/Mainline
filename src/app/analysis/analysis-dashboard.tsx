"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { PageShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TransparencyCard } from "@/components/transparency-card";
import { AnalysisRunner } from "@/app/settings/analysis-runner";
import { cn } from "@/lib/utils";

export function AnalysisDashboard() {
  const suggestionsQuery = trpc.analysis.suggestions.useQuery();

  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const tilt = suggestionsQuery.data?.tilt;
  const successBiasRationale = suggestionsQuery.data?.rationale;

  return (
    <PageShell
      eyebrow="Structured Game Analysis"
      title="Analyse Own Games"
      lede="Engage in a 5-step science-backed review of your games. We prioritize wins for pattern reinforcement and self-correction, avoiding ego-threat while training."
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
                <p className="text-paper/70 mt-1 text-sm">
                  {tilt.reason}
                </p>
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

        {/* Suggested Games Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Suggested Games for Review</h2>
            {suggestions.length > 0 && (
              <span className="text-graphite font-mono text-xs">
                Target ratio: {suggestions.filter(s => s.result === "win").length}/5 wins
              </span>
            )}
          </div>

          {suggestionsQuery.isLoading ? (
            <p className="text-graphite font-mono text-sm">Loading suggestions…</p>
          ) : suggestions.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-graphite font-serif text-sm">
                  No analysed games found. Run the game analysis tool below or import more games to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {suggestions.map((game) => (
                <div
                  key={game.gameId}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border p-5 shadow-sheet transition-all hover:translate-y-[-1px]",
                    game.result === "win"
                      ? "border-l-4 border-l-grade-a bg-card"
                      : "border-l-4 border-l-grade-c bg-card/50"
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase",
                          game.result === "win"
                            ? "bg-grade-a/10 text-grade-a"
                            : game.result === "loss"
                              ? "bg-grade-d/10 text-grade-d"
                              : "bg-grade-c/10 text-grade-c"
                        )}
                      >
                        {game.result}
                      </span>
                      <span className="text-graphite font-mono text-xs">
                        {game.score > 200 ? "Active moments to review" : "Standard review"}
                      </span>
                    </div>
                    <h3 className="font-serif text-base font-semibold text-ink">
                      {game.suggestedReason}
                    </h3>
                  </div>

                  <Link
                    href={`/analysis/${game.gameId}`}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      tilt?.tilted && "pointer-events-none opacity-40"
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
