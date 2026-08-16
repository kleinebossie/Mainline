"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc/react";
import {
  MAX_MINUTES_PER_DAY,
  MIN_MINUTES_PER_DAY,
} from "@/lib/constraint-limits";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
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
    onSuccess: (data) => {
      if (data) {
        utils.program.getToday.setData(undefined, data);
      }
      void utils.program.getToday.invalidate();
      void utils.program.history.invalidate();
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
    onSuccess: (data) => {
      if (data) {
        utils.program.getToday.setData(undefined, data);
      }
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
      void utils.program.history.invalidate();
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
      if (variables.programItemId) {
        utils.program.getToday.setData(undefined, (current) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((item) =>
              item.id === variables.programItemId
                ? {
                    ...item,
                    status: variables.type === "skip" ? "skipped" : "done",
                  }
                : item,
            ),
          };
        });
      }
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
    onSuccess: (_result, variables) => {
      if (variables.programItemId) {
        utils.program.getToday.setData(undefined, (current) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((item) =>
              item.id === variables.programItemId
                ? {
                    ...item,
                    status: "pending",
                  }
                : item,
            ),
          };
        });
      }
      void utils.program.getToday.invalidate();
      void utils.program.history.invalidate();
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
  const supportingError =
    constraints.error ?? library.error ?? dueReviews.error ?? null;

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
      <ErrorNotice
        error={today.error}
        heading="Session unavailable"
        message="Mainline could not load today's session. Try the session again."
        onRetry={() => void today.refetch()}
        retrying={today.isFetching}
        retryLabel="Reload session"
      />
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
          <ErrorNotice
            error={generate.error}
            heading="Today could not be prepared"
            message="Your earlier session is safe in History. Try building today's session again."
            onRetry={() => {
              rolloverAttemptedFor.current = program.id;
              generate.mutate();
            }}
            retrying={generate.isPending}
            retryLabel="Build today's session"
          />
        ) : (
          <StatusMessage tone="loading">
            Preparing today&apos;s session…
          </StatusMessage>
        )}
        <ProgramArchive
          entries={historyEntries}
          currentProgramId=""
          loading={history.isLoading}
          error={history.error}
          hasMore={history.hasNextPage === true}
          loadingMore={history.isFetching}
          onRetry={() => void history.refetch()}
          onLoadMore={() => void history.fetchNextPage()}
        />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        {supportingError && (
          <ErrorNotice
            error={supportingError}
            heading="Session details unavailable"
            message="Mainline could not load your time budget, books, or review queue. Reload those details before building a session."
            onRetry={() => {
              void constraints.refetch();
              void library.refetch();
              void dueReviews.refetch();
            }}
            retrying={
              constraints.isFetching ||
              library.isFetching ||
              dueReviews.isFetching
            }
            retryLabel="Reload session details"
          />
        )}
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
          error={history.error}
          hasMore={history.hasNextPage === true}
          loadingMore={history.isFetching}
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

      <TrainingFeedbackPrompt
        refreshKey={program.items
          .map((item) => `${item.id}:${item.status}`)
          .join("|")}
      />

      {supportingError && (
        <ErrorNotice
          error={supportingError}
          heading="Some session details are unavailable"
          message="Your session is still usable, but Mainline could not load your time budget, books, or review count."
          onRetry={() => {
            void constraints.refetch();
            void library.refetch();
            void dueReviews.refetch();
          }}
          retrying={
            constraints.isFetching ||
            library.isFetching ||
            dueReviews.isFetching
          }
          retryLabel="Reload session details"
        />
      )}

      <div id="today-work" className="scroll-mt-24">
        <TodayBlockList
          items={program.items}
          ownedBooks={ownedBooks}
          libraryLoading={library.isLoading}
          pendingItemId={pendingItemId}
          onLogOutcome={(input) =>
            log.mutate({ ...input, requestId: crypto.randomUUID() })
          }
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
        <ErrorNotice
          error={log.error}
          heading="Training not logged"
          message="The block is still open and your progress was not changed. Try logging it again."
          onRetry={() => {
            if (log.variables) log.mutate(log.variables);
          }}
          retrying={log.isPending}
          retryLabel="Try logging again"
        />
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
          error={history.error}
          hasMore={history.hasNextPage === true}
          loadingMore={history.isFetching}
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

function TrainingFeedbackPrompt({ refreshKey }: { refreshKey: string }) {
  const lastAttemptedFor = useRef<string | null>(null);
  const claim = trpc.feedback.claimPrompt.useMutation({ retry: 2 });
  const mutate = claim.mutate;
  useEffect(() => {
    if (lastAttemptedFor.current === refreshKey) return;
    lastAttemptedFor.current = refreshKey;
    mutate();
  }, [mutate, refreshKey]);

  const prompt = claim.data;
  if (!prompt) return null;
  return (
    <aside className="rounded-md border border-line bg-paper/60 px-4 py-3 shadow-sheet">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Quick check-in</p>
          <p className="text-graphite mt-1 font-serif text-sm leading-relaxed">
            {prompt.text}
          </p>
          <p className="text-graphite mt-1 font-mono text-[0.65rem] uppercase tracking-[0.1em]">
            Grade {prompt.grade} · Tier {prompt.tier} · {prompt.citationKey}
          </p>
        </div>
        <Link
          href={`/settings?feedbackFrom=%2Ftoday&source=${
            prompt.kind === "weekly" ? "weekly_check_in" : "contextual"
          }${
            prompt.programId
              ? `&programId=${encodeURIComponent(prompt.programId)}`
              : ""
          }${
            prompt.programItemId
              ? `&programItemId=${encodeURIComponent(prompt.programItemId)}`
              : ""
          }#training-fit`}
          className="shrink-0 rounded-md border border-ink/25 px-3 py-2 font-mono text-xs text-ink transition-colors hover:border-ink/50 hover:bg-ink/[0.04]"
        >
          Open feedback settings
        </Link>
      </div>
    </aside>
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
