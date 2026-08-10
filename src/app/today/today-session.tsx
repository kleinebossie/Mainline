import { useState } from "react";
import Link from "next/link";
import { Target, ChevronDown } from "lucide-react";

import { BookLogForm, type OwnedBook } from "@/app/today/today-book-log";
import {
  activityActionLabel,
  completionEventType,
  formatMinuteCap,
  formatMeasurementCoverage,
  formatMeasuredMinutes,
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
    <Card gutter="A" className="focus-card p-6 shadow-sheet">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-paper font-serif text-3xl text-evergreen shadow-xs" aria-hidden="true">
            ♔
          </span>
          <div>
            <p className="eyebrow">Today&apos;s Training</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
              Your constraints are set
            </h2>
            <p className="text-graphite mt-1 max-w-md font-serif text-sm leading-relaxed">
              Choose today&apos;s available time budget to build your adapted training session.
            </p>
          </div>
        </div>
        <TimeEdit
          timeInput={timeInput}
          setTimeInput={setTimeInput}
          timeBusy={timeBusy}
          timeValid={timeValid}
          onRegenerate={onRegenerate}
          empty
        />
      </div>
    </Card>
  );
}

export function TodayHeader({
  program,
  due,
  actualMinutes,
  actualMeasuredEvents,
  actualEventCount,
  actualMeasurementTruncated,
  historyLoading,
  historyError,
  timeInput,
  setTimeInput,
  timeBusy,
  timeValid,
  timeChanged,
  onRegenerate,
}: {
  program: TodayProgram;
  due: number;
  actualMinutes: number | null;
  actualMeasuredEvents: number;
  actualEventCount: number;
  actualMeasurementTruncated: boolean;
  historyLoading: boolean;
  historyError: boolean;
  timeInput: string;
  setTimeInput: (value: string) => void;
  timeBusy: boolean;
  timeValid: boolean;
  timeChanged: boolean;
  onRegenerate: () => void;
}) {
  const [goalOpen, setGoalOpen] = useState(false);
  const done = program.items.filter((item) => item.status === "done").length;
  const skipped = program.items.filter(
    (item) => item.status === "skipped",
  ).length;
  const remaining = program.items.length - done - skipped;
  const allHandled = remaining === 0;
  const notStarted = !historyLoading && !historyError && actualEventCount === 0;
  const statusTitle =
    program.items.length === 0
      ? "No training scheduled"
      : allHandled
        ? skipped === 0
          ? "All training complete"
          : "Session finished with skips"
        : "Session in progress";
  const handleRegenerateWithConfirm = () => {
    if (done > 0) {
      if (
        !window.confirm(
          "Update training plan? Progress completed in today's session will be replaced.",
        )
      ) {
        return;
      }
    }
    onRegenerate();
  };

  return (
    <section className="bg-card focus-card rounded-lg border p-4 shadow-sheet settle sm:p-5">
      <div className="mb-5 border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow">{statusTitle}</p>
            <p className="mt-1 font-serif text-lg font-semibold text-ink">
              {program.items.length === 0
                ? "Nothing is waiting for you today."
                : `${done} done, ${skipped} skipped, ${remaining} remaining`}
            </p>
          </div>
          {program.items.length > 0 && (
            <span className="font-mono text-xs text-graphite">
              {done + skipped} of {program.items.length} handled
            </span>
          )}
        </div>
        {program.items.length > 0 && (
          <div
            className="mt-3 grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${program.items.length}, minmax(0, 1fr))`,
            }}
            aria-label={`${done} done, ${skipped} skipped, ${remaining} remaining`}
          >
            {program.items.map((item) => (
              <span
                key={item.id}
                className={cn(
                  "h-2 rounded-full border",
                  item.status === "done" && "border-evergreen bg-evergreen",
                  item.status === "skipped" &&
                    "border-clay bg-[repeating-linear-gradient(135deg,hsl(var(--clay))_0_3px,transparent_3px_6px)]",
                  item.status !== "done" &&
                    item.status !== "skipped" &&
                    "border-line bg-paper",
                )}
                title={rowStatusLabel(item)}
              />
            ))}
          </div>
        )}
        {allHandled && skipped > 0 && (
          <p className="mt-3 text-sm text-graphite">
            Undo any skip below to return that block to the session.
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Today</p>
          <div className="mt-3 grid max-w-md grid-cols-2 gap-5">
            <div>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-graphite">
                Planned
              </p>
              <h2 className="mt-1 flex flex-wrap items-baseline gap-x-2 font-serif text-xl font-semibold leading-tight text-ink sm:text-2xl">
                <span>{sessionMinuteCap(program)}</span>
                <span className="font-mono text-xs font-normal text-graphite">
                  ordered training blocks
                </span>
              </h2>
            </div>
            <div className="border-l border-line pl-5">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-graphite">
                Actual, measured
              </p>
              <p className="mt-1 font-serif text-xl font-semibold leading-tight text-ink sm:text-2xl">
                {historyLoading
                  ? "Loading…"
                  : historyError
                    ? "Unavailable"
                    : notStarted
                      ? "Not started"
                      : formatMeasuredMinutes(
                          actualMinutes,
                          actualMeasurementTruncated,
                        )}
              </p>
              {!historyLoading && !historyError && !notStarted && (
                <p className="mt-1 font-mono text-[0.6rem] leading-relaxed text-graphite">
                  {formatMeasurementCoverage(
                    actualMeasuredEvents,
                    actualEventCount,
                    actualMeasurementTruncated,
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
        <TimeEdit
          timeInput={timeInput}
          setTimeInput={setTimeInput}
          timeBusy={timeBusy}
          timeValid={timeValid}
          onRegenerate={handleRegenerateWithConfirm}
          compact
          changed={timeChanged}
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
          <Target className="h-3.5 w-3.5 shrink-0 text-evergreen" aria-hidden="true" />
          <span>Today&apos;s goal</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-graphite transition-transform duration-200",
              !goalOpen && "-rotate-90",
            )}
            aria-hidden="true"
          />
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
        className="mt-4"
      />

      {due > 0 && (
        <p className="text-evergreen mt-3 font-mono text-xs">
          New review work is ready for your next plan update.
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
  empty = false,
  changed = true,
}: {
  timeInput: string;
  setTimeInput: (value: string) => void;
  timeBusy: boolean;
  timeValid: boolean;
  onRegenerate: () => void;
  compact?: boolean;
  empty?: boolean;
  changed?: boolean;
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
          disabled={timeBusy || !timeValid || (!empty && !changed)}
          onClick={onRegenerate}
          className={cn(
            !timeValid && !timeBusy && "border-evergreen/30 text-evergreen/50",
          )}
        >
          {timeBusy ? "Updating..." : empty ? "Build session" : "Update plan"}
        </Button>
      </div>
      <p
        id="today-time-help"
        className="text-graphite font-mono text-[0.65rem]"
      >
        {!empty && !changed && timeValid
          ? "Change the minutes to update remaining work."
          : `${MIN_MINUTES_PER_DAY}-${MAX_MINUTES_PER_DAY} min (${formatMinuteCap(MAX_MINUTES_PER_DAY)})`}
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
  onUndoSkip,
}: {
  items: TodayItem[];
  ownedBooks: OwnedBook[];
  libraryLoading: boolean;
  pendingItemId?: string;
  onLogOutcome: (input: LogOutcomeInput) => void;
  onBookLogged: () => void;
  onUndoSkip: (programItemId: string) => void;
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
          onUndoSkip={onUndoSkip}
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
  onUndoSkip,
}: {
  item: TodayItem;
  index: number;
  ownedBooks: OwnedBook[];
  libraryLoading: boolean;
  busy: boolean;
  onLogOutcome: (input: LogOutcomeInput) => void;
  onBookLogged: () => void;
  onUndoSkip: (programItemId: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = `today-block-details-${item.id}`;
  const closed = isClosedItem(item);
  const isBook = item.activityType === "book";
  const scheduledBook = item.bookResource ?? item.params.bookResource ?? null;
  const bookOptions = scheduledBook ? [scheduledBook] : ownedBooks;
  const meta = itemMeta(item);

  const isExternal =
    isBook ||
    item.activityType === "play_game" ||
    primaryActionKind(item) === "external";

  return (
    <Card
      gutter={asEvidenceGrade(item.evidenceGrade)}
      provisional={item.soften}
      className={cn(
        "settle min-w-0",
        item.status === "done" && "border-evergreen/35 bg-evergreen/[0.025]",
        item.status === "skipped" && "border-clay/40 bg-clay/[0.035]",
      )}
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
                {isExternal && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="rounded-xs border border-line/80 bg-paper/60 px-1 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-graphite">
                      External
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-start gap-2 sm:justify-end">
            <TodayPrimaryAction
              item={item}
              busy={busy}
              onLogOutcome={onLogOutcome}
            />
            {closed && (
              <FinalStatusPill
                item={item}
                busy={busy}
                onUndoSkip={() => onUndoSkip(item.id)}
              />
            )}
          </div>
        </div>

        <p className="text-graphite min-w-0 text-sm leading-relaxed">
          {itemSummary(item)}
        </p>

        {item.params.fitExplanation && (
          <div className="border-l-2 border-evergreen/40 pl-3 text-sm leading-relaxed text-ink">
            <p className="font-serif">
              {item.params.fitExplanation.text}{" "}
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-graphite">
                Grade {item.params.fitExplanation.evidenceGrade} · Tier{" "}
                {item.params.fitExplanation.evidenceTier} ·{" "}
                {item.params.fitExplanation.citationKey}
              </span>
            </p>
            {item.params.fitExplanation.soften && (
              <p className="text-graphite mt-1 font-mono text-[0.68rem] leading-relaxed">
                {item.params.fitExplanation.flag === "best-guess"
                  ? "Best-guess delivery rule, not evidence that this activity works better."
                  : "Low-confidence delivery rule, not evidence that this activity works better."}
              </p>
            )}
          </div>
        )}

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

function FinalStatusPill({
  item,
  busy,
  onUndoSkip,
}: {
  item: TodayItem;
  busy: boolean;
  onUndoSkip: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "rounded-sm border px-2.5 py-1.5 font-mono text-xs font-semibold",
          item.status === "done"
            ? "border-evergreen/35 bg-evergreen/10 text-evergreen"
            : "border-clay/40 bg-clay/10 text-clay",
        )}
      >
        {rowStatusLabel(item)}
      </span>
      {item.status === "skipped" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onUndoSkip}
        >
          {busy ? "Restoring..." : "Undo skip"}
        </Button>
      )}
    </div>
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
  const showsBookLog =
    isBook &&
    !closed &&
    !(scheduledBook == null && libraryLoading) &&
    bookOptions.length > 0;

  return (
    <div
      id={id}
      className="flex min-w-0 flex-col gap-4 rounded-md bg-paper/45 p-3 sm:p-4"
    >
      {!showsBookLog && (
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
      )}

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
