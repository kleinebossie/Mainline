"use client";

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc/react";
import {
  MAX_MINUTES_PER_DAY,
  MIN_MINUTES_PER_DAY,
} from "@/lib/constraint-limits";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import {
  EmptyTodayCard,
  TodayBlockList,
  TodayHeader,
} from "@/app/today/today-session";
import { ProgramArchive } from "@/app/today/program-history";
import { isSameUtcDay } from "@/app/today/today-copy";

type ProgramNotice = {
  tone: "success" | "error" | "neutral";
  heading: string;
  message: string;
};

export function Today() {
  const utils = trpc.useUtils();
  const rolloverAttemptedFor = useRef<string | null>(null);
  const [programNotice, setProgramNotice] = useState<ProgramNotice | null>(
    null,
  );
  const today = trpc.program.getToday.useQuery();
  const history = trpc.program.history.useInfiniteQuery(
    { limit: 8 },
    { getNextPageParam: (page) => page.nextCursor ?? undefined },
  );
  const replan = trpc.program.replan.useMutation({
    onMutate: () => setProgramNotice(null),
    onSuccess: async () => {
      await Promise.all([
        utils.program.getToday.invalidate(),
        utils.program.history.invalidate(),
      ]);
      setProgramNotice({
        tone: "success",
        heading: "Plan updated",
        message: "Remaining work now fits the new time budget.",
      });
    },
    onError: () =>
      setProgramNotice({
        tone: "error",
        heading: "Plan not updated",
        message: "Your existing session is unchanged. Try the update again.",
      }),
  });
  const dueReviews = trpc.tracker.dueReviews.useQuery();
  const generate = trpc.program.generate.useMutation({
    onMutate: () => setProgramNotice(null),
    onSuccess: async () => {
      await Promise.all([
        utils.program.getToday.invalidate(),
        utils.tracker.dueReviews.invalidate(),
        utils.program.history.invalidate(),
      ]);
      setProgramNotice({
        tone: "success",
        heading: "Session built",
        message: "Today is ready.",
      });
    },
    onError: () =>
      setProgramNotice({
        tone: "error",
        heading: "Session not built",
        message: "Your time budget was saved. Try building the session again.",
      }),
  });
  const program = today.data;
  const staleProgram =
    program != null && !isSameUtcDay(program.scheduledDate, new Date());

  useEffect(() => {
    if (
      !staleProgram ||
      generate.isPending ||
      rolloverAttemptedFor.current === program.id
    ) {
      return;
    }
    rolloverAttemptedFor.current = program.id;
    generate.mutate();
  }, [generate, program, staleProgram]);
  const log = trpc.tracker.logOutcome.useMutation({
    onSuccess: (_result, variables) => {
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
      void utils.program.history.invalidate();
      if (variables.type === "skip") {
        setProgramNotice({
          tone: "neutral",
          heading: "Block skipped",
          message:
            "It is closed for today. Use Undo skip on the block to restore it.",
        });
      }
    },
  });
  const undoSkip = trpc.tracker.undoSkip.useMutation({
    onMutate: () => setProgramNotice(null),
    onSuccess: async () => {
      await Promise.all([
        utils.program.getToday.invalidate(),
        utils.program.history.invalidate(),
      ]);
      setProgramNotice({
        tone: "success",
        heading: "Skip undone",
        message: "The block is back in your remaining work.",
      });
    },
    onError: () =>
      setProgramNotice({
        tone: "error",
        heading: "Skip not undone",
        message: "The block stayed skipped. Try the undo again.",
      }),
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

  const saveTimeThen = (next: () => void) => {
    if (!constraints.data || !timeValid) return;
    saveConstraints.mutate(
      { ...constraints.data, minutesPerDay: requestedMinutes },
      {
        onSuccess: next,
      },
    );
  };

  const handleBuildWithTime = () => saveTimeThen(() => generate.mutate());
  const handleUpdateWithTime = () => saveTimeThen(() => replan.mutate());
  const timeChanged = minutes != null && requestedMinutes !== minutes;
  const timeBusy =
    saveConstraints.isPending || generate.isPending || replan.isPending;

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

  const historyEntries =
    history.data?.pages.flatMap((page) => page.entries) ?? [];
  const pendingItemId = log.isPending
    ? log.variables?.programItemId
    : undoSkip.isPending
      ? undoSkip.variables?.programItemId
      : undefined;

  if (program && staleProgram) {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        {generate.error ? (
          <StatusMessage tone="error" heading="Today could not be prepared">
            <div className="flex flex-wrap items-center gap-3">
              <span>Your earlier session is safe in History.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  rolloverAttemptedFor.current = program.id;
                  generate.mutate();
                }}
              >
                Try again
              </Button>
            </div>
          </StatusMessage>
        ) : (
          <StatusMessage tone="loading">
            Preparing today&apos;s session…
          </StatusMessage>
        )}
        <ProgramArchive
          entries={historyEntries}
          currentProgramId=""
          loading={history.isLoading}
          error={history.isError}
          hasMore={history.hasNextPage === true}
          loadingMore={history.isFetchingNextPage}
          onRetry={() => void history.refetch()}
          onLoadMore={() => void history.fetchNextPage()}
        />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        <EmptyTodayCard
          timeInput={timeInput}
          setTimeInput={setTimeInput}
          timeBusy={timeBusy}
          timeValid={timeValid}
          onRegenerate={handleBuildWithTime}
        />
        <ProgramArchive
          entries={historyEntries}
          currentProgramId=""
          loading={history.isLoading}
          error={history.isError}
          hasMore={history.hasNextPage === true}
          loadingMore={history.isFetchingNextPage}
          onRetry={() => void history.refetch()}
          onLoadMore={() => void history.fetchNextPage()}
        />
      </div>
    );
  }

  const due = dueReviews.data ?? 0;
  const currentHistory = historyEntries.find(
    (entry) => entry.id === program.id,
  );

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <TodayHeader
        program={program}
        due={due}
        actualMinutes={currentHistory?.actualMinutes ?? null}
        actualMeasuredEvents={currentHistory?.measuredEventCount ?? 0}
        actualEventCount={currentHistory?.eventCount ?? 0}
        actualMeasurementTruncated={
          currentHistory?.measurementTruncated ?? false
        }
        historyLoading={history.isLoading}
        historyError={history.isError}
        timeInput={timeInput}
        setTimeInput={setTimeInput}
        timeBusy={timeBusy}
        timeValid={timeValid}
        timeChanged={timeChanged}
        onRegenerate={handleUpdateWithTime}
      />

      {programNotice && (
        <ProgramActionNotice
          notice={programNotice}
          onDismiss={() => setProgramNotice(null)}
        />
      )}

      <div id="today-work" className="scroll-mt-24">
        <TodayBlockList
          items={program.items}
          ownedBooks={ownedBooks}
          libraryLoading={library.isLoading}
          pendingItemId={pendingItemId}
          onLogOutcome={(input) => log.mutate(input)}
          onUndoSkip={(programItemId) => undoSkip.mutate({ programItemId })}
          onBookLogged={() => {
            void utils.library.get.invalidate();
            void utils.program.getToday.invalidate();
            void utils.tracker.dueReviews.invalidate();
            void utils.program.history.invalidate();
          }}
        />
      </div>

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

      <div id="program-history" className="scroll-mt-24">
        <ProgramArchive
          entries={historyEntries}
          currentProgramId={program.id}
          loading={history.isLoading}
          error={history.isError}
          hasMore={history.hasNextPage === true}
          loadingMore={history.isFetchingNextPage}
          onRetry={() => void history.refetch()}
          onLoadMore={() => void history.fetchNextPage()}
        />
      </div>

      <p className="text-graphite font-mono text-xs">
        Built {program.createdAt.toLocaleDateString()} ·{" "}
        {program.methodologyVersion}
      </p>
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
