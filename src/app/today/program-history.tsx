import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import type { ProgramHistoryEntry } from "@/lib/program-history";
import {
  formatForecastDate,
  formatMeasurementCoverage,
  formatMeasuredMinutes,
  formatMinuteCap,
  formatProgramVersionTime,
} from "@/app/today/today-copy";
import { cn } from "@/lib/utils";

export interface ProgramHistoryDay {
  key: string;
  scheduledDate: Date | null;
  entries: ProgramHistoryEntry[];
}

export function groupProgramHistoryByDay(
  entries: readonly ProgramHistoryEntry[],
): ProgramHistoryDay[] {
  const days = new Map<string, ProgramHistoryDay>();
  for (const entry of entries) {
    const key = entry.scheduledDate
      ? entry.scheduledDate.toISOString().slice(0, 10)
      : `unscheduled:${entry.id}`;
    const existing = days.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      days.set(key, {
        key,
        scheduledDate: entry.scheduledDate,
        entries: [entry],
      });
    }
  }
  return [...days.values()];
}

export function ProgramArchive({
  entries,
  currentProgramId,
  loading,
  error,
  hasMore,
  loadingMore,
  onRetry,
  onLoadMore,
}: {
  entries: ProgramHistoryEntry[];
  currentProgramId: string;
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  const days = groupProgramHistoryByDay(entries);

  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sheet">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <p className="eyebrow">Program</p>
          <h2 className="mt-1 font-serif text-lg font-semibold text-ink">
            History
          </h2>
        </div>
        <p className="max-w-md text-right font-mono text-[0.68rem] leading-relaxed text-graphite">
          Earlier sessions keep their original outcomes and reasons.
        </p>
      </div>

      {loading && entries.length === 0 ? (
        <div className="p-4 sm:p-5">
          <StatusMessage tone="loading">Loading program history…</StatusMessage>
        </div>
      ) : error && entries.length === 0 ? (
        <div className="p-4 sm:p-5">
          <StatusMessage tone="error" heading="Program history unavailable">
            <div className="flex flex-wrap items-center gap-3">
              <span>Your current session is unaffected.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetry}
              >
                Try again
              </Button>
            </div>
          </StatusMessage>
        </div>
      ) : entries.length === 0 ? (
        <p className="p-4 text-sm text-graphite sm:p-5">
          No training history yet.
        </p>
      ) : (
        <ol className="divide-y divide-line">
          {days.map((day, index) => (
            <ProgramDay
              key={day.key}
              day={day}
              currentProgramId={currentProgramId}
              first={index === 0}
            />
          ))}
        </ol>
      )}

      {(hasMore || (error && entries.length > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
          {error ? (
            <span className="text-sm text-clay">
              Earlier versions could not be loaded.
            </span>
          ) : (
            <span className="font-mono text-[0.68rem] text-graphite">
              Showing {days.length} {days.length === 1 ? "session" : "sessions"}
              {entries.length !== days.length
                ? ` from ${entries.length} immutable plan versions`
                : ""}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loadingMore}
            onClick={error ? onRetry : onLoadMore}
          >
            {loadingMore ? "Loading…" : error ? "Try again" : "Load earlier"}
          </Button>
        </div>
      )}
    </section>
  );
}

function ProgramDay({
  day,
  currentProgramId,
  first,
}: {
  day: ProgramHistoryDay;
  currentProgramId: string;
  first: boolean;
}) {
  const current = day.entries.some((entry) => entry.id === currentProgramId);
  const latest =
    day.entries.find((entry) => entry.id === currentProgramId) ??
    day.entries[0]!;
  const scheduled = day.scheduledDate
    ? formatForecastDate(day.scheduledDate.getTime())
    : "Unscheduled session";
  const done = day.entries.reduce(
    (total, entry) =>
      total + entry.items.filter((item) => item.status === "done").length,
    0,
  );
  const skipped = day.entries.reduce(
    (total, entry) =>
      total + entry.items.filter((item) => item.status === "skipped").length,
    0,
  );
  const eventCount = day.entries.reduce(
    (total, entry) => total + entry.eventCount,
    0,
  );
  const measuredEventCount = day.entries.reduce(
    (total, entry) => total + entry.measuredEventCount,
    0,
  );
  const actualMinutes = sumMeasuredMinutes(
    day.entries.map((entry) => entry.actualMinutes),
  );
  const measurementTruncated = day.entries.some(
    (entry) => entry.measurementTruncated,
  );

  return (
    <li className={cn("relative", current && "bg-evergreen/[0.035]")}>
      <details open={first && !current ? true : undefined}>
        <summary className="cursor-pointer list-none px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "mt-1 h-3 w-3 shrink-0 rounded-full border-2",
                  current
                    ? "border-evergreen bg-evergreen"
                    : "border-line bg-paper-raised",
                )}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif font-semibold text-ink">
                    {scheduled}
                  </p>
                  <span className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-graphite">
                    {current ? "Current session" : "Earlier session"}
                  </span>
                  {day.entries.length > 1 && (
                    <span className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.62rem] text-graphite">
                      {day.entries.length} plan versions
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[0.65rem] text-graphite">
                  Latest plan {formatProgramVersionTime(latest.createdAt)} ·{" "}
                  {latest.methodologyVersion}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pl-6 sm:pl-0 sm:text-right">
              <TimeMetric
                label="Planned"
                value={formatPlannedMinutes(latest.plannedMinutes)}
              />
              <TimeMetric
                label="Actual, measured"
                value={formatMeasuredMinutes(
                  actualMinutes,
                  measurementTruncated,
                )}
                note={formatMeasurementCoverage(
                  measuredEventCount,
                  eventCount,
                  measurementTruncated,
                )}
              />
            </div>
          </div>
          <p className="mt-3 pl-6 font-mono text-[0.65rem] text-graphite sm:pl-6">
            {done} done · {skipped} skipped · {eventCount} logged{" "}
            {eventCount === 1 ? "event" : "events"}
          </p>
        </summary>
        <div className="border-t border-line/80 bg-paper/35 px-4 py-3 sm:px-5">
          <ol className="space-y-3">
            {day.entries.map((entry, index) => (
              <ProgramVersion
                key={entry.id}
                entry={entry}
                current={entry.id === currentProgramId}
                first={index === 0}
              />
            ))}
          </ol>
        </div>
      </details>
    </li>
  );
}

function ProgramVersion({
  entry,
  current,
  first,
}: {
  entry: ProgramHistoryEntry;
  current: boolean;
  first: boolean;
}) {
  const done = entry.items.filter((item) => item.status === "done").length;
  const skipped = entry.items.filter(
    (item) => item.status === "skipped",
  ).length;

  return (
    <li className="rounded-md border border-line/80 bg-card">
      <details open={first ? true : undefined}>
        <summary className="cursor-pointer list-none px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-serif text-sm font-semibold text-ink">
                {current ? "Current plan" : "Earlier plan"}
              </p>
              <p className="mt-1 font-mono text-[0.63rem] text-graphite">
                Created {formatProgramVersionTime(entry.createdAt)} ·{" "}
                {entry.methodologyVersion}
              </p>
              <p className="mt-1 font-mono text-[0.61rem] text-graphite">
                {done} done · {skipped} skipped · {entry.eventCount} logged
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-right">
              <TimeMetric
                label="Planned"
                value={formatPlannedMinutes(entry.plannedMinutes)}
                compact
              />
              <TimeMetric
                label="Actual, measured"
                value={formatMeasuredMinutes(
                  entry.actualMinutes,
                  entry.measurementTruncated,
                )}
                note={formatMeasurementCoverage(
                  entry.measuredEventCount,
                  entry.eventCount,
                  entry.measurementTruncated,
                )}
                compact
              />
            </div>
          </div>
        </summary>
        <div className="border-t border-line/80 px-3 py-3">
          <ol className="space-y-2">
            {entry.items.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-line/80 bg-card px-3 py-3"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-serif text-sm font-semibold text-ink">
                      {item.label}
                    </p>
                    <p className="mt-1 font-mono text-[0.63rem] capitalize text-graphite">
                      {item.status} ·{" "}
                      {item.dimensionLabels.join(", ") || "General"}
                    </p>
                  </div>
                  <div className="flex gap-4 text-right">
                    <TimeMetric
                      label="Planned"
                      value={formatPlannedMinutes(item.plannedMinutes)}
                      compact
                    />
                    <TimeMetric
                      label="Actual, measured"
                      value={formatMeasuredMinutes(
                        item.actualMinutes,
                        item.measurementTruncated,
                      )}
                      note={formatMeasurementCoverage(
                        item.measuredEventCount,
                        item.eventCount,
                        item.measurementTruncated,
                      )}
                      compact
                    />
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer font-mono text-[0.65rem] text-evergreen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Original rationale and evidence
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-graphite">
                    {item.rationale.text}
                  </p>
                  <p className="mt-1 font-mono text-[0.62rem] text-graphite">
                    Grade {item.rationale.evidenceGrade} · Tier{" "}
                    {item.rationale.evidenceTier} ·{" "}
                    {item.rationale.citationSource ??
                      item.rationale.citationKey}
                  </p>
                </details>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </li>
  );
}

function sumMeasuredMinutes(values: readonly (number | null)[]): number | null {
  const measured = values.filter((value): value is number => value != null);
  return measured.length > 0
    ? measured.reduce((total, value) => total + value, 0)
    : null;
}

function formatPlannedMinutes(minutes: number | null): string {
  return minutes == null ? "Not recorded" : formatMinuteCap(minutes);
}

function TimeMetric({
  label,
  value,
  note,
  compact = false,
}: {
  label: string;
  value: string;
  note?: string | null;
  compact?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-graphite">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono tabular-nums text-ink",
          compact ? "text-[0.68rem]" : "text-xs",
        )}
      >
        {value}
      </p>
      {note && (
        <p className="mt-0.5 max-w-36 font-mono text-[0.55rem] leading-relaxed text-graphite">
          {note}
        </p>
      )}
    </div>
  );
}
