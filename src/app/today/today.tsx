"use client";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransparencyCard } from "@/components/transparency-card";
import type { TodayItem } from "@/server/program";
import { cn } from "@/lib/utils";

// The "Today" screen (BUILD.md §7.6, M6/M7). Renders the generated daily session: each item
// is an external-resource activity with its difficulty params and a TransparencyCard
// carrying the graded "why" (L3). Honest framing up top (process goal + expectations,
// Seam 8). M7: logging an outcome (solved/struggled/done) feeds the adaptation loop — a miss
// is scheduled to come back spaced, and "Regenerate" rebuilds the session from the new state.

type Grade = "A" | "B" | "C" | "D";
function asGrade(g: string): Grade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

function itemDetails(item: TodayItem): string {
  const p = item.params;
  if (item.activityType === "spaced_review") {
    const n = p.dueItemRefs?.length ?? 0;
    return n > 0
      ? `Re-solve your due misses: ${p.dueItemRefs!.join(", ")}`
      : "Spaced review of your earlier misses.";
  }
  if (p.track) {
    const bits: string[] = [];
    if (typeof p.targetRating === "number")
      bits.push(`target ~${p.targetRating}`);
    if (typeof p.count === "number") bits.push(`${p.count} puzzles`);
    if (p.structure) bits.push(p.structure);
    if (p.workedExample) bits.push("worked example first");
    return bits.join(" · ");
  }
  return "Do this away from the app, then log it below.";
}

function isPuzzle(item: TodayItem): boolean {
  return item.params.track !== null && item.activityType !== "spaced_review";
}

export function Today() {
  const utils = trpc.useUtils();
  const today = trpc.program.getToday.useQuery();
  const dueReviews = trpc.tracker.dueReviews.useQuery();
  const generate = trpc.program.generate.useMutation({
    onSuccess: () => {
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
    },
  });
  const log = trpc.tracker.logOutcome.useMutation({
    onSuccess: () => {
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
    },
  });

  if (today.isLoading) {
    return (
      <p className="text-graphite font-mono text-sm">Loading your session…</p>
    );
  }

  const program = today.data;
  const pendingItemId = log.isPending
    ? log.variables?.programItemId
    : undefined;

  if (!program) {
    return (
      <Card gutter="A">
        <CardHeader>
          <CardTitle>No session yet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-graphite text-sm leading-relaxed">
            Build your first training session from your calibration, your games,
            and the time you have. You can regenerate it any time.
          </p>
          <Button
            type="button"
            disabled={generate.isPending}
            onClick={() => generate.mutate()}
            className="self-start"
          >
            {generate.isPending ? "Generating…" : "Generate today's session"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const due = dueReviews.data ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Honest framing: a process goal and realistic expectations, never a rating promise. */}
      <div className="bg-card focus-card rounded-lg border p-5 shadow-sheet settle">
        <p className="eyebrow">Today&apos;s focus</p>
        <p className="mt-2 font-serif text-lg leading-snug">
          {program.honesty.processGoal}
        </p>
        <p className="text-graphite mt-2 text-sm leading-relaxed">
          {program.honesty.expectations}
        </p>
        {due > 0 && (
          <p className="text-evergreen mt-3 font-mono text-xs">
            {due} review{due === 1 ? "" : "s"} due — regenerate to pull them
            into your session.
          </p>
        )}
      </div>

      {program.items.map((item, index) => {
        const done = item.status === "done";
        const skipped = item.status === "skipped";
        const busy = pendingItemId === item.id;
        return (
          <Card
            key={item.id}
            gutter={asGrade(item.evidenceGrade)}
            provisional={item.soften}
            className={cn("settle", done ? "opacity-65" : undefined)}
            style={{ animationDelay: `${(index + 1) * 80}ms` }}
          >
            <CardHeader className="pb-4">
              <div className="flex items-baseline justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  {item.activityType === "spaced_review" && (
                    <span
                      className="text-evergreen font-mono text-base shrink-0 select-none"
                      aria-hidden="true"
                      title="Spaced review item"
                    >
                      ⟳
                    </span>
                  )}
                  {item.label}
                </CardTitle>
                {item.estMinutes != null && (
                  <span className="text-graphite shrink-0 font-mono text-sm tabular-nums">
                    ~{item.estMinutes} min
                  </span>
                )}
              </div>
              <p className="text-graphite mt-1 font-mono text-xs">
                {itemDetails(item)}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {item.dimensionLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.dimensionLabels.map((d) => (
                    <span
                      key={d}
                      className="border-line text-graphite rounded-sm border bg-paper px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wide"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}

              {item.externalUrl && (
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Open on Lichess ↗
                </a>
              )}

              <TransparencyCard
                rationaleText={item.rationaleText}
                evidenceGrade={item.evidenceGrade}
                evidenceTier={item.evidenceTier}
                citationKey={item.citationKey}
                citationSource={item.citationSource}
                confidence={item.confidence}
                soften={item.soften}
              />

              {/* M7 — log the outcome; a miss is scheduled to return spaced. */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line/80 pt-4">
                {done || skipped ? (
                  <span className="text-graphite font-mono text-xs">
                    {done ? "✓ Logged" : "Skipped"}
                  </span>
                ) : isPuzzle(item) ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        log.mutate({
                          programItemId: item.id,
                          type: "puzzle_attempt",
                          correct: true,
                        })
                      }
                    >
                      Solved them
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        log.mutate({
                          programItemId: item.id,
                          type: "puzzle_attempt",
                          correct: false,
                        })
                      }
                    >
                      Struggled
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      log.mutate({
                        programItemId: item.id,
                        type: "drill_done",
                      })
                    }
                  >
                    Mark done
                  </Button>
                )}
                {!done && !skipped && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      log.mutate({ programItemId: item.id, type: "skip" })
                    }
                  >
                    Skip
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {log.data && log.data.scheduledReviews > 0 && (
        <p className="text-graphite border-l-2 border-evergreen/40 pl-3 font-mono text-xs leading-relaxed">
          Logged — {log.data.scheduledReviews} item
          {log.data.scheduledReviews === 1 ? "" : "s"} queued to come back
          spaced over the next days.
        </p>
      )}

      {/* Seam-9 engagement nudge: a forgiving, capped streak / genuine milestone — never a
          rating promise. Copy + grade come from the methodology. */}
      {log.data?.rewardEvents.map((e, i) => (
        <p
          key={`${e.type}-${i}`}
          className="text-ink border-l-2 border-evergreen/40 pl-3 font-serif text-sm leading-relaxed"
        >
          {e.payload.streakDay != null && (
            <span className="text-evergreen font-mono text-xs">
              Day {e.payload.streakDay} ·{" "}
            </span>
          )}
          {e.text}
        </p>
      ))}

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-line/80 pt-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? "Regenerating…" : "↻ Regenerate session"}
        </Button>
        <span className="text-graphite font-mono text-xs">
          Built from your data on {program.createdAt.toLocaleDateString()} ·{" "}
          {program.methodologyVersion}
        </span>
      </div>
    </div>
  );
}
