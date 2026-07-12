"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { TransparencyCard } from "@/components/transparency-card";
import type { TodayItem, TodayProgram } from "@/server/program";
import type { ProgramDayForecast } from "@/lib/program-forecast";
import type { WeeklyFocus } from "@/lib/weekly-focus";
import { cn } from "@/lib/utils";
import {
  activityActionLabel,
  asGrade,
  completionEventType,
  focusSourceLabel,
  formatMinuteCap,
  formatForecastDate,
  humanizeFocusArea,
  isAutoLoggedInternal,
  isClosedItem,
  isPuzzleAttemptLoggable,
  itemMeta,
  itemSummary,
  primaryActionKind,
  rowStatusLabel,
  sessionMinuteCap,
} from "@/app/today/today-copy";

// The "Today" screen (BUILD.md §7.6, M6/M7). It renders the ordered daily session as
// compact prescription cards: process goal first, hard time caps, visible action, and the
// snapshotted TransparencyCard kept one disclosure away on every item (L3).

type LogOutcomeInput = {
  programItemId: string;
  type: "skip" | "puzzle_attempt" | "drill_done" | "game_played";
  correct?: boolean;
};

type ProgramNotice = {
  tone: "success" | "error" | "neutral";
  heading: string;
  message: string;
};

export function Today() {
  const utils = trpc.useUtils();
  const [programNotice, setProgramNotice] = useState<ProgramNotice | null>(
    null,
  );
  const [availabilityDismissed, setAvailabilityDismissed] = useState(false);
  const [focusOptionsOpen, setFocusOptionsOpen] = useState(false);
  const today = trpc.program.getToday.useQuery();
  const weeklyFocus = trpc.program.weeklyFocus.useQuery();
  const forecast = trpc.program.forecast.useQuery();
  const availability = trpc.program.availability.useQuery();
  const availabilityOverrides = trpc.program.availabilityOverrides.useQuery();
  const saveAvailability = trpc.program.saveAvailability.useMutation({
    onMutate: () => setProgramNotice(null),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        utils.program.availability.invalidate(),
        utils.program.forecast.invalidate(),
      ]);
      setProgramNotice({
        tone: "success",
        heading: "Training rhythm saved",
        message:
          variables.mode === "flexible"
            ? "Your week stays flexible. No preferred training days were added."
            : "Weekdays are now your preferred training days. Individual dates can still change.",
      });
    },
    onError: () =>
      setProgramNotice({
        tone: "error",
        heading: "Training rhythm not saved",
        message: "The update did not go through. Try again.",
      }),
  });
  const saveOverride = trpc.program.saveAvailabilityOverride.useMutation({
    onMutate: () => setProgramNotice(null),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        utils.program.forecast.invalidate(),
        utils.program.availabilityOverrides.invalidate(),
      ]);
      setProgramNotice({
        tone: "success",
        heading: "Day updated",
        message: `${formatForecastDate(variables.date)} is marked unavailable. The remaining forecast was recalculated without catch-up work.`,
      });
    },
    onError: () =>
      setProgramNotice({
        tone: "error",
        heading: "Day not updated",
        message: "The availability change did not go through. Try again.",
      }),
  });
  const removeOverride = trpc.program.removeAvailabilityOverride.useMutation({
    onMutate: () => setProgramNotice(null),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        utils.program.forecast.invalidate(),
        utils.program.availabilityOverrides.invalidate(),
      ]);
      setProgramNotice({
        tone: "success",
        heading: "Day restored",
        message: `${formatForecastDate(variables.date)} now follows your usual weekly availability.`,
      });
    },
    onError: () =>
      setProgramNotice({
        tone: "error",
        heading: "Day not restored",
        message: "The override could not be removed. Try again.",
      }),
  });
  const replan = trpc.program.replan.useMutation({
    onMutate: () => setProgramNotice(null),
    onSuccess: async () => {
      await Promise.all([
        utils.program.getToday.invalidate(),
        utils.program.forecast.invalidate(),
        utils.program.weeklyFocus.invalidate(),
        utils.program.revisions.invalidate(),
      ]);
      setProgramNotice({
        tone: "success",
        heading: "Today replanned",
        message:
          "Completed work stayed in your history. The remaining session and forecast now use current inputs.",
      });
    },
    onError: () =>
      setProgramNotice({
        tone: "error",
        heading: "Today not replanned",
        message: "Your existing session is unchanged. Try again.",
      }),
  });
  const selectFocus = trpc.program.selectFocus.useMutation({
    onMutate: () => setProgramNotice(null),
    onSuccess: async (result, variables) => {
      await Promise.all([
        utils.program.weeklyFocus.invalidate(),
        utils.program.getToday.invalidate(),
        utils.program.forecast.invalidate(),
        utils.program.revisions.invalidate(),
      ]);
      setFocusOptionsOpen(false);
      const selectedLabel = variables.focusAreas
        .map(
          (focusArea) =>
            weeklyFocus.data?.focusLabels[focusArea] ??
            humanizeFocusArea(focusArea),
        )
        .join(" + ");
      setProgramNotice({
        tone: result.forecastUpdated ? "success" : "neutral",
        heading: result.forecastUpdated
          ? "Weekly focus changed"
          : "Focus saved, preview not refreshed",
        message: result.forecastUpdated
          ? `${selectedLabel} will guide future provisional days. A started Today remains unchanged.`
          : `${selectedLabel} is active, but the seven-day preview may stay stale until the next session rebuild.`,
      });
    },
    onError: async (error) => {
      await utils.program.weeklyFocus.invalidate();
      setProgramNotice({
        tone: "error",
        heading: "Weekly focus not changed",
        message: `The change was not confirmed. The latest weekly focus has been reloaded. ${error.message}`,
      });
    },
  });
  const dueReviews = trpc.tracker.dueReviews.useQuery();
  const generate = trpc.program.generate.useMutation({
    onMutate: () => setProgramNotice(null),
    onSuccess: async () => {
      await Promise.all([
        utils.program.getToday.invalidate(),
        utils.program.forecast.invalidate(),
        utils.tracker.dueReviews.invalidate(),
      ]);
      setProgramNotice({
        tone: "success",
        heading: "Session rebuilt",
        message: "Today now fits the saved time budget.",
      });
    },
    onError: () =>
      setProgramNotice({
        tone: "error",
        heading: "Session not rebuilt",
        message: "Your previous session is still available. Try again.",
      }),
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
    onError: () =>
      setProgramNotice({
        tone: "error",
        heading: "Time budget not saved",
        message: "Today is unchanged. Check the value and try again.",
      }),
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
    return <StatusMessage tone="loading">Loading your session…</StatusMessage>;
  }

  if (today.error) {
    return (
      <StatusMessage tone="error" heading="Session unavailable">
        <div className="flex flex-wrap items-center gap-3">
          <span>We could not load today&apos;s session.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void today.refetch()}
          >
            Try again
          </Button>
        </div>
      </StatusMessage>
    );
  }

  const program = today.data;
  const pendingItemId = log.isPending
    ? log.variables?.programItemId
    : undefined;

  if (!program) {
    return (
      <EmptyTodayCard
        timeInput={timeInput}
        setTimeInput={setTimeInput}
        timeBusy={timeBusy}
        timeValid={timeValid}
        onRegenerate={handleRegenerateWithTime}
      />
    );
  }

  const due = dueReviews.data ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <TodayHeader
        program={program}
        due={due}
        timeInput={timeInput}
        setTimeInput={setTimeInput}
        timeBusy={timeBusy}
        timeValid={timeValid}
        onRegenerate={handleRegenerateWithTime}
      />

      {programNotice && (
        <ProgramActionNotice
          notice={programNotice}
          onDismiss={() => setProgramNotice(null)}
        />
      )}

      {(availability.error ||
        availabilityOverrides.error ||
        forecast.error ||
        weeklyFocus.error) && (
        <StatusMessage tone="error" heading="Program controls unavailable">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Today is still usable, but the weekly controls could not be
              loaded.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void availability.refetch();
                void availabilityOverrides.refetch();
                void forecast.refetch();
                void weeklyFocus.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        </StatusMessage>
      )}

      {availability.data?.promptResolvedAt == null &&
        !availabilityDismissed && (
          <AvailabilityPrompt
            pendingMode={
              saveAvailability.isPending
                ? saveAvailability.variables?.mode
                : undefined
            }
            onFlexible={() =>
              saveAvailability.mutate({
                mode: "flexible",
                preferredWeekdays: [],
                defaultMinutesByDay: {},
              })
            }
            onWeekdays={() =>
              saveAvailability.mutate({
                mode: "preferred",
                preferredWeekdays: [1, 2, 3, 4, 5],
                defaultMinutesByDay: {},
              })
            }
            onLater={() => {
              setAvailabilityDismissed(true);
              setProgramNotice({
                tone: "neutral",
                heading: "No schedule chosen",
                message:
                  "Nothing changed. Mainline will ask again the next time you open Today.",
              });
            }}
          />
        )}

      {forecast.data && forecast.data.length > 0 && (
        <WeekFile
          days={forecast.data}
          unavailableDates={
            new Set(
              (availabilityOverrides.data ?? [])
                .filter((override) => override.unavailable)
                .map((override) => override.date),
            )
          }
          pendingDate={
            saveOverride.isPending
              ? saveOverride.variables?.date
              : removeOverride.isPending
                ? removeOverride.variables?.date
                : undefined
          }
          onMarkUnavailable={(date) =>
            saveOverride.mutate({ date, minutes: null, unavailable: true })
          }
          onRestore={(date) => removeOverride.mutate({ date })}
        />
      )}

      {weeklyFocus.data && (
        <WeeklyDirection
          focus={weeklyFocus.data}
          focusLabels={weeklyFocus.data.focusLabels}
          optionsOpen={focusOptionsOpen}
          pendingFocus={
            selectFocus.isPending
              ? selectFocus.variables?.focusAreas.join("|")
              : undefined
          }
          onToggleOptions={() => setFocusOptionsOpen((open) => !open)}
          onKeep={() => {
            setFocusOptionsOpen(false);
            setProgramNotice({
              tone: "neutral",
              heading: "Current focus kept",
              message: "Nothing changed. You can compare other options later.",
            });
          }}
          onSelect={(focusAreas) =>
            selectFocus.mutate({
              weeklyFocusId: weeklyFocus.data!.id,
              focusAreas,
            })
          }
        />
      )}

      <TodayBlockList
        items={program.items}
        ownedBooks={ownedBooks}
        libraryLoading={library.isLoading}
        pendingItemId={pendingItemId}
        onLogOutcome={(input) => log.mutate(input)}
        onBookLogged={() => {
          void utils.library.get.invalidate();
          void utils.program.getToday.invalidate();
          void utils.tracker.dueReviews.invalidate();
        }}
      />

      {log.data && log.data.scheduledReviews > 0 && (
        <p className="text-graphite border-l-2 border-evergreen/40 pl-3 font-mono text-xs leading-relaxed">
          Training logged. Review work queued to come back spaced over the next
          days.
        </p>
      )}

      {log.error && (
        <StatusMessage tone="error" heading="Training not logged">
          {log.error.message}
        </StatusMessage>
      )}

      {log.data?.rewardEvents.map((event, index) => (
        <p
          key={`${event.type}-${index}`}
          className="text-ink border-l-2 border-evergreen/40 pl-3 font-serif text-sm leading-relaxed"
        >
          {event.text}
        </p>
      ))}

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3 border-t border-line/80 pt-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={replan.isPending}
          onClick={() => replan.mutate()}
        >
          {replan.isPending ? "Replanning..." : "Replan remaining work"}
        </Button>
        <span className="text-graphite min-w-0 font-mono text-xs">
          Built from your data on {program.createdAt.toLocaleDateString()} ·{" "}
          {program.methodologyVersion}
        </span>
      </div>
    </div>
  );
}

function ProgramActionNotice({
  notice,
  onDismiss,
}: {
  notice: ProgramNotice;
  onDismiss: () => void;
}) {
  return (
    <StatusMessage
      tone={notice.tone}
      heading={notice.heading}
      className="shadow-sheet"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <span>{notice.message}</span>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </StatusMessage>
  );
}

function AvailabilityPrompt({
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

function WeekFile({
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

function WeeklyDirection({
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

function EmptyTodayCard({
  timeInput,
  setTimeInput,
  timeBusy,
  timeValid,
  onRegenerate,
}: {
  timeInput: string;
  setTimeInput: (value: string) => void;
  timeBusy: boolean;
  timeValid: boolean;
  onRegenerate: () => void;
}) {
  return (
    <Card gutter="A" className="p-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-xl font-semibold text-ink">
            No session yet
          </h2>
          <p className="text-graphite mt-2 text-sm leading-relaxed">
            Build your first training session from your calibration, your games,
            and the time you have. You can regenerate it any time.
          </p>
        </div>
        <TimeEdit
          timeInput={timeInput}
          setTimeInput={setTimeInput}
          timeBusy={timeBusy}
          timeValid={timeValid}
          onRegenerate={onRegenerate}
        />
      </div>
    </Card>
  );
}

function TodayHeader({
  program,
  due,
  timeInput,
  setTimeInput,
  timeBusy,
  timeValid,
  onRegenerate,
}: {
  program: TodayProgram;
  due: number;
  timeInput: string;
  setTimeInput: (value: string) => void;
  timeBusy: boolean;
  timeValid: boolean;
  onRegenerate: () => void;
}) {
  const [goalOpen, setGoalOpen] = useState(false);
  return (
    <section className="bg-card focus-card rounded-lg border p-4 shadow-sheet settle sm:p-5">
      <div className="flex min-w-0 flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Today&apos;s prescription</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-serif text-xl font-semibold leading-tight text-ink sm:text-2xl">
              {sessionMinuteCap(program)}
            </h2>
            <span className="text-graphite font-mono text-xs">
              ordered training blocks
            </span>
          </div>
        </div>
        <TimeEdit
          timeInput={timeInput}
          setTimeInput={setTimeInput}
          timeBusy={timeBusy}
          timeValid={timeValid}
          onRegenerate={onRegenerate}
          compact
        />
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setGoalOpen((open) => !open)}
          aria-expanded={goalOpen}
          aria-controls="today-process-goal"
          className="eyebrow flex cursor-pointer items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <span aria-hidden className="text-evergreen not-italic">
            ∴
          </span>
          Today&apos;s goal
          <span aria-hidden className="text-xs">
            {goalOpen ? "▼" : "▶"}
          </span>
        </button>
        {goalOpen && (
          <p
            id="today-process-goal"
            className="text-ink mt-2 font-serif text-[0.95rem] leading-relaxed"
          >
            {program.honesty.processGoal}
          </p>
        )}
      </div>

      <TransparencyCard
        rationaleText={program.honesty.expectations}
        evidenceGrade={program.honesty.expectationsEvidence.evidenceGrade}
        evidenceTier={program.honesty.expectationsEvidence.evidenceTier}
        citationKey={program.honesty.expectationsEvidence.citationKey}
        citationSource={program.honesty.expectationsEvidence.citationSource}
        confidence={program.honesty.expectationsEvidence.confidence}
        soften={program.honesty.expectationsEvidence.soften}
        flag={program.honesty.expectationsEvidence.flag}
        hideToggle
        className="mt-5"
      />

      {due > 0 && (
        <p className="text-evergreen mt-3 font-mono text-xs">
          Review queue has work ready. Regenerate to pull it into this session.
        </p>
      )}
    </section>
  );
}

function TimeEdit({
  timeInput,
  setTimeInput,
  timeBusy,
  timeValid,
  onRegenerate,
  compact = false,
}: {
  timeInput: string;
  setTimeInput: (value: string) => void;
  timeBusy: boolean;
  timeValid: boolean;
  onRegenerate: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2",
        compact && "w-full sm:w-auto sm:items-end",
      )}
    >
      <label htmlFor="today-time-input" className="font-serif text-sm text-ink">
        How much time do you have today?
      </label>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          id="today-time-input"
          type="number"
          min={5}
          max={1440}
          value={timeInput}
          onChange={(event) => setTimeInput(event.target.value)}
          disabled={timeBusy}
          aria-invalid={!timeValid && timeInput !== ""}
          aria-describedby="today-time-help"
          className="h-9 w-20 font-mono text-sm"
        />
        <span className="text-graphite font-mono text-xs">min</span>
        <Button
          type="button"
          size="sm"
          variant={!timeValid && !timeBusy ? "outline" : "default"}
          disabled={timeBusy || !timeValid}
          onClick={onRegenerate}
          className={cn(
            !timeValid && !timeBusy && "border-evergreen/30 text-evergreen/50",
          )}
        >
          {timeBusy ? "Regenerating..." : "Regenerate"}
        </Button>
      </div>
      <p
        id="today-time-help"
        className="text-graphite font-mono text-[0.65rem]"
      >
        5-1440 min ({formatMinuteCap(1440)})
      </p>
    </div>
  );
}

function TodayBlockList({
  items,
  ownedBooks,
  libraryLoading,
  pendingItemId,
  onLogOutcome,
  onBookLogged,
}: {
  items: TodayItem[];
  ownedBooks: OwnedBook[];
  libraryLoading: boolean;
  pendingItemId?: string;
  onLogOutcome: (input: LogOutcomeInput) => void;
  onBookLogged: () => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-3"
      aria-label="Today training blocks"
    >
      {items.map((item, index) => (
        <TodayBlockCard
          key={item.id}
          item={item}
          index={index}
          ownedBooks={ownedBooks}
          libraryLoading={libraryLoading}
          busy={pendingItemId === item.id}
          onLogOutcome={onLogOutcome}
          onBookLogged={onBookLogged}
        />
      ))}
    </div>
  );
}

function TodayBlockCard({
  item,
  index,
  ownedBooks,
  libraryLoading,
  busy,
  onLogOutcome,
  onBookLogged,
}: {
  item: TodayItem;
  index: number;
  ownedBooks: OwnedBook[];
  libraryLoading: boolean;
  busy: boolean;
  onLogOutcome: (input: LogOutcomeInput) => void;
  onBookLogged: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = `today-block-details-${item.id}`;
  const closed = isClosedItem(item);
  const isBook = item.activityType === "book";
  const scheduledBook = item.bookResource ?? item.params.bookResource ?? null;
  const bookOptions = scheduledBook ? [scheduledBook] : ownedBooks;
  const meta = itemMeta(item);

  return (
    <Card
      gutter={asGrade(item.evidenceGrade)}
      provisional={item.soften}
      className={cn("settle min-w-0", closed && "opacity-75")}
      style={{ animationDelay: `${(index + 1) * 70}ms` }}
    >
      <article className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-line bg-paper/70 font-mono text-xs tabular-nums text-evergreen"
              aria-label={`Block ${index + 1}`}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="break-words font-serif text-base font-semibold leading-snug text-ink sm:text-lg">
                {item.label}
              </h2>
              <div className="text-graphite mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs tabular-nums">
                <span>{formatMinuteCap(item.estMinutes)}</span>
                <span aria-hidden="true">·</span>
                <span>{rowStatusLabel(item)}</span>
              </div>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-start gap-2 sm:justify-end">
            <TodayPrimaryAction
              item={item}
              busy={busy}
              onLogOutcome={onLogOutcome}
            />
            {closed && <FinalStatusPill item={item} />}
          </div>
        </div>

        <p className="text-graphite min-w-0 text-sm leading-relaxed">
          {itemSummary(item)}
        </p>

        {meta.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {meta.map((label) => (
              <span
                key={label}
                className="rounded-sm border border-line/80 bg-paper/50 px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-graphite"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-line/80 pt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen
              ? "Hide details"
              : isBook
                ? "Why / log"
                : "Why / evidence"}
          </Button>
          <TodayLogActions
            item={item}
            busy={busy}
            onLogOutcome={onLogOutcome}
          />
        </div>

        {detailsOpen && (
          <TodayBlockDetails
            id={detailsId}
            item={item}
            isBook={isBook}
            libraryLoading={libraryLoading}
            bookOptions={bookOptions}
            scheduledBook={scheduledBook}
            busy={busy}
            onBookLogged={onBookLogged}
            onSkip={() =>
              onLogOutcome({ programItemId: item.id, type: "skip" })
            }
          />
        )}
      </article>
    </Card>
  );
}

function TodayPrimaryAction({
  item,
  busy,
  onLogOutcome,
}: {
  item: TodayItem;
  busy: boolean;
  onLogOutcome: (input: LogOutcomeInput) => void;
}) {
  const kind = primaryActionKind(item);
  if (kind === null) return null;

  if (kind === "internal" && item.url) {
    return (
      <Link
        href={item.url}
        className={cn(
          buttonVariants({ variant: "default", size: "sm" }),
          "shrink-0",
        )}
      >
        {activityActionLabel(item)}
      </Link>
    );
  }

  if (kind === "external" && item.externalUrl) {
    return (
      <a
        href={item.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({
            variant: item.activityType === "play_game" ? "default" : "outline",
            size: "sm",
          }),
          "shrink-0",
        )}
      >
        {item.externalLabel ?? "Open"}
      </a>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={busy}
      onClick={() =>
        onLogOutcome({
          programItemId: item.id,
          type: completionEventType(item),
        })
      }
    >
      Mark done
    </Button>
  );
}

function TodayLogActions({
  item,
  busy,
  onLogOutcome,
}: {
  item: TodayItem;
  busy: boolean;
  onLogOutcome: (input: LogOutcomeInput) => void;
}) {
  if (isClosedItem(item)) return null;

  const actions = [];

  if (isPuzzleAttemptLoggable(item) && !isAutoLoggedInternal(item)) {
    actions.push(
      <Button
        key="solved"
        type="button"
        size="sm"
        disabled={busy}
        onClick={() =>
          onLogOutcome({
            programItemId: item.id,
            type: "puzzle_attempt",
            correct: true,
          })
        }
      >
        Solved
      </Button>,
      <Button
        key="struggled"
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          onLogOutcome({
            programItemId: item.id,
            type: "puzzle_attempt",
            correct: false,
          })
        }
      >
        Struggled
      </Button>,
    );
  } else if (
    item.activityType !== "book" &&
    primaryActionKind(item) !== "completion" &&
    !isAutoLoggedInternal(item)
  ) {
    actions.push(
      <Button
        key="done"
        type="button"
        size="sm"
        disabled={busy}
        onClick={() =>
          onLogOutcome({
            programItemId: item.id,
            type: completionEventType(item),
          })
        }
      >
        Mark done
      </Button>,
    );
  }

  actions.push(
    <Button
      key="skip"
      type="button"
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={() => onLogOutcome({ programItemId: item.id, type: "skip" })}
    >
      Skip
    </Button>,
  );

  return <>{actions}</>;
}

function FinalStatusPill({ item }: { item: TodayItem }) {
  return (
    <span className="rounded-sm border border-line bg-paper/70 px-2.5 py-1.5 font-mono text-xs text-graphite">
      {rowStatusLabel(item)}
    </span>
  );
}

function TodayBlockDetails({
  id,
  item,
  isBook,
  libraryLoading,
  bookOptions,
  scheduledBook,
  busy,
  onBookLogged,
  onSkip,
}: {
  id: string;
  item: TodayItem;
  isBook: boolean;
  libraryLoading: boolean;
  bookOptions: OwnedBook[];
  scheduledBook?: OwnedBook | null;
  busy: boolean;
  onBookLogged: () => void;
  onSkip: () => void;
}) {
  const closed = isClosedItem(item);

  return (
    <div
      id={id}
      className="flex min-w-0 flex-col gap-4 rounded-md bg-paper/45 p-3 sm:p-4"
    >
      <TransparencyCard
        rationaleText={item.rationaleText}
        evidenceGrade={item.evidenceGrade}
        evidenceTier={item.evidenceTier}
        citationKey={item.citationKey}
        citationSource={item.citationSource}
        confidence={item.confidence}
        soften={item.soften}
        defaultCollapsed={false}
      />

      {isBook && !closed ? (
        scheduledBook == null && libraryLoading ? (
          <p className="text-graphite font-mono text-xs">
            Loading owned books...
          </p>
        ) : bookOptions.length === 0 ? (
          <div className="flex flex-col gap-2 border-t border-line/80 pt-4">
            <p className="text-graphite font-serif text-sm">
              You don&apos;t own any recommended books at your level yet. Add
              books you own in Settings, then regenerate Today.
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onSkip}
              className="self-start"
            >
              Skip
            </Button>
          </div>
        ) : (
          <BookLogForm
            item={item}
            ownedBooks={bookOptions}
            scheduledBook={scheduledBook}
            onSuccess={onBookLogged}
            onSkip={onSkip}
            busy={busy}
          />
        )
      ) : null}
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
  scheduledBook,
  onSuccess,
  onSkip,
  busy,
}: {
  item: TodayItem;
  ownedBooks: OwnedBook[];
  scheduledBook?: OwnedBook | null;
  onSuccess: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const bookOptions = scheduledBook ? [scheduledBook] : ownedBooks;
  const suggestedMinutes =
    typeof item.params.studyMinutes === "number"
      ? item.params.studyMinutes
      : item.estMinutes;
  const defaultMinutes =
    suggestedMinutes != null ? String(Math.round(suggestedMinutes)) : "";
  const firstBookId = bookOptions[0]?.id ?? "";

  const [bookId, setBookId] = useState<string>(firstBookId);
  const [unitCount, setUnitCount] = useState<string>("");
  const [successPct, setSuccessPct] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");
  const [cycle, setCycle] = useState<string>("");
  const [minutes, setMinutes] = useState<string>(defaultMinutes);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setBookId(firstBookId);
  }, [firstBookId]);

  useEffect(() => {
    setMinutes(defaultMinutes);
  }, [defaultMinutes, item.id]);

  const log = trpc.library.logSession.useMutation({
    onSuccess: () => {
      setFormError(null);
      onSuccess();
      setUnitCount("");
      setChapter("");
      setMinutes(defaultMinutes);
      setCycle("");
      setSuccessPct("");
    },
    onError: (error) => setFormError(error.message),
  });

  const selectedBook =
    bookOptions.find((b) => b.id === bookId) ?? bookOptions[0];
  const unitLabel =
    selectedBook?.studyUnit === "games" ? "Games studied" : "Exercises done";
  const unitPlaceholder =
    selectedBook?.studyUnit === "games" ? "e.g. 3" : "e.g. 10";

  const onLog = () => {
    setFormError(null);
    const resourceRefId = bookId || firstBookId;
    if (!resourceRefId) {
      setFormError("Choose a book before logging this session.");
      return;
    }
    const count = Number(unitCount);
    if (!unitCount || !Number.isInteger(count) || count <= 0) {
      setFormError(`Enter a whole number of ${unitLabel.toLowerCase()}.`);
      return;
    }
    const duration = minutes ? Number(minutes) : undefined;
    if (
      duration !== undefined &&
      (!Number.isFinite(duration) || duration < 0)
    ) {
      setFormError("Enter zero or more minutes.");
      return;
    }
    const pct = successPct ? Number(successPct) : NaN;
    log.mutate({
      programItemId: item.id,
      resourceRefId,
      successRate: !isNaN(pct) && Number.isFinite(pct) ? pct / 100 : undefined,
      durationMin: duration,
      woodpeckerCycle: cycle ? Number(cycle) : undefined,
      position: {
        unitCount: count,
        chapter: chapter ? Number(chapter) : undefined,
      },
    });
  };

  return (
    <form
      className="flex flex-col gap-4 border-t border-line/80 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        onLog();
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-serif text-sm font-semibold text-ink">
          Log your study session
        </h3>
        {scheduledBook && (
          <p className="text-graphite font-serif text-sm leading-relaxed">
            Today&apos;s external work is this book, not a generic drill. Study
            it for the planned minutes, then log what you completed.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {scheduledBook ? (
          <div className="flex flex-col gap-1.5 rounded-md border border-line/80 bg-paper/40 p-3 font-serif text-xs">
            <span className="eyebrow !text-[0.62rem]">Book</span>
            <span className="text-ink text-sm leading-snug">
              {scheduledBook.title}
            </span>
            {defaultMinutes && (
              <span className="text-graphite font-mono text-[0.7rem]">
                Planned: up to {defaultMinutes} min
              </span>
            )}
          </div>
        ) : (
          <label className="flex flex-col gap-1.5 font-serif text-xs">
            <span className="eyebrow !text-[0.62rem]">Book</span>
            <Select value={bookId} onChange={(e) => setBookId(e.target.value)}>
              {ownedBooks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">
            {unitLabel} <span className="text-clay">*</span>
          </span>
          <Input
            type="number"
            min={1}
            placeholder={unitPlaceholder}
            value={unitCount}
            onChange={(e) => {
              setUnitCount(e.target.value);
              setFormError(null);
            }}
            required
            aria-invalid={formError != null}
            aria-describedby={formError ? "book-log-error" : undefined}
            className="text-ink text-sm h-9"
          />
        </label>
        <label className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">
            Exercises solved (%) (optional)
          </span>
          <Select
            value={successPct}
            onChange={(e) => setSuccessPct(e.target.value)}
          >
            <option value="">Optional (select...)</option>
            {["50", "60", "70", "75", "80", "85", "90", "95"].map((p) => (
              <option key={p} value={p}>
                {p}%
              </option>
            ))}
          </Select>
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
            onChange={(e) => {
              setMinutes(e.target.value);
              setFormError(null);
            }}
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
        <Button type="submit" disabled={log.isPending || busy} size="sm">
          {log.isPending ? "Logging…" : "Log study session"}
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

      {formError && (
        <StatusMessage id="book-log-error" tone="error">
          {formError}
        </StatusMessage>
      )}

      {log.data?.feedback && (
        <p className="text-graphite border-l-2 border-evergreen/40 pl-3 font-serif text-sm leading-relaxed">
          {log.data.feedback.verdict === "too_easy" &&
            "That book looks a bit easy. Consider a harder one."}
          {log.data.feedback.verdict === "too_hard" &&
            "That book looks tough right now. An easier one will help."}
          {log.data.feedback.verdict === "calibrated" &&
            "Nicely calibrated. That difficulty is right where learning is fastest."}
        </p>
      )}
    </form>
  );
}
