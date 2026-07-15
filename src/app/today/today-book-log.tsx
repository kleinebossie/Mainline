import { useEffect, useState } from "react";

import { TransparencyCardGroup } from "@/components/transparency-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { trpc } from "@/lib/trpc/react";
import type { LibraryView } from "@/server/library";
import type { TodayItem } from "@/server/program";

export type OwnedBook = Pick<
  LibraryView["books"][number],
  "id" | "title" | "studyUnit" | "category"
>;

const FEEDBACK_SUMMARY = {
  too_easy: "Your reported result was above the configured practice range.",
  too_hard: "Your reported result was below the configured practice range.",
  calibrated: "Your reported result was inside the configured practice range.",
} as const;

export function BookLogForm({
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
  const feedbackCopy = log.data?.feedbackCopy;
  const rationaleItems = [
    {
      title: "Training block",
      rationaleText: item.rationaleText,
      evidenceGrade: item.evidenceGrade,
      evidenceTier: item.evidenceTier,
      citationKey: item.citationKey,
      citationSource: item.citationSource,
      confidence: item.confidence,
      soften: item.soften,
    },
    ...(feedbackCopy
      ? [
          {
            title: "Session feedback",
            rationaleText: feedbackCopy.text,
            evidenceGrade: feedbackCopy.grade,
            evidenceTier: feedbackCopy.tier,
            citationKey: feedbackCopy.citationKey,
            citationSource: feedbackCopy.citationSource,
            confidence: "low",
            soften: feedbackCopy.soften,
            flag: feedbackCopy.flag,
          },
        ]
      : []),
  ];

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
    const pct = successPct ? Number(successPct) : undefined;
    if (pct !== undefined && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
      setFormError("Enter a success rate from 0 to 100.");
      return;
    }
    log.mutate({
      programItemId: item.id,
      resourceRefId,
      successRate: pct === undefined ? undefined : pct / 100,
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
      <TransparencyCardGroup items={rationaleItems} defaultCollapsed={false} />
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
            max={10_000}
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
            Success rate (%) (optional)
          </span>
          <Input
            type="number"
            min={0}
            max={100}
            value={successPct}
            onChange={(e) => {
              setSuccessPct(e.target.value);
              setFormError(null);
            }}
            className="text-ink h-9 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">Chapter (optional)</span>
          <Input
            type="number"
            min={0}
            max={10_000}
            value={chapter}
            onChange={(e) => {
              setChapter(e.target.value);
              setFormError(null);
            }}
            className="text-ink text-sm h-9"
          />
        </label>
        <label className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">Minutes (optional)</span>
          <Input
            type="number"
            min={0}
            max={600}
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
              max={99}
              value={cycle}
              onChange={(e) => {
                setCycle(e.target.value);
                setFormError(null);
              }}
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
          {busy ? "Saving..." : "Skip"}
        </Button>
      </div>

      {formError && (
        <StatusMessage id="book-log-error" tone="error">
          {formError}
        </StatusMessage>
      )}

      {log.data?.feedback && feedbackCopy && (
        <p className="text-graphite border-l-2 border-evergreen/40 pl-3 font-serif text-sm leading-relaxed">
          {FEEDBACK_SUMMARY[log.data.feedback.verdict]}
        </p>
      )}
    </form>
  );
}
