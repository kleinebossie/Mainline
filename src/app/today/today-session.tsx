import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MoreHorizontal, Check, ExternalLink } from "lucide-react";

import { BookLogForm, type OwnedBook } from "@/app/today/today-book-log";
import {
  activityActionLabel,
  completionEventType,
  firstIncompleteItem,
  formatMinuteCap,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { WhyButton } from "@/components/ui/why-button";
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
    <Surface gutter="A" className="p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-graphite">
            Today&apos;s Training
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
            Your constraints are set
          </h2>
          <p className="mt-1 max-w-md font-sans text-sm text-graphite leading-relaxed">
            Select your available time budget to build your adapted training session.
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
    </Surface>
  );
}

export function TodayHeader({
  program,
  due,
  actualMinutes,
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
          ? "All training complete"
          : "Session finished with skips"
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
    <Surface className="p-5 sm:p-6 flex flex-col gap-6">
      {/* Top row: Status, progress counter, and segmented track */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-graphite">
              {statusTitle}
            </p>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-ink">
              {program.items.length === 0
                ? "Nothing scheduled for today."
                : `${done} done, ${skipped} skipped, ${remaining} remaining`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-graphite">
              Planned: {sessionMinuteCap(program)}
            </span>
          </div>
        </div>

        {program.items.length > 0 && (
          <div
            className="mt-4 grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${program.items.length}, minmax(0, 1fr))`,
            }}
            aria-label={`${done} done, ${skipped} skipped, ${remaining} remaining`}
          >
            {program.items.map((item) => (
              <span
                key={item.id}
                className={cn(
                  "h-2 rounded-full transition-colors",
                  item.status === "done" && "bg-evergreen",
                  item.status === "skipped" && "bg-clay/50",
                  item.status !== "done" &&
                    item.status !== "skipped" &&
                    "bg-line",
                )}
                title={rowStatusLabel(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Primary Action Card: Focus on the single next step */}
      {program.items.length > 0 && !allHandled && nextItem && (
        <div
          id="today-primary-action-card"
          className="rounded-md border border-evergreen/40 bg-evergreen/[0.04] p-5 transition-colors"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-evergreen">
                {isFirstBlock ? "Ready to begin" : "Session in progress"}
              </p>
              <h2 className="mt-1 font-serif text-xl sm:text-2xl font-semibold text-ink">
                {isFirstBlock
                  ? "Start today's session"
                  : "Continue your session"}
              </h2>
              <p className="mt-1 font-sans text-sm text-graphite">
                <span>
                  Block {nextItemIndex + 1} of {program.items.length}:{" "}
                </span>
                <span className="font-semibold text-ink">{nextItem.label}</span>
                {nextItem.estMinutes != null && (
                  <span className="ml-1.5 font-mono text-xs text-graphite">
                    ({formatMinuteCap(nextItem.estMinutes)})
                  </span>
                )}
              </p>
            </div>
            <div className="shrink-0">
              <TodayHeroButton
                item={nextItem}
                isFirstBlock={isFirstBlock}
                nextItemIndex={nextItemIndex}
              />
            </div>
          </div>
        </div>
      )}

      {/* Session Complete Honest Summary (Decision 33) */}
      {allHandled && program.items.length > 0 && (
        <div className="rounded-md border border-line bg-paper p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-evergreen">
            <Check className="h-5 w-5" />
            <h2 className="font-serif text-xl font-semibold text-ink">
              Training complete for today
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 text-sm text-graphite">
            <div className="rounded-sm border border-line/60 bg-paper-raised p-3">
              <p className="font-mono text-xs font-semibold text-ink uppercase tracking-wider">
                What you completed
              </p>
              <p className="mt-1 leading-relaxed">
                {done} blocks finished.
                {actualMinutes != null && actualMinutes > 0
                  ? ` Measured training time: ${Math.round(actualMinutes)} minutes.`
                  : " Your practice has been logged."}
              </p>
            </div>
            <div className="rounded-sm border border-line/60 bg-paper-raised p-3">
              <p className="font-mono text-xs font-semibold text-ink uppercase tracking-wider">
                What changes next
              </p>
              <p className="mt-1 leading-relaxed">
                Tomorrow&apos;s session will adapt to your tactical results and spaced repetition schedule.
              </p>
            </div>
          </div>
          {skipped > 0 && (
            <p className="font-mono text-xs text-graphite">
              Note: {skipped} {skipped === 1 ? "block was" : "blocks were"} skipped. You can restore any skipped block below.
            </p>
          )}
        </div>
      )}

      {/* Time Budget and Process Goal Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-t border-line/60 pt-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4 text-xs font-mono text-graphite">
            <div>
              <span className="block text-graphite uppercase tracking-wider">
                Planned
              </span>
              <span className="font-serif text-lg font-semibold text-ink">
                {sessionMinuteCap(program)}
              </span>
            </div>
            <div className="h-8 w-px bg-line" />
            <div>
              <span className="block text-graphite uppercase tracking-wider">
                Actual measured
              </span>
              <span className="font-serif text-lg font-semibold text-ink">
                {historyLoading
                  ? "Loading…"
                  : notStarted || actualMinutes === 0 || actualMinutes == null
                    ? "0 min"
                    : formatMeasuredMinutes(
                        actualMinutes,
                        actualMeasurementTruncated,
                      )}
              </span>
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

      {/* Daily Goal accordion */}
      <div className="border-t border-line/60 pt-4">
        <button
          type="button"
          onClick={() => setGoalOpen((open) => !open)}
          aria-expanded={goalOpen}
          aria-controls="today-process-goal"
          className="flex cursor-pointer items-center gap-2 font-mono text-xs font-medium uppercase tracking-wider text-graphite hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>Today&apos;s goal</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              !goalOpen && "-rotate-90",
            )}
            aria-hidden="true"
          />
        </button>
        {goalOpen && (
          <div id="today-process-goal" className="mt-2 text-sm text-ink leading-relaxed">
            <p>{program.honesty.processGoal}</p>
            <div className="mt-2">
              <WhyButton
                rationaleText={program.honesty.expectations}
                evidenceGrade={program.honesty.expectationsEvidence.evidenceGrade}
                evidenceTier={program.honesty.expectationsEvidence.evidenceTier}
                citationKey={program.honesty.expectationsEvidence.citationKey}
                citationSource={program.honesty.expectationsEvidence.citationSource}
                confidence={program.honesty.expectationsEvidence.confidence}
                soften={program.honesty.expectationsEvidence.soften}
                label="Why this expectation?"
              />
            </div>
          </div>
        )}
      </div>

      {due > 0 && (
        <p className="font-mono text-xs text-evergreen">
          New reviews are due for your next plan update.
        </p>
      )}
    </Surface>
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
    ? "Start Session"
    : `Continue Session (Block ${nextItemIndex + 1})`;

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

  if (isExternal && targetExternalUrl) {
    return (
      <a
        id="today-start-session-link"
        href={targetExternalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: "default", size: "lg" }),
          "h-11 px-6 text-sm font-medium gap-2 shrink-0 bg-evergreen hover:bg-evergreen-bright text-paper",
        )}
      >
        <span>{label}</span>
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    );
  }

  if (item.url) {
    return (
      <Link
        id="today-start-session-link"
        href={item.url}
        className={cn(
          buttonVariants({ variant: "default", size: "lg" }),
          "h-11 px-6 text-sm font-medium gap-2 shrink-0 bg-evergreen hover:bg-evergreen-bright text-paper",
        )}
      >
        <span>{label}</span>
        <span aria-hidden="true">→</span>
      </Link>
    );
  }

  return (
    <a
      id="today-start-session-link"
      href={`#today-block-card-${item.id}`}
      className={cn(
        buttonVariants({ variant: "default", size: "lg" }),
        "h-11 px-6 text-sm font-medium gap-2 shrink-0 bg-evergreen hover:bg-evergreen-bright text-paper",
      )}
    >
      <span>{label}</span>
      <span aria-hidden="true">↓</span>
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
        "flex min-w-0 flex-col gap-2",
        compact && "w-full sm:w-auto sm:items-end",
      )}
    >
      <label htmlFor="today-time-input" className="font-sans text-xs font-medium text-ink">
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
        <span className="font-mono text-xs text-graphite">min</span>
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
          {timeBusy ? "Updating…" : empty ? "Build session" : "Update plan"}
        </Button>
      </div>
      <p
        id="today-time-help"
        className="font-mono text-[0.65rem] text-graphite"
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
    <div
      className="flex min-w-0 flex-col gap-3"
      aria-label="Today training blocks"
    >
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
    </div>
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
    <Surface
      id={`today-block-card-${item.id}`}
      gutter={asEvidenceGrade(item.evidenceGrade)}
      provisional={item.soften}
      className={cn(
        "transition-colors",
        isUpNext && !closed && "ring-1 ring-evergreen/50 border-evergreen/50",
        item.status === "done" && "bg-paper/40 opacity-80",
        item.status === "skipped" && "border-clay/30 bg-clay/[0.02]",
      )}
    >
      <article className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-line bg-paper font-mono text-xs tabular-nums text-evergreen font-medium"
              aria-label={`Block ${index + 1}`}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words font-serif text-base font-semibold leading-snug text-ink sm:text-lg">
                  {item.label}
                </h2>
                {isUpNext && !closed && (
                  <span className="rounded-xs border border-evergreen/40 bg-evergreen/10 px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-evergreen font-semibold">
                    Up next
                  </span>
                )}
                {isExternal && (
                  <span className="rounded-xs border border-line bg-paper px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-graphite">
                    External
                  </span>
                )}
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-graphite">
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

            {closed && (
              <FinalStatusPill
                item={item}
                busy={busy}
                onUndoSkip={() => onUndoSkip(item.id)}
              />
            )}

            {/* Block More Menu */}
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`More options for ${item.label}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-line bg-paper hover:bg-ink/[0.04] text-graphite hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onSelect={() => setDetailsOpen(true)}>
                  Why this? (Evidence & rationale)
                </MenuItem>
                {!closed && (
                  <>
                    <MenuSeparator />
                    <MenuItem
                      danger
                      onSelect={() =>
                        onLogOutcome({ programItemId: item.id, type: "skip" })
                      }
                    >
                      Skip block
                    </MenuItem>
                  </>
                )}
                {item.status === "skipped" && (
                  <MenuItem onSelect={() => onUndoSkip(item.id)}>
                    Undo skip
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          </div>
        </div>

        <p className="min-w-0 text-sm text-graphite leading-relaxed">
          {itemSummary(item)}
        </p>

        <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-line/60 pt-3">
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
    </Surface>
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
          "shrink-0 bg-evergreen hover:bg-evergreen-bright text-paper",
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
          "rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold",
          item.status === "done"
            ? "border-evergreen/40 bg-evergreen/10 text-evergreen"
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
      className="flex min-w-0 flex-col gap-4 rounded-md bg-paper p-4 border border-line/60"
    >
      {!showsBookLog && (
        <div>
          <WhyButton
            rationaleText={item.rationaleText}
            evidenceGrade={item.evidenceGrade}
            evidenceTier={item.evidenceTier}
            citationKey={item.citationKey}
            citationSource={item.citationSource}
            confidence={item.confidence}
            soften={item.soften}
            label="View complete scientific rationale"
          />
          <p className="mt-2 text-sm text-graphite leading-relaxed">
            {item.rationaleText}
          </p>
        </div>
      )}

      {fitExplanation && (
        <div className="border-l-2 border-evergreen/40 pl-3 text-sm leading-relaxed text-ink">
          <p>
            {fitExplanation.text}{" "}
            <span className="font-mono text-[0.65rem] uppercase tracking-wider text-graphite">
              Grade {fitExplanation.evidenceGrade} · Tier {fitExplanation.evidenceTier} · {fitExplanation.citationKey}
            </span>
          </p>
          {fitExplanation.soften && (
            <p className="text-graphite mt-1 font-mono text-[0.68rem] leading-relaxed">
              {fitExplanation.flag === "best-guess"
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
              className="rounded-xs border border-line bg-paper-raised px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-graphite"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {isBook && !closed ? (
        scheduledBook == null && libraryLoading ? (
          <p className="font-mono text-xs text-graphite">
            Loading owned books…
          </p>
        ) : bookOptions.length === 0 ? (
          <div className="flex flex-col gap-2 border-t border-line/60 pt-4">
            <p className="font-sans text-sm text-graphite">
              You do not own any recommended books at your level yet. Add
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
