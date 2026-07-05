"use client";

import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
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
}: {
  title: string;
  evidence: Evidence;
}) {
  return (
    <aside
      className={cn(
        "rounded-md border p-3.5",
        GRADE_CLASS[evidence.evidenceGrade] ?? "border-line bg-card",
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

function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-sheet">
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
    return <p className="text-sm text-graphite">No reviews are due right now.</p>;
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
      <p className="rounded-md border bg-card p-4 text-sm text-graphite shadow-sheet">
        Complete in-app training blocks to build skill estimates. Empty is
        better than pretending we know.
      </p>
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
            className="rounded-md border bg-card p-4 shadow-sheet"
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
}: {
  rating: ProgressSummary["rating"];
}) {
  if (!rating) {
    return (
      <p className="rounded-md border bg-card p-4 text-sm text-graphite shadow-sheet">
        No rating snapshots with deviation data yet. Connect and sync an
        account to show uncertainty bands.
      </p>
    );
  }

  const latestLower = Math.round(rating.latest.range.lower);
  const latestUpper = Math.round(rating.latest.range.upper);
  const baseline =
    rating.baseline &&
    `${Math.round(rating.baseline.range.lower)}-${Math.round(
      rating.baseline.range.upper,
    )}`;

  return (
    <div className="rounded-md border bg-card p-4 shadow-sheet">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Rating noise</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold">
            {rating.realProgress
              ? "Signal cleared the old range"
              : "Still inside the noise band"}
          </h2>
        </div>
        <span className="rounded-sm border border-line bg-paper/70 px-2 py-1 font-mono text-[0.7rem] uppercase text-graphite">
          {rating.platform} · {rating.format}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-sm border border-line bg-paper/60 p-3">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-graphite">
            Current 95% range
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {latestLower}-{latestUpper}
          </p>
        </div>
        <div className="rounded-sm border border-line bg-paper/60 p-3">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-graphite">
            Baseline range
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {baseline ?? "Not stable yet"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-graphite">
        {rating.plateau.reason === "plateau"
          ? "The recent range has not set a new high, so the adaptation loop can change the stimulus instead of adding volume."
          : rating.plateau.reason === "new_high"
            ? "The recent range set a new high, but we still treat rating as a noisy secondary signal."
            : "There is not enough stable rating history to call a plateau or a real gain."}
      </p>
      {rating.expectation ? (
        <p className="mt-3 border-l-2 border-evergreen/45 pl-3 text-sm leading-relaxed text-graphite">
          {rating.expectation.text}
        </p>
      ) : null}
    </div>
  );
}

export function ProgressDashboard() {
  const summary = trpc.progress.summary.useQuery();

  if (summary.isLoading) {
    return (
      <p className="font-mono text-sm text-graphite">
        Loading training signals...
      </p>
    );
  }

  if (!summary.data) {
    return (
      <p className="rounded-md border bg-card p-4 text-sm text-graphite shadow-sheet">
        No progress data is available yet.
      </p>
    );
  }

  const data = summary.data;
  const dueDetail =
    data.reviews.dueCount === 0
      ? "Review queue clear"
      : data.reviews.oldestDue
        ? `Oldest due ${data.reviews.oldestDue.toLocaleDateString()}`
        : "Reviews waiting";

  return (
    <div className="settle flex flex-col gap-8">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border bg-card p-5 shadow-sheet">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="eyebrow">Consistency</p>
            <span className="font-mono text-xs text-graphite">
              {data.consistency.streak.activeDayCount} active day
              {data.consistency.streak.activeDayCount === 1 ? "" : "s"} ·{" "}
              {data.consistency.streak.windowDays}-day window
            </span>
          </div>
          <p className="mt-2 font-serif text-2xl font-semibold">
            {data.consistency.streak.day > 0
              ? `Day ${data.consistency.streak.day} of ${data.consistency.streak.cap}`
              : "Ready for a fresh cycle"}
          </p>
          <div className="mt-5">
            <ConsistencyGrid grid={data.consistency.grid} />
          </div>
        </div>

        <EvidenceNote
          title="Why this dashboard exists"
          evidence={data.evidence.progressSurface}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
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

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-md border bg-card p-4 shadow-sheet">
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
          <EvidenceNote title="Review policy" evidence={data.evidence.review} />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="eyebrow border-b border-line/80 pb-3">
              Skill signals
            </h2>
            <div className="mt-4">
              <SkillSignals skills={data.skills} />
            </div>
          </div>
          <EvidenceNote title="Skill estimates" evidence={data.evidence.skill} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <RatingSignal rating={data.rating} />
        <div className="flex flex-col gap-4">
          <EvidenceNote
            title="Rating caveat"
            evidence={data.evidence.ratingNoise}
          />
          <EvidenceNote
            title="No rating promise"
            evidence={data.evidence.expectations}
          />
        </div>
      </section>

      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-graphite">
        Methodology {data.methodologyVersion}
      </p>
    </div>
  );
}
