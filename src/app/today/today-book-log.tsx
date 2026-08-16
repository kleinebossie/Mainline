import { useEffect, useRef, useState } from "react";

import { TransparencyCardGroup } from "@/components/transparency-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { errorMessage } from "@/lib/error-presentation";
import { nextAssignedBookChapter } from "@/methodology";
import { trpc } from "@/lib/trpc/react";
import type { LibraryView } from "@/server/library";
import type { TodayItem } from "@/server/program";

export type OwnedBook = Pick<
  LibraryView["books"][number],
  "id" | "title" | "studyUnit" | "category"
> & {
  chapters?: LibraryView["books"][number]["chapters"];
};

type OutcomeRating = "target_met" | "needs_review" | "struggled";

const OUTCOME_RATES: Record<OutcomeRating, number> = {
  target_met: 0.85,
  needs_review: 0.65,
  struggled: 0.4,
};

const OUTCOME_BUTTONS: {
  id: OutcomeRating;
  label: string;
  description: string;
}[] = [
  { id: "target_met", label: "Target Met", description: "85% target" },
  { id: "needs_review", label: "Needs Review", description: "65% target" },
  { id: "struggled", label: "Struggled", description: "40% target" },
];

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
  const libraryQuery = trpc.library.get.useQuery();
  const bookOptions = scheduledBook ? [scheduledBook] : ownedBooks;
  const firstBookId = bookOptions[0]?.id ?? "";

  const [bookId, setBookId] = useState<string>(firstBookId);
  const [outcome, setOutcome] = useState<OutcomeRating>("target_met");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [unitCount, setUnitCount] = useState<string>("");
  const [customSuccessPct, setCustomSuccessPct] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");
  const [cycle, setCycle] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    setBookId(firstBookId);
  }, [firstBookId]);

  const selectedBook =
    bookOptions.find((b) => b.id === bookId) ?? bookOptions[0];

  const fullBook =
    libraryQuery.data?.books.find((b) => b.id === selectedBook?.id) ??
    selectedBook;

  const bookProgress = libraryQuery.data?.progress?.find(
    (p) => p.resourceRefId === selectedBook?.id,
  );
  const lastPosition = bookProgress?.position ?? null;

  const assignedChapter = fullBook
    ? nextAssignedBookChapter(fullBook, lastPosition)
    : null;

  const suggestedMinutes =
    typeof item.params.studyMinutes === "number"
      ? item.params.studyMinutes
      : (item.estMinutes ?? assignedChapter?.estMinutes);
  const defaultMinutes =
    suggestedMinutes != null ? String(Math.round(suggestedMinutes)) : "30";

  const [minutes, setMinutes] = useState<string>(defaultMinutes);

  useEffect(() => {
    setMinutes(defaultMinutes);
  }, [defaultMinutes, item.id]);

  const log = trpc.library.logSession.useMutation({
    onSuccess: () => {
      requestIdRef.current = null;
      setFormError(null);
      onSuccess();
      setUnitCount("");
      setChapter("");
      setMinutes(defaultMinutes);
      setCycle("");
      setCustomSuccessPct("");
    },
    onError: (error) =>
      setFormError(
        errorMessage(
          error,
          "The study session was not logged. Check the form and try again.",
        ),
      ),
  });

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
    const count = unitCount ? Number(unitCount) : 1;
    if (!Number.isInteger(count) || count <= 0) {
      setFormError("Enter a positive whole number of units.");
      return;
    }
    const duration = minutes
      ? Number(minutes)
      : (assignedChapter?.estMinutes ?? 30);
    if (!Number.isFinite(duration) || duration < 0) {
      setFormError("Enter zero or more minutes.");
      return;
    }

    let finalSuccessRate: number;
    if (customSuccessPct.trim() !== "") {
      const customRate = Number(customSuccessPct);
      if (!Number.isFinite(customRate) || customRate < 0 || customRate > 100) {
        setFormError("Enter a success rate from 0 to 100.");
        return;
      }
      finalSuccessRate = customRate / 100;
    } else {
      finalSuccessRate = OUTCOME_RATES[outcome];
    }

    const finalChapter =
      chapter.trim() !== "" ? Number(chapter) : assignedChapter?.chapter;

    requestIdRef.current ??= crypto.randomUUID();
    log.mutate({
      requestId: requestIdRef.current,
      programItemId: item.id,
      resourceRefId,
      successRate: finalSuccessRate,
      durationMin: duration,
      woodpeckerCycle: cycle ? Number(cycle) : undefined,
      position: {
        unitCount: count,
        chapter: finalChapter,
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

      {assignedChapter && (
        <div className="rounded-md border border-line/80 bg-paper/60 p-3">
          <span className="eyebrow !text-[0.62rem] text-graphite">
            Scheduled Assignment
          </span>
          <p className="mt-0.5 font-serif text-sm font-semibold text-ink">
            Today: {selectedBook?.title ?? "Book"} Chapter{" "}
            {assignedChapter.chapter}: {assignedChapter.title}{" "}
            <span className="font-mono text-xs font-normal text-graphite">
              (Estimated {assignedChapter.estMinutes} min)
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 font-serif text-xs">
          <span className="eyebrow !text-[0.62rem]">Outcome Rating</span>
          <div className="grid grid-cols-3 gap-2">
            {OUTCOME_BUTTONS.map((opt) => {
              const isSelected = outcome === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setOutcome(opt.id);
                    setFormError(null);
                  }}
                  className={`flex flex-col items-center justify-center rounded-md border p-2.5 text-center transition-all ${
                    isSelected
                      ? "border-evergreen bg-evergreen/10 text-ink font-semibold shadow-xs"
                      : "border-line/80 bg-paper/30 text-graphite hover:border-line hover:bg-paper/70"
                  }`}
                  aria-pressed={isSelected}
                >
                  <span className="font-serif text-xs leading-tight">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 font-mono text-[0.65rem] opacity-75">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 font-serif text-xs">
            <span className="eyebrow !text-[0.62rem]">
              Confirmed Time (minutes)
            </span>
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
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-medium text-graphite hover:text-ink transition-colors"
            aria-expanded={showAdvanced}
          >
            <span className="font-mono text-[0.7rem]">
              {showAdvanced ? "−" : "+"}
            </span>
            <span>Edit chapter or details</span>
          </button>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 gap-4 rounded-md border border-line/60 bg-paper/20 p-3 sm:grid-cols-2">
            {scheduledBook ? (
              <div className="flex flex-col gap-1.5 font-serif text-xs">
                <span className="eyebrow !text-[0.62rem]">Book</span>
                <span className="text-ink text-sm leading-snug">
                  {scheduledBook.title}
                </span>
              </div>
            ) : (
              <label className="flex flex-col gap-1.5 font-serif text-xs">
                <span className="eyebrow !text-[0.62rem]">Book</span>
                <Select
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                >
                  {ownedBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </Select>
              </label>
            )}

            <label className="flex flex-col gap-1.5 font-serif text-xs">
              <span className="eyebrow !text-[0.62rem]">Chapter number</span>
              <Input
                type="number"
                min={0}
                max={10_000}
                placeholder={
                  assignedChapter ? String(assignedChapter.chapter) : "e.g. 4"
                }
                value={chapter}
                onChange={(e) => {
                  setChapter(e.target.value);
                  setFormError(null);
                }}
                className="text-ink text-sm h-9"
              />
            </label>

            <label className="flex flex-col gap-1.5 font-serif text-xs">
              <span className="eyebrow !text-[0.62rem]">{unitLabel}</span>
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
                className="text-ink text-sm h-9"
              />
            </label>

            <label className="flex flex-col gap-1.5 font-serif text-xs">
              <span className="eyebrow !text-[0.62rem]">
                Custom success rate (%)
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 85"
                value={customSuccessPct}
                onChange={(e) => {
                  setCustomSuccessPct(e.target.value);
                  setFormError(null);
                }}
                className="text-ink text-sm h-9"
              />
            </label>

            {selectedBook?.category === "tactics" && (
              <label className="flex flex-col gap-1.5 font-serif text-xs">
                <span className="eyebrow !text-[0.62rem]">
                  Woodpecker cycle
                </span>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  placeholder="1"
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
