import { Button } from "@/components/ui/button";
import type { ProgramDayForecast } from "@/lib/program-forecast";
import type { WeeklyFocus } from "@/lib/weekly-focus";
import { cn } from "@/lib/utils";
import {
  focusSourceLabel,
  formatForecastDate,
  humanizeFocusArea,
} from "@/app/today/today-copy";

export function AvailabilityPrompt({
  pendingMode,
  onFlexible,
  onWeekdays,
  onLater,
}: {
  pendingMode?: "flexible" | "preferred";
  onFlexible: () => void;
  onWeekdays: () => void;
  onLater: () => void;
}) {
  const busy = pendingMode != null;
  return (
    <section className="overflow-hidden rounded-lg border border-evergreen/25 bg-card shadow-sheet">
      <div className="border-b border-line bg-evergreen/[0.045] px-4 py-3 sm:px-5">
        <p className="eyebrow">Optional setup</p>
        <h2 className="mt-1 font-serif text-lg font-semibold text-ink">
          Set your training rhythm
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-graphite">
          This only shapes the provisional week. It does not judge consistency,
          create catch-up debt, or change measured skill.
        </p>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="bg-card p-4 sm:p-5">
          <p className="font-serif text-base font-semibold text-ink">
            Keep every day flexible
          </p>
          <p className="mt-1 text-sm leading-relaxed text-graphite">
            Mainline will show a plan for each day without assuming when you
            train.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-4"
            disabled={busy}
            onClick={onFlexible}
          >
            {pendingMode === "flexible" ? "Saving..." : "Keep days flexible"}
          </Button>
        </div>
        <div className="bg-card p-4 sm:p-5">
          <p className="font-serif text-base font-semibold text-ink">
            Start with weekdays
          </p>
          <p className="mt-1 text-sm leading-relaxed text-graphite">
            Monday through Friday become preferred days. Any date can still be
            changed later.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-4"
            disabled={busy}
            onClick={onWeekdays}
          >
            {pendingMode === "preferred"
              ? "Saving..."
              : "Use weekdays as a starting point"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
        <p className="font-mono text-[0.68rem] text-graphite">
          No choice is required now.
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onLater}
        >
          Decide later
        </Button>
      </div>
    </section>
  );
}

export function WeekFile({
  days,
  unavailableDates,
  pendingDate,
  onMarkUnavailable,
  onRestore,
}: {
  days: ProgramDayForecast[];
  unavailableDates: ReadonlySet<number>;
  pendingDate?: number;
  onMarkUnavailable: (date: number) => void;
  onRestore: (date: number) => void;
}) {
  return (
    <section className="rounded-lg border bg-card shadow-sheet">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <p className="eyebrow">Seven-day forecast</p>
          <h2 className="mt-1 font-serif text-lg font-semibold text-ink">
            The week file
          </h2>
        </div>
        <p className="max-w-sm text-right font-mono text-[0.68rem] leading-relaxed text-graphite">
          Today is committed after training starts. Future days are provisional.
        </p>
      </div>
      <p className="border-b border-line px-4 py-2 font-mono text-[0.64rem] text-graphite sm:hidden">
        Swipe or scroll to see later days.
      </p>
      <div
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        role="region"
        aria-label="Seven-day forecast"
        tabIndex={0}
      >
        <ol className="grid min-w-[46rem] grid-cols-7 divide-x divide-line">
          {days.map((day, index) => {
            const explicitlyUnavailable = unavailableDates.has(day.date);
            const resting = day.expectedMinutes === 0;
            const state = index === 0 ? "Today" : resting ? "Rest" : "Planned";
            const busy = pendingDate === day.date;
            return (
              <li
                key={day.id}
                className={cn(
                  "flex min-h-44 flex-col px-3 py-4",
                  index === 0 && "bg-evergreen/[0.045]",
                )}
              >
                <span className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-evergreen">
                  {state}
                </span>
                <p className="mt-2 font-serif text-sm font-semibold text-ink">
                  {formatForecastDate(day.date)}
                </p>
                <p className="mt-3 font-mono text-xs tabular-nums text-graphite">
                  {resting
                    ? "No session planned"
                    : `${day.expectedMinutes} min · ${day.plannedBlocks.length} ${day.plannedBlocks.length === 1 ? "block" : "blocks"}`}
                </p>
                {index > 0 && (
                  <div className="mt-auto pt-4">
                    {explicitlyUnavailable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onRestore(day.date)}
                      >
                        {busy ? "Restoring..." : "Restore day"}
                      </Button>
                    ) : !resting ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onMarkUnavailable(day.date)}
                      >
                        {busy ? "Saving..." : "I’m unavailable"}
                      </Button>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

type WeeklyFocusView = WeeklyFocus & {
  recommendation: {
    focusAreas: string[];
    supportingSignals: WeeklyFocus["supportingSignals"];
    rationale: WeeklyFocus["rationaleSnapshots"][number];
  };
};

function sameFocus(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((focusArea, index) => focusArea === right[index])
  );
}

export function WeeklyDirection({
  focus,
  focusLabels,
  optionsOpen,
  pendingFocus,
  onToggleOptions,
  onKeep,
  onSelect,
}: {
  focus: WeeklyFocusView;
  focusLabels: Record<string, string>;
  optionsOpen: boolean;
  pendingFocus?: string;
  onToggleOptions: () => void;
  onKeep: () => void;
  onSelect: (focusAreas: string[]) => void;
}) {
  const labelFor = (focusArea: string) =>
    focusLabels[focusArea] ?? humanizeFocusArea(focusArea);
  const currentLabel = focus.focusAreas.map(labelFor).join(" + ");
  const recommendedLabel = focus.recommendation.focusAreas
    .map(labelFor)
    .join(" + ");
  const recommendationIsCurrent = sameFocus(
    focus.focusAreas,
    focus.recommendation.focusAreas,
  );
  const recommendationSources = [
    ...new Set(
      focus.recommendation.supportingSignals.flatMap((signal) =>
        signal.sources.map(focusSourceLabel),
      ),
    ),
  ];
  const otherOptions = focus.alternatives.filter(
    (alternative) =>
      !focus.focusAreas.includes(alternative.focusArea) &&
      !focus.recommendation.focusAreas.includes(alternative.focusArea),
  );
  const hasChoices = otherOptions.length > 0;
  const recommendationKey = focus.recommendation.focusAreas.join("|");
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sheet">
      <div className="border-b border-line bg-evergreen/[0.035] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Weekly direction</p>
          <span className="font-mono text-[0.68rem] capitalize text-graphite">
            {focus.confidence} confidence
          </span>
        </div>

        <div className="mt-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-evergreen px-2 py-1 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-white">
                Recommended for you
              </span>
              {recommendationIsCurrent && (
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-evergreen">
                  Current
                </span>
              )}
            </div>
            <h2 className="mt-2 break-words font-serif text-xl font-semibold text-ink sm:text-2xl">
              {recommendedLabel}
            </h2>
            {recommendationSources.length > 0 && (
              <p className="mt-2 text-sm leading-relaxed text-graphite">
                Based on {recommendationSources.join(", ")}.
              </p>
            )}
          </div>
          {!recommendationIsCurrent && (
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              disabled={pendingFocus != null}
              onClick={() => onSelect(focus.recommendation.focusAreas)}
            >
              {pendingFocus === recommendationKey
                ? "Updating..."
                : "Use recommendation"}
            </Button>
          )}
        </div>
      </div>

      {!recommendationIsCurrent && (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-graphite">
              Your current choice
            </span>
            <p className="mt-0.5 break-words font-serif font-semibold text-ink">
              {currentLabel}
            </p>
          </div>
          <span className="rounded-sm border border-evergreen/25 px-2 py-1 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-evergreen">
            Active
          </span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          {hasChoices && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              aria-expanded={optionsOpen}
              aria-controls="weekly-focus-options"
              onClick={onToggleOptions}
            >
              {optionsOpen ? "Hide other choices" : "See other choices"}
            </Button>
          )}
          <span className="text-sm text-graphite">
            Optional. Today stays unchanged.
          </span>
        </div>

        <details className="mt-3 text-xs leading-relaxed text-graphite">
          <summary className="cursor-pointer font-mono text-[0.68rem] text-evergreen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Evidence and limits
          </summary>
          <div className="mt-2 max-w-3xl space-y-2">
            <p>{focus.recommendation.rationale.text}</p>
            {focus.alternatives[0] && (
              <p>{focus.alternatives[0].tradeoff.text}</p>
            )}
          </div>
        </details>
      </div>

      {optionsOpen && hasChoices && (
        <div id="weekly-focus-options" className="border-t border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-graphite">
              Goal-aligned alternatives
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0"
              disabled={pendingFocus != null}
              onClick={onKeep}
            >
              Keep {currentLabel}
            </Button>
          </div>
          {otherOptions.length > 0 ? (
            <div className="divide-y divide-line border-t border-line">
              {otherOptions.map((alternative) => {
                const label = labelFor(alternative.focusArea);
                const busy = pendingFocus === alternative.focusArea;
                const sources = [
                  ...new Set(
                    alternative.supportingSources.map(focusSourceLabel),
                  ),
                ];
                return (
                  <div
                    key={alternative.focusArea}
                    className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="font-serif text-base font-semibold text-ink">
                        {label}
                      </p>
                      <p className="mt-1 text-sm text-graphite">
                        {sources.length > 0
                          ? `Aligned with ${sources.join(", ")}.`
                          : "Available within your current training goals."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4 sm:mt-0 shrink-0"
                      disabled={pendingFocus != null}
                      onClick={() => onSelect([alternative.focusArea])}
                    >
                      {busy ? "Updating..." : `Use ${label}`}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="border-t border-line px-4 py-4 text-sm text-graphite sm:px-5">
              No other approved choices are available this week.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
