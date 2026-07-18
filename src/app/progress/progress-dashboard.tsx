"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import type { AppRouter } from "@/server/routers/_app";
import type { inferRouterOutputs } from "@trpc/server";

type ProgressSummary = inferRouterOutputs<AppRouter>["progress"]["summary"];

type Evidence = {
  text: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource: string | null;
  soften: boolean;
};

const GRADE_CLASS: Record<string, string> = {
  A: "border-grade-a/50 bg-grade-a/10 text-ink",
  B: "border-grade-b/50 bg-grade-b/10 text-ink",
  C: "border-grade-c/50 bg-grade-c/10 text-ink",
  D: "border-grade-d/50 bg-grade-d/10 text-ink",
};

function EvidenceNote({
  title,
  evidence,
  className,
}: {
  title: string;
  evidence: Evidence;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "rounded-md border p-3.5",
        GRADE_CLASS[evidence.evidenceGrade] ?? "border-line bg-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em]">
          {title}
        </p>
        <span className="rounded-sm border border-ink/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase">
          Grade {evidence.evidenceGrade} / Tier {evidence.evidenceTier}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-graphite">
        {evidence.text}
      </p>
      <p className="mt-2 font-mono text-[0.68rem] text-graphite">
        {evidence.citationSource ?? evidence.citationKey}
      </p>
    </aside>
  );
}

function RecoveryNote({
  event,
  pending,
  failed,
  onClear,
}: {
  event: ProgressSummary["consistency"]["recoveryEvents"][number];
  pending: boolean;
  failed: boolean;
  onClear: () => void;
}) {
  return (
    <aside
      aria-labelledby={`recovery-note-${event.id ?? "current"}`}
      className="relative overflow-hidden rounded-lg border border-amber/45 bg-amber/10 p-4 shadow-sheet sm:p-5"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-amber" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl pl-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              id={`recovery-note-${event.id ?? "current"}`}
              className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink"
            >
              Return to the board
            </p>
            <span className="rounded-sm border border-ink/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-ink">
              Grade {event.evidenceGrade} / Tier {event.evidenceTier}
            </span>
          </div>
          <p className="mt-2 font-serif text-sm leading-relaxed text-graphite">
            {event.text}
          </p>
          <p className="mt-2 font-mono text-[0.68rem] text-graphite">
            {event.citationSource ?? event.citationKey}
          </p>
          {failed && (
            <p role="alert" className="mt-2 text-sm text-clay">
              The note is still here. Try clearing it again.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={pending || event.id === null}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-sm border border-ink/15 bg-card px-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "Clearing note..."
            : failed
              ? "Try clearing again"
              : "Clear note"}
        </button>
      </div>
    </aside>
  );
}

function StatTile({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg border bg-card p-4 shadow-sheet", className)}
    >
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-ink">
        {value}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-graphite">{detail}</p>
    </div>
  );
}

function ConsistencyGrid({
  grid,
}: {
  grid: { date: Date; active: boolean }[];
}) {
  return (
    <div
      className="grid grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto pb-1"
      role="img"
      aria-label="Consistency grid over the methodology-owned practice window"
    >
      {grid.map((cell) => (
        <span
          key={cell.date.toISOString()}
          title={`${cell.date.toLocaleDateString()} - ${cell.active ? "trained" : "no logged practice"}`}
          className={cn(
            "h-3 w-3 shrink-0 rounded-[2px]",
            cell.active ? "bg-evergreen" : "bg-ink/10",
          )}
        />
      ))}
    </div>
  );
}

function ReviewTypeList({ itemTypes }: { itemTypes: Record<string, number> }) {
  const entries = Object.entries(itemTypes);
  if (entries.length === 0) {
    return (
      <p className="text-sm text-graphite">No reviews are due right now.</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {entries.map(([type, count]) => (
        <li
          key={type}
          className="rounded-sm border border-line bg-paper/70 px-2 py-1 font-mono text-[0.7rem] text-graphite"
        >
          {type.replace(/_/g, " ")} · {count}
        </li>
      ))}
    </ul>
  );
}

function SkillSignals({
  skills,
}: {
  skills: {
    dimension: string;
    label: string;
    estimate: number;
    uncertainty: number;
    sampleSize: number;
  }[];
}) {
  if (skills.length === 0) {
    return (
      <StatusMessage tone="neutral">
        Complete in-app training blocks to build skill estimates. Empty is
        better than pretending we know.
      </StatusMessage>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {skills.map((skill) => {
        const pct = Math.round(skill.estimate * 100);
        const band = Math.round(skill.uncertainty * 100);
        return (
          <div
            key={skill.dimension}
            className="rounded-lg border bg-card p-4 shadow-sheet"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-serif text-base font-semibold">
                {skill.label}
              </p>
              <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                {pct}% ± {band}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-sm bg-ink/10">
              <div
                className="h-2 rounded-sm bg-evergreen"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite">
              {skill.sampleSize} logged interaction
              {skill.sampleSize === 1 ? "" : "s"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function RatingSignal({
  rating,
  className,
}: {
  rating: ProgressSummary["rating"];
  className?: string;
}) {
  if (!rating) {
    return (
      <StatusMessage
        tone="neutral"
        className={className}
        heading="No rating data"
      >
        No rating data available. Set your primary platform and choose time
        controls in Settings to start tracking rating signals.
      </StatusMessage>
    );
  }

  const showPlatformSetup = !rating.platformSet;
  const showFormatsSetup = rating.platformSet && !rating.formatsSet;

  return (
    <div
      className={cn("rounded-lg border bg-card p-4 shadow-sheet", className)}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/60 pb-4">
        <div>
          <p className="eyebrow">Rating noise</p>
          <p className="mt-1 font-serif text-lg font-semibold">
            {rating.platformLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPlatformSetup && (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 rounded-sm border border-line bg-paper/70 px-2.5 py-1 font-mono text-[0.7rem] uppercase text-graphite transition-colors hover:border-ink/20 hover:bg-paper"
            >
              Set your platform →
            </Link>
          )}
          {showFormatsSetup && (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 rounded-sm border border-line bg-paper/70 px-2.5 py-1 font-mono text-[0.7rem] uppercase text-graphite transition-colors hover:border-ink/20 hover:bg-paper"
            >
              Choose time controls →
            </Link>
          )}
        </div>
      </div>

      {/* Format rows */}
      {rating.formats.length === 0 ? (
        <p className="mt-4 text-sm text-graphite">
          No time controls selected. Choose formats in Settings to see rating
          signals.
        </p>
      ) : (
        <div>
          {rating.formats.map((format, index) => {
            const lower = Math.round(format.latest.range.lower);
            const upper = Math.round(format.latest.range.upper);
            const midpoint = Math.round((lower + upper) / 2);
            const ciWidth = upper - lower;
            // Band width: ~0.5px per point of uncertainty, clamped to 24–160px
            const bandWidth = Math.min(Math.max(ciWidth * 0.5, 24), 160);

            const baselineText = format.baseline
              ? `${Math.round(format.baseline.range.lower)} – ${Math.round(format.baseline.range.upper)}`
              : null;

            const progressLabel = format.realProgress
              ? "Signal cleared old range"
              : format.plateau.reason === "plateau"
                ? "Plateau: no recent improvement"
                : format.plateau.reason === "new_high"
                  ? "New peak: range shifted up"
                  : "Calibrating: need more games";

            return (
              <div
                key={format.format}
                className={cn(index > 0 && "border-t border-line/40", "py-4")}
              >
                {/* Row 1: label, rating + rd, CI */}
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {/* Time control */}
                  <span className="font-serif text-base font-semibold min-w-[4.5rem]">
                    {format.label}
                  </span>

                  {/* Rating estimate */}
                  <span className="font-mono text-xl font-semibold tabular-nums text-ink">
                    ~{midpoint}
                  </span>
                  <span className="font-mono text-[0.65rem] text-graphite tabular-nums">
                    ± {format.latest.rd} RD
                  </span>

                  {/* CI band */}
                  <div className="hidden items-center gap-2 sm:flex">
                    <div className="relative flex items-center">
                      <div
                        className="h-[4px] rounded-full bg-graphite/25"
                        style={{ width: `${bandWidth}px` }}
                      />
                      <div className="absolute left-1/2 top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/60" />
                    </div>
                  </div>

                  {/* CI range with label */}
                  <span className="font-mono text-[0.7rem] tabular-nums">
                    <span className="text-graphite/60">95% CI </span>
                    <span className="text-graphite">
                      {lower} – {upper}
                    </span>
                  </span>

                  {/* Baseline with label — right side on desktop */}
                  <span className="ml-auto hidden font-mono text-[0.68rem] tabular-nums sm:inline">
                    {baselineText ? (
                      <>
                        <span className="text-graphite/60">baseline </span>
                        <span className="text-graphite/75">{baselineText}</span>
                      </>
                    ) : (
                      <span className="text-graphite/45">no baseline yet</span>
                    )}
                  </span>
                </div>

                {/* Row 2: baseline (mobile) + progress status */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {/* Baseline — mobile only (hidden on sm+) */}
                  <span className="font-mono text-[0.68rem] tabular-nums sm:hidden">
                    {baselineText ? (
                      <>
                        <span className="text-graphite/60">baseline </span>
                        <span className="text-graphite/75">{baselineText}</span>
                      </>
                    ) : (
                      <span className="text-graphite/45">no baseline yet</span>
                    )}
                  </span>

                  {/* Progress signal */}
                  <span
                    className={cn(
                      "font-mono text-[0.68rem]",
                      format.realProgress
                        ? "text-evergreen"
                        : "text-graphite/65",
                    )}
                  >
                    {progressLabel}
                  </span>
                </div>

                {/* Expectation text */}
                {format.expectation && (
                  <p className="mt-2 border-l-2 border-line/60 pl-3 text-sm leading-relaxed text-graphite/75">
                    {format.expectation.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProgressDashboard() {
  const summary = trpc.progress.summary.useQuery();
  const markSeen = trpc.engagement.markSeen.useMutation({
    onSuccess: () => void summary.refetch(),
  });

  if (summary.isLoading) {
    return (
      <StatusMessage tone="loading">Loading training signals…</StatusMessage>
    );
  }

  if (summary.error) {
    return (
      <ErrorNotice
        error={summary.error}
        heading="Progress unavailable"
        message="Mainline could not load your training signals. Try the summary again."
        onRetry={() => void summary.refetch()}
        retrying={summary.isFetching}
        retryLabel="Reload progress"
      />
    );
  }

  if (!summary.data) {
    return (
      <StatusMessage tone="neutral">
        No progress data is available yet.
      </StatusMessage>
    );
  }

  const data = summary.data;
  const recoveryEvent = data.consistency.recoveryEvents.find(
    (event) => !event.seen,
  );
  const dueDetail =
    data.reviews.dueCount === 0
      ? "Review queue clear"
      : data.reviews.oldestDue
        ? `Oldest due ${data.reviews.oldestDue.toLocaleDateString()}`
        : "Reviews waiting";

  return (
    <div className="settle flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        {recoveryEvent && (
          <RecoveryNote
            event={recoveryEvent}
            pending={markSeen.isPending}
            failed={markSeen.isError}
            onClear={() => {
              if (recoveryEvent.id) {
                markSeen.mutate({ ids: [recoveryEvent.id] });
              }
            }}
          />
        )}

        {/* Row 1: Consistency Grid & Dashboard Rationale */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 rounded-lg border bg-card p-5 shadow-sheet flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="eyebrow">Consistency</p>
                <span className="font-mono text-xs text-graphite">
                  {data.consistency.streak.activeDayCount} active day
                  {data.consistency.streak.activeDayCount === 1
                    ? ""
                    : "s"} · {data.consistency.streak.windowDays}-day window
                </span>
              </div>
              <p className="mt-2 font-serif text-2xl font-semibold">
                {data.consistency.streak.day > 0
                  ? `Day ${data.consistency.streak.day} of ${data.consistency.streak.cap}`
                  : "Ready for a fresh cycle"}
              </p>
            </div>
            <div className="mt-5">
              <ConsistencyGrid grid={data.consistency.grid} />
            </div>
          </div>

          <EvidenceNote
            title="Why this dashboard exists"
            evidence={data.evidence.progressSurface}
            className="md:col-span-5 flex flex-col justify-between"
          />
        </section>

        {/* Row 2: Standardized Quick Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatTile
            label="Blocks completed"
            value={String(data.work.completedBlocks)}
            detail={`Last ${data.work.windowDays}-day cycle; skips stay non-shaming (${data.work.skippedBlocks} skipped).`}
          />
          <StatTile
            label="Minutes logged"
            value={String(data.work.minutesLogged)}
            detail="Logged process time, not a promise of rating movement."
          />
          <StatTile
            label="Reviews due"
            value={String(data.reviews.dueCount)}
            detail={dueDetail}
          />
        </section>

        {/* Row 3: Spaced Review Health & Detailed Skill Signals */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Review Health Column */}
          <div className="md:col-span-5 flex flex-col gap-6">
            <div className="rounded-lg border bg-card p-4 shadow-sheet flex-1 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="eyebrow">Review health</h2>
                  <span
                    className={cn(
                      "rounded-sm border px-2 py-1 font-mono text-[0.68rem] uppercase",
                      data.reviews.dueCount === 0
                        ? "border-evergreen/40 bg-evergreen/10 text-evergreen"
                        : "border-amber/45 bg-amber/10 text-ink",
                    )}
                  >
                    {data.reviews.dueCount === 0 ? "clear" : "due"}
                  </span>
                </div>
                <div className="mt-4">
                  <ReviewTypeList itemTypes={data.reviews.itemTypes} />
                </div>
              </div>
            </div>
            <EvidenceNote
              title="Review policy"
              evidence={data.evidence.review}
            />
          </div>

          {/* Skill Signals Column */}
          <div className="md:col-span-7 flex flex-col gap-6 justify-between">
            <div className="flex flex-col gap-4">
              <h2 className="eyebrow border-b border-line/80 pb-3">
                Skill signals
              </h2>
              <SkillSignals skills={data.skills} />
            </div>
            <EvidenceNote
              title="Skill estimates"
              evidence={data.evidence.skill}
            />
          </div>
        </section>

        {/* Row 4: Rating Signals & Noise Warnings */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <RatingSignal rating={data.rating} className="md:col-span-7" />
          <div className="md:col-span-5 flex flex-col gap-6 justify-between">
            <EvidenceNote
              title="Rating caveat"
              evidence={data.evidence.ratingNoise}
              className="flex-1"
            />
            <EvidenceNote
              title="No rating promise"
              evidence={data.evidence.expectations}
              className="flex-1"
            />
          </div>
        </section>
      </div>

      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-graphite ml-2">
        Methodology {data.methodologyVersion}
      </p>
    </div>
  );
}
