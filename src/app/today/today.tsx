"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  if (item.activityType === "blunder_drill") {
    const n = p.dueItemRefs?.length ?? 0;
    return n > 0
      ? `Re-solve ${n} position${n === 1 ? "" : "s"} you blundered — find the better move.`
      : "Drill the blunders from your own games.";
  }
  if (item.activityType === "play_game" && typeof p.gameCount === "number") {
    return `Play ~${p.gameCount} game${p.gameCount === 1 ? "" : "s"} — sized to fit today's time.`;
  }
  if (p.track) {
    const bits: string[] = [];
    if (typeof p.targetRating === "number")
      bits.push(`target ~${p.targetRating}`);
    // Count is derived from the time budget (Goal 1) — the minutes are the hard cap.
    if (typeof p.count === "number") bits.push(`up to ~${p.count} puzzles`);
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

  const constraints = trpc.constraints.getCurrent.useQuery();
  const library = trpc.library.get.useQuery();
  const ownedBooks = library.data?.books.filter((b) => b.owned) ?? [];

  const saveConstraints = trpc.constraints.save.useMutation({
    onSuccess: () => {
      void utils.constraints.getCurrent.invalidate();
    },
  });

  const [timeInput, setTimeInput] = useState("");

  const minutes = constraints.data?.minutesPerDay;
  useEffect(() => {
    if (minutes != null) setTimeInput(String(minutes));
  }, [minutes]);

  const handleRegenerateWithTime = () => {
    const mins = parseInt(timeInput, 10);
    if (!constraints.data || isNaN(mins) || mins < 5 || mins > 1440) return;
    saveConstraints.mutate(
      { ...constraints.data, minutesPerDay: mins },
      {
        onSuccess: () => {
          generate.mutate();
        },
      },
    );
  };

  const timeBusy = saveConstraints.isPending || generate.isPending;

  const timeValid = (() => {
    const mins = parseInt(timeInput, 10);
    return !isNaN(mins) && mins >= 5 && mins <= 1440;
  })();

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
          <div className="flex flex-col gap-2">
            <label
              htmlFor="today-time-input"
              className="font-serif text-sm text-ink"
            >
              How much time do you have today?
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="today-time-input"
                type="number"
                min={5}
                max={1440}
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                disabled={timeBusy}
                className="w-20 font-mono text-sm"
              />
              <span className="text-graphite font-mono text-xs">min</span>
              <Button
                type="button"
                size="sm"
                disabled={timeBusy || timeInput === ""}
                onClick={handleRegenerateWithTime}
              >
                {timeBusy ? "Generating…" : "Regenerate"}
              </Button>
            </div>
            <p className="text-graphite font-mono text-[0.65rem]">
              5–1440 min (up to 24 hours)
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const due = dueReviews.data ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Time input — set how many minutes you have today, then regenerate. */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="today-time-input"
          className="font-serif text-sm text-ink"
        >
          How much time do you have today?
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="today-time-input"
            type="number"
            min={5}
            max={600}
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            disabled={timeBusy}
            className="w-20 font-mono text-sm"
          />
          <span className="text-graphite font-mono text-xs">min</span>
          <Button
            type="button"
            size="sm"
            variant={!timeValid && !timeBusy ? "outline" : "default"}
            disabled={timeBusy || !timeValid}
            onClick={handleRegenerateWithTime}
            className={cn(
              !timeValid &&
                !timeBusy &&
                "border-evergreen/30 text-evergreen/50",
            )}
          >
            {timeBusy ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
        <p className="text-graphite font-mono text-[0.65rem]">
          5–1440 min (up to 24 hours)
        </p>
      </div>

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
        const isBook = item.activityType === "book";
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
              {item.delivery === "internal" && item.url && (
                <Link
                  href={item.url}
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  Start training
                </Link>
              )}

              {item.externalUrl && item.delivery === "external" && (
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    variant:
                      item.activityType === "play_game" ? "default" : "outline",
                    size: "sm",
                  })}
                >
                  {item.externalLabel ?? "Open ↗"}
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
              {isBook && !done && !skipped ? (
                library.isLoading ? (
                  <p className="text-graphite font-mono text-xs pt-4 border-t border-line/80">
                    Loading owned books…
                  </p>
                ) : ownedBooks.length === 0 ? (
                  <div className="flex flex-col gap-2 border-t border-line/80 pt-4">
                    <p className="text-graphite font-serif text-sm">
                      You don&apos;t own any recommended books at your level
                      yet. Add books you own in the Library section or Settings.
                    </p>
                    {!done && !skipped && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          log.mutate({ programItemId: item.id, type: "skip" })
                        }
                        className="self-start"
                      >
                        Skip
                      </Button>
                    )}
                  </div>
                ) : (
                  <BookLogForm
                    item={item}
                    ownedBooks={ownedBooks}
                    onSuccess={() => {
                      void utils.library.get.invalidate();
                      void utils.program.getToday.invalidate();
                      void utils.tracker.dueReviews.invalidate();
                    }}
                    onSkip={() =>
                      log.mutate({ programItemId: item.id, type: "skip" })
                    }
                    busy={busy}
                  />
                )
              ) : (
                <div className="flex flex-wrap items-center gap-2 border-t border-line/80 pt-4">
                  {done || skipped ? (
                    <span className="text-graphite font-mono text-xs">
                      {done ? "✓ Logged" : "Skipped"}
                    </span>
                  ) : item.delivery === "internal" ? null : isPuzzle(item) ? ( // Internal activities are auto-logged in-app; only allow Skip here
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
              )}
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

interface OwnedBook {
  id: string;
  title: string;
  studyUnit: string;
  category: string;
}

function BookLogForm({
  item,
  ownedBooks,
  onSuccess,
  onSkip,
  busy,
}: {
  item: TodayItem;
  ownedBooks: OwnedBook[];
  onSuccess: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const [bookId, setBookId] = useState<string>(ownedBooks[0]?.id || "");
  const [unitCount, setUnitCount] = useState<string>("");
  const [successPct, setSuccessPct] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");
  const [cycle, setCycle] = useState<string>("");
  const [minutes, setMinutes] = useState<string>("");

  const log = trpc.library.logSession.useMutation({
    onSuccess: () => {
      onSuccess();
      setUnitCount("");
      setChapter("");
      setMinutes("");
      setCycle("");
      setSuccessPct("");
    },
  });

  const selectedBook = ownedBooks.find((b) => b.id === bookId) ?? ownedBooks[0];
  const unitLabel =
    selectedBook?.studyUnit === "games" ? "Games studied" : "Exercises done";
  const unitPlaceholder =
    selectedBook?.studyUnit === "games" ? "e.g. 3" : "e.g. 10";

  const onLog = () => {
    const resourceRefId = bookId || ownedBooks[0]?.id;
    if (!resourceRefId) return;
    const count = Number(unitCount);
    if (!unitCount || !Number.isInteger(count) || count <= 0) {
      alert("Please enter a valid positive number for exercises/games.");
      return;
    }
    const pct = successPct ? Number(successPct) : NaN;
    log.mutate({
      programItemId: item.id,
      resourceRefId,
      successRate: !isNaN(pct) && Number.isFinite(pct) ? pct / 100 : undefined,
      durationMin: minutes ? Number(minutes) : undefined,
      woodpeckerCycle: cycle ? Number(cycle) : undefined,
      position: {
        unitCount: count,
        chapter: chapter ? Number(chapter) : undefined,
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 border-t border-line/80 pt-4">
      <h3 className="font-serif text-sm font-semibold text-ink">
        Log your study session
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">Book</span>
          <select
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="border-input bg-paper-raised h-9 rounded-md border px-2 font-serif text-sm text-ink"
          >
            {ownedBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">
            {unitLabel} <span className="text-red-500">*</span>
          </span>
          <Input
            type="number"
            min={1}
            placeholder={unitPlaceholder}
            value={unitCount}
            onChange={(e) => setUnitCount(e.target.value)}
            required
            className="text-ink text-sm h-9"
          />
        </label>
        <label className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">
            Exercises solved (%) (optional)
          </span>
          <select
            value={successPct}
            onChange={(e) => setSuccessPct(e.target.value)}
            className="border-input bg-paper-raised h-9 rounded-md border px-2 font-serif text-sm text-ink"
          >
            <option value="">Optional (select...)</option>
            {["50", "60", "70", "75", "80", "85", "90", "95"].map((p) => (
              <option key={p} value={p}>
                {p}%
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">Chapter (optional)</span>
          <Input
            type="number"
            min={0}
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="text-ink text-sm h-9"
          />
        </label>
        <label className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">Minutes (optional)</span>
          <Input
            type="number"
            min={0}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="text-ink text-sm h-9"
          />
        </label>
        {selectedBook?.category === "tactics" && (
          <label className="flex flex-col gap-1.5 font-serif text-xs">
            <span className="eyebrow !text-[0.62rem]">
              Woodpecker cycle (optional)
            </span>
            <Input
              type="number"
              min={1}
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              className="text-ink text-sm h-9"
            />
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={log.isPending || busy}
          onClick={onLog}
          size="sm"
        >
          {log.isPending ? "Logging…" : "Log this session"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={log.isPending || busy}
          onClick={onSkip}
          size="sm"
        >
          Skip
        </Button>
      </div>

      {log.data?.feedback && (
        <p className="text-graphite border-l-2 border-evergreen/40 pl-3 font-serif text-sm leading-relaxed">
          {log.data.feedback.verdict === "too_easy" &&
            "That book looks a bit easy — consider a harder one."}
          {log.data.feedback.verdict === "too_hard" &&
            "That book looks tough right now — an easier one will help."}
          {log.data.feedback.verdict === "calibrated" &&
            "Nicely calibrated — that difficulty is right where learning is fastest."}
        </p>
      )}
    </div>
  );
}
