import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { BookLogForm, type OwnedBook } from "@/app/today/today-book-log";
import {
  activityActionLabel,
  completionEventType,
  firstIncompleteItem,
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
import { GradeGlyph, asEvidenceGrade } from "@/components/evidence";
import { TransparencyCard } from "@/components/transparency-card";
import { Button, buttonVariants } from "@/components/ui/button";
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

// Today is typeset as a game score: one numbered line per block, the annotation glyph for
// its evidence grade at the end of the title, and the eval meter on the leading edge. A
// session really is a sequence, so the numbering carries information (planning/DESIGN.md).

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
    <section className="sheet settle p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-md">
          <h2 className="text-[1.4rem] leading-tight">
            Your constraints are set. Say how long you have.
          </h2>
          <p className="font-serif mt-1.5 text-[0.95rem] leading-relaxed text-graphite">
            Mainline fills the time with the work your games say you need,
            shortest first.
          </p>
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
    </section>
  );
}

function Readout({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5 py-2">
      <dt className="label shrink-0">{label}</dt>
      <dd className="font-mono text-[1.05rem] font-semibold leading-none text-ink">
        {value}
      </dd>
      {note && (
        <dd className="font-mono text-[0.7rem] leading-snug text-graphite">
          {note}
        </dd>
      )}
    </div>
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
  const [goalOpen, setGoalOpen] = useState(true);
  const done = program.items.filter((item) => item.status === "done").length;
  const skipped = program.items.filter(
    (item) => item.status === "skipped",
  ).length;
  const remaining = program.items.length - done - skipped;
  const allHandled = remaining === 0;
  const notStarted = !historyLoading && !historyError && actualEventCount === 0;
  const nextItem = firstIncompleteItem(program.items);
  const nextItemIndex = nextItem
    ? program.items.findIndex((item) => item.id === nextItem.id)
    : -1;
  const isFirstBlock = nextItemIndex === 0;

  const statusTitle =
    program.items.length === 0
      ? "No training scheduled"
      : allHandled
        ? skipped === 0
          ? "Training complete"
          : "Finished with skips"
        : "Session in progress";

  const handleRegenerateWithConfirm = () => {
    if (done > 0) {
      if (
        !window.confirm(
          "Update training plan? Completed progress in today's session will be preserved while remaining work is updated to fit the new time budget.",
        )
      ) {
        return;
      }
    }
    onRegenerate();
  };

  return (
    <section className="sheet settle p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2 className="text-[1.5rem] leading-tight sm:text-[1.75rem]">
            {statusTitle}
          </h2>
          <p className="mt-1 font-mono text-[0.78rem] text-graphite">
            {program.items.length === 0
              ? "Nothing is waiting for you today"
              : `${done} of ${program.items.length} blocks done${
                  skipped > 0 ? `, ${skipped} skipped` : ""
                }${remaining > 0 ? `, ${remaining} left` : ""}`}
          </p>
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

      {program.items.length > 0 && (
        <div
          className="mt-4 flex gap-1"
          style={{
            gridTemplateColumns: `repeat(${program.items.length}, minmax(0, 1fr))`,
          }}
          role="img"
          aria-label={`${done} done, ${skipped} skipped, ${remaining} remaining`}
        >
          {program.items.map((item) => (
            <span
              key={item.id}
              className={cn(
                "h-1.5 flex-1 rounded-[1px]",
                item.status === "done" && "bg-tile",
                item.status === "skipped" &&
                  "bg-[repeating-linear-gradient(to_right,hsl(var(--brick))_0_3px,transparent_3px_6px)]",
                item.status !== "done" &&
                  item.status !== "skipped" &&
                  "bg-rule",
              )}
              title={rowStatusLabel(item)}
            />
          ))}
        </div>
      )}

      <dl className="mt-4 grid gap-x-8 border-t border-rule sm:grid-cols-2">
        <Readout label="Planned" value={sessionMinuteCap(program)} />
        <Readout
          label="Measured on the clock"
          value={
            historyLoading
              ? "Loading"
              : notStarted || actualMinutes === 0 || actualMinutes == null
                ? "0 min"
                : formatMeasuredMinutes(
                    actualMinutes,
                    actualMeasurementTruncated,
                  )
          }
          note={
            !historyLoading &&
            !historyError &&
            !notStarted &&
            actualMinutes != null &&
            actualMinutes > 0
              ? formatMeasurementCoverage(
                  actualMeasuredEvents,
                  actualEventCount,
                  actualMeasurementTruncated,
                )
              : null
          }
        />
      </dl>

      {program.items.length > 0 && !allHandled && nextItem && (
        <div className="mt-4 rounded-[3px] bg-biro/[0.05] p-3 [box-shadow:inset_3px_0_0_hsl(var(--biro))] sm:p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-[0.95rem] leading-snug">
              <span className="font-mono text-[0.72rem] font-semibold text-biro">
                {isFirstBlock ? "Start here" : "Up next"}
              </span>
              <br />
              <span className="font-mono text-graphite mr-1.5 text-[0.85rem]">
                {nextItemIndex + 1}.
              </span>
              <span className="font-semibold">{nextItem.label}</span>
              {nextItem.estMinutes != null && (
                <span className="font-mono text-graphite ml-1.5 text-[0.78rem]">
                  {formatMinuteCap(nextItem.estMinutes)}
                </span>
              )}
            </p>
            <TodayHeroButton
              item={nextItem}
              isFirstBlock={isFirstBlock}
              nextItemIndex={nextItemIndex}
            />
          </div>
        </div>
      )}

      {allHandled && skipped > 0 && (
        <p className="font-serif mt-3 text-[0.9rem] leading-relaxed text-graphite">
          Open a skipped block below to put it back in today&apos;s session.
        </p>
      )}

      <div className="mt-4 border-t border-rule pt-3">
        <button
          type="button"
          onClick={() => setGoalOpen((open) => !open)}
          aria-expanded={goalOpen}
          aria-controls="today-process-goal"
          className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[2px] pr-1 text-[0.85rem] font-medium text-graphite transition-colors hover:text-ink"
        >
          <span>Today&apos;s goal</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
              !goalOpen && "-rotate-90",
            )}
            aria-hidden="true"
          />
        </button>
        {goalOpen && (
          <p
            id="today-process-goal"
            className="font-serif mt-1.5 max-w-[62ch] text-[1rem] leading-relaxed text-ink"
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
        className="mt-3"
      />

      {due > 0 && (
        <p className="mt-3 font-mono text-[0.75rem] text-graphite">
          <span className="text-biro">New</span> review work is ready for your
          next plan update.
        </p>
      )}
    </section>
  );
}

function TodayHeroButton({
  item,
  isFirstBlock,
  nextItemIndex,
}: {
  item: TodayItem;
  isFirstBlock: boolean;
  nextItemIndex: number;
}) {
  const label = isFirstBlock
    ? "Start session"
    : `Continue at block ${nextItemIndex + 1}`;

  const isExternal =
    item.delivery === "external" ||
    Boolean(item.externalUrl) ||
    Boolean(
      item.url &&
      (item.url.startsWith("http://") ||
        item.url.startsWith("https://") ||
        item.url.startsWith("//")),
    );

  const targetExternalUrl = item.externalUrl ?? (isExternal ? item.url : null);
  const className = cn(buttonVariants({ size: "sm" }), "shrink-0 px-4");

  if (isExternal && targetExternalUrl) {
    return (
      <a
        id="today-start-session-link"
        href={targetExternalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <span>{label}</span>
      </a>
    );
  }

  if (item.url) {
    return (
      <Link id="today-start-session-link" href={item.url} className={className}>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <a
      id="today-start-session-link"
      href={`#today-block-card-${item.id}`}
      className={className}
    >
      <span>{label}</span>
    </a>
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
        "flex min-w-0 flex-col gap-1.5",
        compact && "w-full sm:w-auto sm:items-end",
      )}
    >
      <label
        htmlFor="today-time-input"
        className="text-[0.85rem] font-medium text-ink"
      >
        Minutes available today
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
          className="h-9 w-[4.5rem]"
        />
        <span className="font-mono text-[0.75rem] text-graphite">min</span>
        <Button
          type="button"
          size="sm"
          variant={!timeValid && !timeBusy ? "outline" : "default"}
          disabled={timeBusy || !timeValid || (!empty && !changed)}
          onClick={onRegenerate}
        >
          {timeBusy ? "Updating…" : empty ? "Build session" : "Update plan"}
        </Button>
      </div>
      <p
        id="today-time-help"
        className="font-mono text-[0.68rem] leading-snug text-graphite"
      >
        {`${MIN_MINUTES_PER_DAY}-${MAX_MINUTES_PER_DAY} min (${formatMinuteCap(MAX_MINUTES_PER_DAY)})`}
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
  defaultDetailsOpen,
}: {
  items: TodayItem[];
  ownedBooks: OwnedBook[];
  libraryLoading: boolean;
  pendingItemId?: string;
  onLogOutcome: (input: LogOutcomeInput) => void;
  onBookLogged: () => void;
  onUndoSkip: (programItemId: string) => void;
  defaultDetailsOpen?: boolean;
}) {
  const activeItem = firstIncompleteItem(items);

  return (
    <ol className="sheet overflow-hidden" aria-label="Today's training blocks">
      {items.map((item, index) => (
        <TodayBlockCard
          key={item.id}
          item={item}
          index={index}
          isUpNext={activeItem?.id === item.id}
          ownedBooks={ownedBooks}
          libraryLoading={libraryLoading}
          busy={pendingItemId === item.id}
          onLogOutcome={onLogOutcome}
          onBookLogged={onBookLogged}
          onUndoSkip={onUndoSkip}
          defaultDetailsOpen={defaultDetailsOpen}
        />
      ))}
    </ol>
  );
}

function TodayBlockCard({
  item,
  index,
  isUpNext,
  ownedBooks,
  libraryLoading,
  busy,
  onLogOutcome,
  onBookLogged,
  onUndoSkip,
  defaultDetailsOpen,
}: {
  item: TodayItem;
  index: number;
  isUpNext?: boolean;
  ownedBooks: OwnedBook[];
  libraryLoading: boolean;
  busy: boolean;
  onLogOutcome: (input: LogOutcomeInput) => void;
  onBookLogged: () => void;
  onUndoSkip: (programItemId: string) => void;
  defaultDetailsOpen?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(defaultDetailsOpen ?? false);
  const detailsId = `today-block-details-${item.id}`;
  const closed = isClosedItem(item);
  const isBook = item.activityType === "book";
  const scheduledBook = item.bookResource ?? item.params.bookResource ?? null;
  const bookOptions = scheduledBook ? [scheduledBook] : ownedBooks;

  const isExternal =
    isBook ||
    item.activityType === "play_game" ||
    primaryActionKind(item) === "external";

  return (
    <li
      id={`today-block-card-${item.id}`}
      aria-current={isUpNext && !closed ? "true" : undefined}
      data-grade={asEvidenceGrade(item.evidenceGrade)}
      data-provisional={item.soften ? "true" : undefined}
      className={cn(
        "meter scroll-mt-24 relative py-4 pl-6 pr-4 transition-colors sm:pl-7",
        index > 0 && "border-t border-rule",
        isUpNext && !closed && "bg-biro/[0.04]",
        item.status === "done" && "bg-tile/[0.035]",
        item.status === "skipped" && "bg-brick/[0.03]",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="font-mono mt-px shrink-0 text-[0.85rem] font-semibold text-graphite"
            aria-label={`Block ${index + 1}`}
          >
            {index + 1}.
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-[1.02rem] font-semibold leading-snug">
              <span className={cn(closed && "text-graphite")}>
                {item.label}
              </span>
              <GradeGlyph
                grade={item.evidenceGrade}
                className="text-[0.8rem]"
              />
            </h3>
            <p className="font-mono mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-graphite">
              <span>{formatMinuteCap(item.estMinutes)}</span>
              <span aria-hidden>·</span>
              <span>{rowStatusLabel(item)}</span>
              {isExternal && <span>outside Mainline</span>}
            </p>
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

      <p className="font-serif mt-2 min-w-0 max-w-[66ch] pl-0 text-[0.92rem] leading-relaxed text-graphite">
        {itemSummary(item)}
      </p>

      <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          onClick={() => setDetailsOpen((open) => !open)}
          className="-ml-1.5 px-1.5"
        >
          {detailsOpen
            ? "Hide the evidence"
            : isBook
              ? "Why, and log time"
              : "Why this"}
        </Button>
        <TodayLogActions item={item} busy={busy} onLogOutcome={onLogOutcome} />
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
          onSkip={() => onLogOutcome({ programItemId: item.id, type: "skip" })}
        />
      )}
    </li>
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
      {busy ? "Saving…" : "Mark done"}
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
        {busy ? "Saving…" : "Solved"}
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
        {busy ? "Saving…" : "Struggled"}
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
        {busy ? "Saving…" : "Mark done"}
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
      {busy ? "Saving…" : "Skip"}
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
          "font-mono inline-flex items-center gap-1.5 rounded-[2px] px-1.5 py-1 text-[0.72rem] font-semibold",
          item.status === "done"
            ? "bg-tile/10 text-tile"
            : "bg-brick/10 text-brick",
        )}
      >
        <span aria-hidden>{item.status === "done" ? "✓" : "–"}</span>
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
          {busy ? "Restoring…" : "Undo skip"}
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
  const meta = itemMeta(item);
  const fitExplanation = item.params.fitExplanation;
  const showsBookLog =
    isBook &&
    !closed &&
    !(scheduledBook == null && libraryLoading) &&
    bookOptions.length > 0;

  return (
    <div
      id={id}
      className="mt-3 flex min-w-0 flex-col gap-4 rounded-[3px] bg-ink/[0.025] p-3 sm:p-4"
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
          hideToggle={true}
        />
      )}

      {fitExplanation && (
        <div className="max-w-[66ch] border-l-[3px] border-biro/45 pl-3">
          <p className="font-serif text-[0.92rem] leading-relaxed text-ink">
            {fitExplanation.text}
          </p>
          <p className="font-mono mt-1 text-[0.7rem] text-graphite">
            Grade {fitExplanation.evidenceGrade}, tier{" "}
            {fitExplanation.evidenceTier}
            <span className="text-ink"> · </span>
            {fitExplanation.citationKey}
          </p>
          {fitExplanation.soften && (
            <p className="font-serif mt-1 text-[0.82rem] italic leading-relaxed text-graphite">
              {fitExplanation.flag === "best-guess"
                ? "Best-guess delivery rule, not evidence that this activity works better."
                : "Low-confidence delivery rule, not evidence that this activity works better."}
            </p>
          )}
        </div>
      )}

      {meta.length > 0 && (
        <p className="font-mono text-[0.72rem] leading-relaxed text-graphite">
          <span className="text-ink">Signals</span> {meta.join(", ")}
        </p>
      )}

      {isBook && !closed ? (
        scheduledBook == null && libraryLoading ? (
          <p className="font-mono text-[0.75rem] text-graphite">
            Loading the books you own…
          </p>
        ) : bookOptions.length === 0 ? (
          <div className="flex flex-col gap-2 border-t border-rule pt-3">
            <p className="font-serif text-[0.92rem] leading-relaxed text-graphite">
              You don&apos;t own any recommended books at your level yet. Add
              the books you own in Settings, then rebuild today&apos;s session.
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onSkip}
              className="self-start"
            >
              {busy ? "Saving…" : "Skip"}
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
