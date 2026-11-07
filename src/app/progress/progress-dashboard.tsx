"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { Surface } from "@/components/ui/surface";
import { Button, buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { GradeMark } from "@/components/evidence";
import { WhyButton } from "@/components/ui/why-button";
import { getGuestSession, type GuestSessionData } from "@/lib/guest-session";
import type { AppRouter } from "@/server/routers/_app";
import type { inferRouterOutputs } from "@trpc/server";

type ProgressSummary = inferRouterOutputs<AppRouter>["progress"]["summary"];

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
      className="relative overflow-hidden rounded-md border border-amber/40 bg-amber/10 p-5"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-amber" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl pl-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id={`recovery-note-${event.id ?? "current"}`}
              className="font-mono text-xs font-semibold uppercase tracking-wider text-ink"
            >
              Return to the board
            </h3>
            <span className="rounded-xs border border-ink/10 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-ink">
              Grade {event.evidenceGrade} / Tier {event.evidenceTier}
            </span>
          </div>
          <p className="mt-2 font-sans text-sm leading-relaxed text-ink">
            {event.text}
          </p>
          <p className="mt-2 font-mono text-xs text-graphite">
            {event.citationSource ?? event.citationKey}
          </p>
          {failed && (
            <p role="alert" className="mt-2 text-sm text-clay">
              The note is still here. Try clearing it again.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={pending || event.id === null}
          className="shrink-0"
        >
          {pending
            ? "Clearing note…"
            : failed
              ? "Try clearing again"
              : "Clear note"}
        </Button>
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
    <Surface className={cn("p-5 flex flex-col justify-between", className)}>
      <p className="font-mono text-xs uppercase tracking-wider text-graphite">{label}</p>
      <p className="my-2 font-mono text-3xl font-semibold tabular-nums text-ink">
        {value}
      </p>
      <p className="font-sans text-xs leading-relaxed text-graphite">{detail}</p>
    </Surface>
  );
}

const WEEKDAY_NAMES = ["M", "T", "W", "T", "F", "S", "S"];

function ConsistencyGrid({
  grid,
}: {
  grid: { date: Date; active: boolean }[];
}) {
  // Ensure the grid displays the last 28 days as a clean 7x4 calendar (7 columns Mon-Sun, 4 rows)
  const paddedGrid = grid.slice(-28);

  return (
    <div className="flex flex-col gap-3">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 text-center font-mono text-[0.7rem] text-graphite max-w-xs">
        {WEEKDAY_NAMES.map((name, i) => (
          <span key={i} className="font-medium">
            {name}
          </span>
        ))}
      </div>

      {/* 4 weeks x 7 days calendar grid */}
      <div
        className="grid grid-cols-7 gap-2 max-w-xs"
        role="img"
        aria-label="Consistency calendar across recent weeks"
      >
        {paddedGrid.map((cell) => {
          const dateObj = new Date(cell.date);
          const dateStr = dateObj.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          return (
            <span
              key={dateObj.toISOString()}
              title={`${dateStr} - ${cell.active ? "Trained" : "Rest day"}`}
              className={cn(
                "h-8 w-8 rounded-sm transition-colors flex items-center justify-center text-[0.65rem] font-mono",
                cell.active
                  ? "bg-evergreen text-paper font-semibold shadow-xs"
                  : "bg-paper-raised border border-line text-graphite/60",
              )}
            >
              {dateObj.getDate()}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-4 font-mono text-xs text-graphite pt-1">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-xs bg-evergreen"
            aria-hidden="true"
          />
          Trained
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-xs border border-line bg-paper-raised"
            aria-hidden="true"
          />
          Rest day
        </span>
      </div>
    </div>
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
    isRating?: boolean;
  }[];
}) {
  if (skills.length === 0) {
    return (
      <p className="font-sans text-sm text-graphite leading-relaxed">
        Complete your first training session to unlock skill signals.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {skills.map((skill) => {
        const isRating = skill.isRating ?? (skill.dimension === "tactics");
        const isLowSample = skill.sampleSize < 3;
        const displayValue = isRating
          ? `~${Math.round(skill.estimate)} (±${Math.round(skill.uncertainty)})`
          : `${Math.round(skill.estimate * 100)}%`;

        return (
          <Surface
            key={skill.dimension}
            className="p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-serif text-sm font-semibold text-ink">
                {skill.label}
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                {isLowSample ? "Calibrating" : displayValue}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-line overflow-hidden">
              {isLowSample ? (
                <div className="h-2 w-full rounded-full bg-[repeating-linear-gradient(135deg,hsl(var(--evergreen)/0.3)_0_4px,transparent_4px_8px)]" />
              ) : isRating ? (
                <div
                  className="h-2 rounded-full bg-evergreen"
                  style={{
                    width: `${Math.max(
                      10,
                      Math.min(
                        100,
                        ((skill.estimate - 600) / (2400 - 600)) * 100,
                      ),
                    )}%`,
                  }}
                />
              ) : (
                <div
                  className="h-2 rounded-full bg-evergreen"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, Math.round(skill.estimate * 100)),
                    )}%`,
                  }}
                />
              )}
            </div>
            <p className="mt-2 font-mono text-[0.68rem] text-graphite">
              {skill.sampleSize} logged interaction
              {skill.sampleSize === 1 ? "" : "s"}
            </p>
          </Surface>
        );
      })}
    </div>
  );
}

type RatingData = NonNullable<ProgressSummary["rating"]>;

function RatingSignal({
  rating,
}: {
  rating: RatingData | null | undefined;
}) {
  if (!rating) {
    return (
      <Surface className="p-5 flex flex-col justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-graphite">Rating noise</p>
          <h3 className="mt-2 font-serif text-lg font-semibold text-ink">
            No rating data yet
          </h3>
          <p className="mt-1 text-sm text-graphite">
            Link a Lichess or Chess.com account to track your rating noise and
            format signals.
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-line/60">
          <Link
            href="/connections"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Connect accounts →
          </Link>
        </div>
      </Surface>
    );
  }

  const showPlatformSetup = !rating.platformSet;
  const showFormatsSetup = rating.platformSet && !rating.formatsSet;

  return (
    <Surface className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-graphite">Rating noise</p>
          <h3 className="mt-1 font-serif text-lg font-semibold text-ink">
            {rating.platformLabel}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPlatformSetup && (
            <Link
              href="/connections"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Connect accounts →
            </Link>
          )}
          {showFormatsSetup && (
            <Link
              href="/onboarding/constraints"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Choose time controls →
            </Link>
          )}
        </div>
      </div>

      {/* Format rows */}
      {rating.formats.length === 0 ? (
        <p className="text-sm text-graphite">
          No time controls selected. Choose formats in Settings to see rating
          signals.
        </p>
      ) : (
        <div className="divide-y divide-line/60">
          {rating.formats.map(
            (format: RatingData["formats"][number]) => {
              const lower = Math.round(format.latest.range.lower);
              const upper = Math.round(format.latest.range.upper);
              const midpoint = Math.round((lower + upper) / 2);
              const ciWidth = upper - lower;
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
                  className="py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-serif text-base font-semibold text-ink min-w-[5rem]">
                      {format.label}
                    </span>

                    <span className="font-mono text-xl font-semibold tabular-nums text-ink">
                      ~{midpoint}
                    </span>
                    <span className="font-mono text-xs text-graphite tabular-nums">
                      ± {format.latest.rd} RD
                    </span>

                    <div className="flex items-center gap-2">
                      <div className="relative flex items-center">
                        <div
                          className="h-[4px] rounded-full bg-graphite/25"
                          style={{ width: `${bandWidth}px` }}
                        />
                        <div className="absolute left-1/2 top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
                      </div>
                    </div>

                    <span className="font-mono text-xs text-graphite tabular-nums">
                      95% CI: {lower} – {upper}
                    </span>

                    <span className="ml-auto hidden font-mono text-xs tabular-nums text-graphite sm:inline">
                      {baselineText ? `Baseline: ${baselineText}` : "No baseline yet"}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span
                      className={cn(
                        "font-mono text-xs",
                        format.realProgress
                          ? "text-evergreen font-semibold"
                          : "text-graphite",
                      )}
                    >
                      {progressLabel}
                    </span>
                  </div>

                  {format.expectation && (
                    <p className="mt-2 border-l-2 border-line pl-3 text-xs leading-relaxed text-graphite">
                      {format.expectation.text}
                    </p>
                  )}
                </div>
              );
            },
          )}
        </div>
      )}
    </Surface>
  );
}

export function ProgressDashboard() {
  const summary = trpc.progress.summary.useQuery();
  const markSeen = trpc.engagement.markSeen.useMutation({
    onSuccess: () => void summary.refetch(),
  });

  const [guestSession, setGuestSession] = useState<GuestSessionData | null>(
    null,
  );

  useEffect(() => {
    setGuestSession(getGuestSession());
  }, []);

  if (summary.isLoading) {
    return <Notice tone="loading">Loading your training signals…</Notice>;
  }

  if (summary.error) {
    return (
      <Notice tone="error" heading="Progress unavailable">
        Mainline could not load your training signals. Try refreshing the page.
      </Notice>
    );
  }

  if (!summary.data) {
    return (
      <Notice tone="neutral">
        No progress data is available yet.
      </Notice>
    );
  }

  const data = summary.data;
  const recoveryEvent = data.consistency.recoveryEvents.find(
    (event: { seen: boolean }) => !event.seen,
  );

  const guestConn = guestSession?.connections?.[0];
  const primaryPlatform =
    guestConn?.platform ?? guestSession?.baseline?.platform ?? "lichess";
  const platformLabel =
    primaryPlatform === "chesscom" ? "Chess.com" : "Lichess";
  const formats = guestSession?.constraints?.formatPrefs?.formats ?? [
    "rapid",
    "blitz",
  ];

  const guestFormats: RatingData["formats"] = [];
  if (guestSession) {
    for (const fmt of formats) {
      if (primaryPlatform === "chesscom" && fmt === "classical") continue;
      const ratingObj = guestConn?.ratings?.[fmt];
      const ratingValue =
        ratingObj?.rating ??
        (fmt === "rapid" && guestSession.baseline?.tacticalRatingEstimate
          ? guestSession.baseline.tacticalRatingEstimate
          : null);
      if (!ratingValue) continue;
      const rd = ratingObj?.rd ?? guestSession.baseline?.uncertainty ?? 70;
      const ciMultiplier = 2;
      const lower = Math.round(ratingValue - ciMultiplier * rd);
      const upper = Math.round(ratingValue + ciMultiplier * rd);
      guestFormats.push({
        format: fmt,
        label: fmt.charAt(0).toUpperCase() + fmt.slice(1),
        capturedAt: new Date(
          guestConn?.connectedAt ?? guestSession.updatedAt ?? Date.now(),
        ),
        latestStable: rd <= 80,
        baseline: {
          capturedAt: new Date(
            guestConn?.connectedAt ?? guestSession.updatedAt ?? Date.now(),
          ),
          range: { lower, upper },
        },
        latest: {
          range: { lower, upper },
          rd,
        },
        realProgress: false,
        plateau: { reason: "insufficient" },
        expectation: {
          text: "Track your rating noise across sessions. Process consistency matters more than short-term fluctuations.",
        },
      });
    }
  }

  const effectiveRating: RatingData | null =
    data.rating ??
    (guestFormats.length > 0
      ? {
          platform: primaryPlatform,
          platformLabel,
          platformSet: Boolean(guestConn || guestSession?.baseline?.username),
          formatsSet: Boolean(
            guestSession?.constraints?.formatPrefs?.formats?.length,
          ),
          formats: guestFormats,
          ciMultiplier: 2,
          ciEvidence: {
            evidenceGrade:
              (data.evidence.ratingNoise.evidenceGrade as
                | "A"
                | "B"
                | "C"
                | "D") || "B",
            evidenceTier:
              (data.evidence.ratingNoise.evidenceTier as 1 | 2) || 1,
            citationKey: data.evidence.ratingNoise.citationKey,
            citationSource: data.evidence.ratingNoise.citationSource,
          },
        }
      : null);

  const isGuestCalibrated = Boolean(
    guestSession?.baseline?.calibratedAt ||
    (guestSession?.calibrationResponses &&
      guestSession.calibrationResponses.length >= 3),
  );

  const effectiveSkills =
    data.skills.length > 0
      ? data.skills
      : isGuestCalibrated && guestSession?.baseline?.tacticalRatingEstimate
        ? [
            {
              dimension: "tactics",
              label: "Tactical pattern recognition",
              estimate: guestSession.baseline.tacticalRatingEstimate,
              uncertainty: guestSession.baseline.uncertainty,
              sampleSize: guestSession.calibrationResponses?.length || 3,
              isRating: true,
            },
          ]
        : [];

  const guestCompletedBlocks =
    guestSession?.program?.items.filter((i) => i.status === "done").length ?? 0;
  const guestSkippedBlocks =
    guestSession?.program?.items.filter((i) => i.status === "skipped").length ??
    0;
  const guestMinutesLogged =
    guestSession?.activityEvents.reduce(
      (sum, e) =>
        sum +
        (typeof e.payload?.minutes === "number"
          ? e.payload.minutes
          : typeof e.payload?.estMinutes === "number"
            ? e.payload.estMinutes
            : 0),
      0,
    ) ?? 0;

  const effectiveWork = {
    windowDays: data.work.windowDays,
    completedBlocks: data.work.completedBlocks + guestCompletedBlocks,
    skippedBlocks: data.work.skippedBlocks + guestSkippedBlocks,
    minutesLogged: data.work.minutesLogged + guestMinutesLogged,
  };

  const dueDetail =
    data.reviews.dueCount === 0
      ? "Review queue clear"
      : data.reviews.oldestDue
        ? `Oldest due ${data.reviews.oldestDue.toLocaleDateString()}`
        : "Reviews waiting";

  return (
    <div className="settle flex flex-col gap-6">
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

      {/* 1. Effort First (Section 6.5) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile
          label="Blocks completed"
          value={String(effectiveWork.completedBlocks)}
          detail={`Last ${effectiveWork.windowDays}-day cycle (${effectiveWork.skippedBlocks} skipped).`}
        />
        <StatTile
          label="Minutes logged"
          value={String(effectiveWork.minutesLogged)}
          detail="Total training time across current cycle."
        />
        <StatTile
          label="Reviews due"
          value={String(data.reviews.dueCount)}
          detail={dueDetail}
        />
      </section>

      {/* 2. Consistency Over 4 Weeks (Compact 7x4 Calendar) */}
      <Surface className="p-5 flex flex-col justify-between">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-lg font-semibold text-ink">Consistency</h2>
            <GradeMark
              grade={data.evidence.progressSurface.evidenceGrade}
              tier={data.evidence.progressSurface.evidenceTier}
            />
          </div>
          <span className="font-mono text-xs text-graphite">
            {data.consistency.streak.activeDayCount} active day
            {data.consistency.streak.activeDayCount === 1 ? "" : "s"} ·{" "}
            {data.consistency.streak.windowDays}-day window
          </span>
        </div>
        <p className="mt-1 font-serif text-2xl font-semibold text-ink">
          {data.consistency.streak.day > 0
            ? `Day ${data.consistency.streak.day} of ${data.consistency.streak.cap}`
            : "Ready for a fresh cycle"}
        </p>
        <div className="mt-4">
          <ConsistencyGrid grid={data.consistency.grid} />
        </div>
      </Surface>

      {/* 3. Skill Estimates with Uncertainty Bands */}
      <Surface className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="font-serif text-lg font-semibold text-ink">Skill signals</h2>
          <GradeMark
            grade={data.evidence.skill.evidenceGrade}
            tier={data.evidence.skill.evidenceTier}
          />
        </div>
        <SkillSignals skills={effectiveSkills} />
      </Surface>

      {/* 4. Rating Noise */}
      <RatingSignal rating={effectiveRating} />

      {/* Page-level Why Control & Methodology Note */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
        <WhyButton
          rationaleText={data.evidence.progressSurface.text}
          evidenceGrade={data.evidence.progressSurface.evidenceGrade}
          evidenceTier={data.evidence.progressSurface.evidenceTier}
          citationKey={data.evidence.progressSurface.citationKey}
          citationSource={data.evidence.progressSurface.citationSource}
          label="Why this progress view?"
        />
        <p className="font-mono text-xs text-graphite">
          Methodology {data.methodologyVersion}
        </p>
      </div>
    </div>
  );
}
