"use client";

// The evidence-annotation system: Mainline's signature and the visible form of the honesty
// brand (VISION §2). A grade is written the way a chess annotator writes it — the glyph
// first (!! ! ?! ??), set in the grade's colour, with the label in plain words next to it.
// Confidence reads as an eval meter. Colour encodes evidence and nothing else, so an
// unverified claim can never pose as established fact (L3). See planning/DESIGN.md.

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type EvidenceGrade = "A" | "B" | "C" | "D";

export const GRADE_DETAILS: Record<
  EvidenceGrade,
  { glyph: string; label: string; note: string; detail: string; cls: string }
> = {
  A: {
    glyph: "!!",
    label: "Grade A",
    note: "Strong, replicated evidence",
    detail: "Multiple high-quality studies show consistent results.",
    cls: "text-grade-a",
  },
  B: {
    glyph: "!",
    label: "Grade B",
    note: "Suggestive but limited",
    detail:
      "Good experimental evidence exists, but replication in chess is limited.",
    cls: "text-grade-b",
  },
  C: {
    glyph: "?!",
    label: "Grade C",
    note: "Theory / best-guess",
    detail:
      "A plausible mechanism exists, but it lacks direct empirical proof.",
    cls: "text-grade-c",
  },
  D: {
    glyph: "??",
    label: "Grade D",
    note: "Popular but unsupported; avoid",
    detail: "Popular training lore not supported by empirical data.",
    cls: "text-grade-d",
  },
};

/** How much of the bar a grade earns — the fill used by .meter and by GradeMark. */
export const GRADE_FILL: Record<EvidenceGrade, number> = {
  A: 100,
  B: 72,
  C: 46,
  D: 22,
};

export const TIER_NOTE: Record<number, string> = {
  1: "chess-specific",
  2: "general learning science",
};

export const TIER_EXPLANATIONS: Record<number, string> = {
  1: "Direct empirical research on chess players and chess problem solving.",
  2: "General cognitive science and spaced repetition research applied to chess.",
};

export function asEvidenceGrade(g: string): EvidenceGrade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

/** GradeGlyph: the annotation mark alone, for inline use after a title (like `!!` after a move). */
export function GradeGlyph({
  grade,
  className,
}: {
  grade: string;
  className?: string;
}) {
  const meta = GRADE_DETAILS[asEvidenceGrade(grade)]!;
  return (
    <span
      className={cn(
        "font-mono text-[0.95em] font-bold leading-none",
        meta.cls,
        className,
      )}
      title={meta.note}
    >
      {meta.glyph}
    </span>
  );
}

/**
 * GradeMark: the interactive annotation chip for an evidence grade. The glyph carries the
 * verdict (‼ best line to ?? blunder-to-avoid); clicking opens the evidence inspection panel.
 */
export function GradeMark({
  grade,
  tier,
  className,
  interactive = true,
}: {
  grade: string;
  tier?: number;
  className?: string;
  interactive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const g = asEvidenceGrade(grade);
  const meta = GRADE_DETAILS[g]!;

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const badgeContent = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "font-mono text-[0.85rem] font-bold leading-none",
          meta.cls,
        )}
      >
        {meta.glyph}
      </span>
      <span className="font-sans text-[0.78rem] font-medium text-ink">
        {meta.label}
      </span>
      {tier != null && (
        <span className="font-sans text-[0.78rem] text-graphite">
          {TIER_NOTE[tier] ?? `tier ${tier}`}
        </span>
      )}
    </>
  );

  const badgeClass = cn(
    "inline-flex items-baseline gap-1.5 rounded-[2px] py-0.5 pl-1.5 pr-2 text-left",
    className,
  );

  if (!interactive) {
    return (
      <span className={badgeClass} title={meta.note}>
        {badgeContent}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={`Evidence ${meta.label}: ${meta.note}. Open the evidence note.`}
        title={`${meta.note} (open the evidence note)`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " className=") {
            e.preventDefault();
            e.stopPropagation();
            setOpen((prev) => !prev);
          }
        }}
        className={cn(
          badgeClass,
          "cursor-pointer underline decoration-rule decoration-1 underline-offset-[3px] transition-colors hover:decoration-biro",
        )}
      >
        {badgeContent}
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Evidence inspection details"
          className="bg-sheet absolute left-0 top-full z-50 mt-1.5 w-72 rounded-[6px] border border-rule p-3.5 shadow-float sm:w-80"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-baseline gap-1.5">
              <span className={cn("font-mono text-sm font-bold", meta.cls)}>
                {meta.glyph}
              </span>
              <span className="text-[0.9rem] font-semibold">{meta.label}</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              aria-label="Close evidence note"
              className="rounded-[2px] p-1 text-graphite hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-2.5 flex flex-col gap-2.5 text-left">
            <p className="font-serif text-[0.9rem] leading-relaxed text-ink">
              <span className="font-semibold">{meta.note}.</span> {meta.detail}
            </p>

            {tier != null && (
              <div>
                <p className="label">Evidence tier</p>
                <p className="font-serif mt-0.5 text-[0.9rem] leading-relaxed text-ink">
                  <span className="font-semibold capitalize">
                    {TIER_NOTE[tier] ?? `Tier ${tier}`}:
                  </span>{" "}
                  {TIER_EXPLANATIONS[tier] ??
                    "Empirical research supporting this recommendation."}
                </p>
              </div>
            )}

            <div className="rounded-[3px] border-l-[3px] border-biro/40 bg-ink/[0.02] py-1.5 pl-2.5 pr-2">
              <p className="label">What Mainline will never claim</p>
              <p className="font-serif mt-0.5 text-[0.85rem] leading-normal text-graphite">
                No training activity is proven to cause a rating gain. We
                schedule the methods with the best available support.
              </p>
            </div>

            <div className="border-t border-rule pt-2">
              <p className="label mb-1.5">Grade scale</p>
              <ul className="flex flex-col gap-1">
                {(["A", "B", "C", "D"] as EvidenceGrade[]).map((gradeKey) => {
                  const itemMeta = GRADE_DETAILS[gradeKey]!;
                  const isCurrent = gradeKey === g;
                  return (
                    <li
                      key={gradeKey}
                      className={cn(
                        "flex items-center gap-2 text-[0.78rem]",
                        isCurrent ? "text-ink" : "text-graphite",
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 shrink-0 text-center font-mono font-bold",
                          itemMeta.cls,
                        )}
                      >
                        {itemMeta.glyph}
                      </span>
                      <span className="min-w-[4.5rem]">{itemMeta.label}</span>
                      <span className="bg-rule relative h-1.5 flex-1 overflow-hidden rounded-[1px]">
                        <span
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-[1px]",
                            gradeKey === "A" && "bg-grade-a",
                            gradeKey === "B" && "bg-grade-b",
                            gradeKey === "C" && "bg-grade-c",
                            gradeKey === "D" && "bg-grade-d",
                          )}
                          style={{ width: `${GRADE_FILL[gradeKey]}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CONFIDENCE: Record<
  string,
  { filled: number; note: string; label: string }
> = {
  insufficient: {
    filled: 0,
    note: "not enough of your data yet",
    label: "none",
  },
  low: {
    filled: 1,
    note: "a band prior, not your own data yet",
    label: "low",
  },
  medium: {
    filled: 2,
    note: "some of your own data",
    label: "medium",
  },
  high: { filled: 4, note: "well-backed by your own data", label: "high" },
};

/**
 * ConfidenceMeter: how much of your data backs a call, drawn as an eval meter.
 * Empty segments are honest about what is not known yet.
 */
export function ConfidenceMeter({
  confidence,
  className,
}: {
  confidence: string;
  className?: string;
}) {
  const meta = CONFIDENCE[confidence] ?? CONFIDENCE.low!;
  return (
    <span
      className={cn("inline-flex flex-col items-start gap-1", className)}
      title={meta.note}
    >
      <span className="inline-flex items-center gap-2">
        <span className="label">Confidence</span>
        <span className="flex items-center gap-[3px]" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-[5px] rounded-[1px]",
                i < meta.filled ? "bg-ink" : "bg-rule",
              )}
            />
          ))}
        </span>
        <span className="font-mono text-[0.75rem] text-graphite">
          {meta.label}
        </span>
      </span>
      <span className="font-serif text-[0.78rem] italic leading-tight text-graphite">
        {meta.note}
      </span>
    </span>
  );
}

/** @deprecated Kept so older imports resolve; the meter reads confidence, not a grade. */
export const ConfidenceBar = ConfidenceMeter;

/** ProvisionalTag: flags a stub / best-guess value so it never reads as established fact (L3). */
export function ProvisionalTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-brick inline-flex items-center gap-1.5 rounded-[2px] border border-dashed border-brick/45 bg-brick/[0.06] px-1.5 py-0.5 text-[0.72rem] font-medium",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 border-t border-dashed border-brick"
      />
      Provisional
    </span>
  );
}

/** @deprecated Use ProvisionalTag */
export const PlaceholderTag = ProvisionalTag;
