import { useState } from "react";
import Link from "next/link";

import { BookLogForm, type OwnedBook } from "@/app/today/today-book-log";
import {
  activityActionLabel,
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
import { asEvidenceGrade } from "@/components/evidence";
import { TransparencyCard } from "@/components/transparency-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MAX_MINUTES_PER_DAY,
  MIN_MINUTES_PER_DAY,
} from "@/lib/constraint-limits";
import { cn } from "@/lib/utils";
import type { TodayItem, TodayProgram } from "@/server/program";

type LogOutcomeInput = {
  programItemId: string;
  type: "skip" | "puzzle_attempt" | "drill_done" | "game_played";
  correct?: boolean;
};

export function EmptyTodayCard({
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

export function TodayHeader({
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
          min={MIN_MINUTES_PER_DAY}
          max={MAX_MINUTES_PER_DAY}
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
        {MIN_MINUTES_PER_DAY}-{MAX_MINUTES_PER_DAY} min (
        {formatMinuteCap(MAX_MINUTES_PER_DAY)})
      </p>
    </div>
  );
}

export function TodayBlockList({
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
      gutter={asEvidenceGrade(item.evidenceGrade)}
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
      {busy ? "Saving..." : "Mark done"}
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
        {busy ? "Saving..." : "Solved"}
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
        {busy ? "Saving..." : "Struggled"}
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
        {busy ? "Saving..." : "Mark done"}
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
      {busy ? "Saving..." : "Skip"}
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
              {busy ? "Saving..." : "Skip"}
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
