"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/react";
import {
  MAX_MINUTES_PER_DAY,
  MIN_MINUTES_PER_DAY,
} from "@/lib/constraint-limits";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { formatForecastDate, humanizeFocusArea } from "@/app/today/today-copy";
import {
  EmptyTodayCard,
  TodayBlockList,
  TodayHeader,
} from "@/app/today/today-session";
import {
  AvailabilityPrompt,
  WeekFile,
  WeeklyDirection,
} from "@/app/today/today-week";

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

  const requestedMinutes = Number(timeInput);
  const timeValid =
    Number.isInteger(requestedMinutes) &&
    requestedMinutes >= MIN_MINUTES_PER_DAY &&
    requestedMinutes <= MAX_MINUTES_PER_DAY;

  const handleRegenerateWithTime = () => {
    if (!constraints.data || !timeValid) return;
    saveConstraints.mutate(
      { ...constraints.data, minutesPerDay: requestedMinutes },
      {
        onSuccess: () => {
          generate.mutate();
        },
      },
    );
  };

  const timeBusy = saveConstraints.isPending || generate.isPending;

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
            disabled={today.isFetching}
            onClick={() => void today.refetch()}
          >
            {today.isFetching ? "Retrying..." : "Try again"}
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
  const weeklyFocusData = weeklyFocus.data;

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
              disabled={
                availability.isFetching ||
                availabilityOverrides.isFetching ||
                forecast.isFetching ||
                weeklyFocus.isFetching
              }
              onClick={() => {
                void availability.refetch();
                void availabilityOverrides.refetch();
                void forecast.refetch();
                void weeklyFocus.refetch();
              }}
            >
              {availability.isFetching ||
              availabilityOverrides.isFetching ||
              forecast.isFetching ||
              weeklyFocus.isFetching
                ? "Retrying..."
                : "Try again"}
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

      {weeklyFocusData && (
        <WeeklyDirection
          focus={weeklyFocusData}
          focusLabels={weeklyFocusData.focusLabels}
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
              weeklyFocusId: weeklyFocusData.id,
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
