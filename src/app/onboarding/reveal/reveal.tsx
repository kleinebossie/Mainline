"use client";

import Link from "next/link";

import { useEffect } from "react";

import { trpc } from "@/lib/trpc/react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeMark } from "@/components/evidence";
import { TransparencyCard } from "@/components/transparency-card";


type Grade = "A" | "B" | "C" | "D";
function asGrade(g: string): Grade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

// The reveal: the honest "what your games say vs. what you assumed" moment (VISION §2;
// the Dunning–Kruger guard, Seam 2). It contrasts the BEHAVIOURAL baseline (calibration +
// game-derived weakness signals) against the user's STATED goals — and where the data is
// thin it says so plainly rather than inventing a verdict (L3).
export function Reveal() {
  const state = trpc.assessment.state.useQuery();
  const signals = trpc.program.gameSignals.useQuery();
  const constraints = trpc.constraints.getCurrent.useQuery();
  // The reveal IS the interactive review (M12): step through your most-recent analysed game.
  const library = trpc.analysis.library.useQuery();
  const reviewGameId =
    library.data?.games.find((g) => g.analyzed)?.id ?? null;

  useEffect(() => {
    if (state.data?.completed && typeof window !== "undefined") {
      localStorage.setItem("mainline_reveal_seen", "true");
    }
  }, [state.data?.completed]);

  if (state.isLoading || !state.data) {
    return <p className="text-graphite font-mono text-sm">Loading…</p>;
  }

  const { estimate, completed, tracks } = state.data;

  if (!completed) {
    return (
      <Card className="settle">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            Calibration not done yet
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-graphite text-sm leading-relaxed font-serif">
            Finish the short tactical calibration and your starting picture
            appears here.
          </p>
          <Link href="/onboarding/calibration" className={buttonVariants()}>
            Go to calibration →
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Display-only axis for the per-dimension gauges (UI scale, not a methodology value).
  const minRating = 800;
  const maxRating = 2500;
  const range = maxRating - minRating;
  const clampPct = (r: number) =>
    Math.min(100, Math.max(0, ((r - minRating) / range) * 100));

  const goals = constraints.data?.goals ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* 1 — the measured, multi-dimensional baseline */}
      <Card gutter={asGrade(estimate.evidenceGrade)} className="settle">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            Your starting baseline
          </CardTitle>
          <p className="text-graphite font-mono text-sm mt-1">
            A behavioural read across {tracks.length} dimension
            {tracks.length === 1 ? "" : "s"} — uncertainty shrinks with more
            games and reviews.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            {tracks.map((t) => {
              const v = t.estimate.tacticalRatingEstimate;
              const u = t.estimate.uncertainty;
              const left = clampPct(v - u);
              const width = clampPct(v + u) - left;
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-2 rounded-md border p-4 bg-paper/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-serif text-base font-semibold text-ink">
                      {t.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                        ≈ {v} ± {u}
                      </span>
                      <GradeMark grade={t.estimate.evidenceGrade} />
                    </span>
                  </div>
                  <div className="relative h-3 w-full bg-ink/5 dark:bg-ink/20 rounded-sm border border-line overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 bg-evergreen/15 dark:bg-evergreen/35 border-x border-evergreen/30"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-evergreen"
                      style={{ left: `${clampPct(v)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-paper/60 rounded-md border border-dashed p-4">
            <div className="flex items-center gap-2 mb-3">
              <GradeMark grade={estimate.evidenceGrade} />
              {estimate.flag && (
                <span className="border-clay/40 bg-clay/10 text-clay rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider">
                  {estimate.flag}
                </span>
              )}
            </div>
            <p className="text-ink font-serif text-[0.95rem] leading-relaxed">
              These are rough calibration points, not verdicts. The fuller
              picture — your real leaks — comes from your games, below.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 2 — what the games actually reveal (Seam 3), honestly gated */}
      <Card className="settle [animation-delay:80ms]">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            What your games reveal
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {signals.isLoading ? (
            <p className="text-graphite font-mono text-sm">
              Reading your games…
            </p>
          ) : !signals.data || signals.data.gamesAnalysed === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-graphite text-sm leading-relaxed font-serif">
                No analysed games yet, so we won&apos;t guess at your
                weaknesses. Run the in-browser analysis and your real leaks
                (blunders, phase slips, time use) appear here.
              </p>
              <Link
                href="/settings#data"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Analyse my games →
              </Link>
            </div>
          ) : signals.data.signals.length === 0 ? (
            <p className="text-graphite text-sm leading-relaxed font-serif">
              Across {signals.data.gamesAnalysed} analysed game
              {signals.data.gamesAnalysed === 1 ? "" : "s"}, nothing yet rises
              clearly above the noise — we won&apos;t invent a weakness. As more
              games are analysed, real signals will surface.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-graphite text-sm leading-relaxed font-serif">
                From {signals.data.gamesAnalysed} analysed game
                {signals.data.gamesAnalysed === 1 ? "" : "s"}:
              </p>
              {signals.data.signals.map((s) => (
                <div key={s.dimension} className="flex flex-col gap-2">
                  <p className="font-serif text-base font-semibold text-ink">
                    {s.dimensionLabel}
                  </p>
                  <TransparencyCard
                    rationaleText={s.rationaleText}
                    evidenceGrade={s.evidenceGrade}
                    evidenceTier={s.evidenceTier}
                    citationKey={s.citationKey}
                    citationSource={s.citationSource}
                    confidence={s.confidence}
                    soften={s.soften}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2.5 — see it for yourself: the interactive review of a real game (M12) */}
      <Card className="settle [animation-delay:120ms]">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            Step through one of your games
          </CardTitle>
          <p className="text-graphite font-mono text-sm mt-1">
            The honest picture isn&apos;t a number — it&apos;s the moment it
            turned. Walk the turning points and find better moves for your mistakes.
          </p>
        </CardHeader>
        <CardContent>
          {reviewGameId ? (
            <div className="flex flex-col gap-3">
              <p className="text-graphite text-sm leading-relaxed font-serif">
                You have games ready for review. Walk through the turning points, identify your errors, and schedule them as personal drills.
              </p>
              <div>
                <Link
                  href={`/analysis/${reviewGameId}`}
                  className={buttonVariants()}
                >
                  Review Game →
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-graphite text-sm leading-relaxed font-serif">
              Scan a game first — then you&apos;ll be able to review it, walk the turning points, and drill your mistakes.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3 — what you said you want, and how we reconcile it */}
      <Card className="settle [animation-delay:160ms]">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            What you told us you want
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {goals.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {goals.map((g, i) => (
                <li
                  key={`${g.kind}-${i}`}
                  className="border-line bg-paper/40 text-ink rounded-full border px-3 py-1 font-mono text-xs"
                >
                  {g.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-graphite text-sm leading-relaxed font-serif">
              You haven&apos;t set goals yet — you can add them any time in
              Settings.
            </p>
          )}
          <p className="text-graphite text-sm leading-relaxed font-serif border-t border-line/80 pt-4">
            You stay in control. Where your games and your goals point the same
            way, we lean in hard. Where they disagree, we trust your{" "}
            <span className="text-ink font-medium">games</span> for the
            diagnosis and your <span className="text-ink font-medium">goals</span>{" "}
            for what to emphasise — and we always show the evidence.
          </p>
          <div className="flex flex-wrap items-center gap-3 border-t border-line/80 pt-5">
            <Link href="/today" className={buttonVariants()}>
              Build my first session →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
