"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TransparencyCard } from "@/components/transparency-card";
import type { TodayItem, TodayProgram } from "@/server/program";
import { cn } from "@/lib/utils";
import {
  activityActionLabel,
  asGrade,
  completionEventType,
  formatMinuteCap,
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
      <p className="text-graphite font-mono text-sm">Loading your session...</p>
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
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? "Regenerating..." : "Regenerate session"}
        </Button>
        <span className="text-graphite min-w-0 font-mono text-xs">
          Built from your data on {program.createdAt.toLocaleDateString()} ·{" "}
          {program.methodologyVersion}
        </span>
      </div>
    </div>
  );
}

function EmptyTodayCard({
  timeInput,
  setTimeInput,
  timeBusy,
  onRegenerate,
}: {
  timeInput: string;
  setTimeInput: (value: string) => void;
  timeBusy: boolean;
  onRegenerate: () => void;
}) {
  return (
    <Card gutter="A" className="p-5">
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
          timeValid={timeInput !== ""}
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
  return (
    <section className="bg-card focus-card rounded-lg border p-4 shadow-sheet settle sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
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
      <p className="mt-3 font-serif text-base leading-snug text-ink">
        {program.honesty.processGoal}
      </p>
      <p className="text-graphite mt-2 text-sm leading-relaxed">
        {program.honesty.expectations}
      </p>
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
      className={cn("flex min-w-0 flex-col gap-2", compact && "sm:items-end")}
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
      <p className="text-graphite font-mono text-[0.65rem]">
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

  useEffect(() => {
    setBookId(firstBookId);
  }, [firstBookId]);

  useEffect(() => {
    setMinutes(defaultMinutes);
  }, [defaultMinutes, item.id]);

  const log = trpc.library.logSession.useMutation({
    onSuccess: () => {
      onSuccess();
      setUnitCount("");
      setChapter("");
      setMinutes(defaultMinutes);
      setCycle("");
      setSuccessPct("");
    },
  });

  const selectedBook =
    bookOptions.find((b) => b.id === bookId) ?? bookOptions[0];
  const unitLabel =
    selectedBook?.studyUnit === "games" ? "Games studied" : "Exercises done";
  const unitPlaceholder =
    selectedBook?.studyUnit === "games" ? "e.g. 3" : "e.g. 10";

  const onLog = () => {
    const resourceRefId = bookId || firstBookId;
    if (!resourceRefId) return;
    const count = Number(unitCount);
    if (!unitCount || !Number.isInteger(count) || count <= 0) {
      alert("Please enter a valid positive number for exercises/games.");
      return;
    }
    const duration = minutes ? Number(minutes) : undefined;
    if (
      duration !== undefined &&
      (!Number.isFinite(duration) || duration < 0)
    ) {
      alert("Please enter a valid number of minutes.");
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
    <div className="flex flex-col gap-4 border-t border-line/80 pt-4">
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
        )}
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
    </div>
  );
}
