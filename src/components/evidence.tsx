"use client";

// The evidence-annotation system: Mainline's signature and the visible form of the
// honesty brand (VISION §2). Evidence grades borrow chess's annotation grammar
// (!! ! ?! ??) and confidence reads like an engine's depth meter. Color encodes evidence
// and nothing else, so trust is legible at a glance and an unverified claim can never pose as
// established fact (L3).

import { useEffect, useId, useRef, useState } from "react";
import { Flag, X } from "lucide-react";
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
    cls: "text-grade-a border-grade-a/40 bg-grade-a/10",
  },
  B: {
    glyph: "!",
    label: "Grade B",
    note: "Suggestive but limited",
    detail:
      "Good experimental evidence exists, but replication in chess is limited.",
    cls: "text-grade-b border-grade-b/40 bg-grade-b/10",
  },
  C: {
    glyph: "?!",
    label: "Grade C",
    note: "Theory / best-guess",
    detail:
      "A plausible mechanism exists, but it lacks direct empirical proof.",
    cls: "text-grade-c border-grade-c/40 bg-grade-c/10",
  },
  D: {
    glyph: "??",
    label: "Grade D",
    note: "Popular but unsupported; avoid",
    detail: "Popular training lore not supported by empirical data.",
    cls: "text-grade-d border-grade-d/40 bg-grade-d/10",
  },
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

/**
 * GradeMark: An interactive chess-annotation chip for an evidence grade.
 * The glyph carries the verdict (‼ best line to ?? blunder-to-avoid).
 * Supports click and keyboard activation to open an evidence inspection popover.
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
  const meta = GRADE_DETAILS[g];

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
        className="font-mono text-xs font-bold leading-none shrink-0 inline-flex items-center justify-center tracking-tight"
      >
        {meta.glyph}
      </span>
      <span className="tracking-tight">{meta.label}</span>
      {tier != null && (
        <span className="text-graphite font-normal">
          · {TIER_NOTE[tier] ?? `tier ${tier}`}
        </span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-xs font-medium",
          meta.cls,
          className,
        )}
        title={meta.note}
      >
        {badgeContent}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={`Evidence ${meta.label}: ${meta.note}. Click to inspect evidence details.`}
        title={`${meta.note} (click to inspect)`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setOpen((prev) => !prev);
          }
        }}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-xs font-medium transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
          meta.cls,
          className,
        )}
      >
        {badgeContent}
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Evidence inspection details"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 sm:w-80 rounded-md border border-line bg-paper-raised/95 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
        >
          <div className="flex items-start justify-between gap-2 border-b border-line/80 pb-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-xs font-bold",
                  meta.cls,
                )}
              >
                <span>{meta.glyph}</span>
                <span>{meta.label}</span>
              </span>
              <span className="font-serif text-xs font-semibold text-ink">
                Evidence Standard
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              aria-label="Close evidence inspection"
              className="rounded-xs p-1 text-graphite hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-2.5 flex flex-col gap-2.5 text-left">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-graphite">
                Current Rating
              </p>
              <p className="mt-0.5 font-serif text-xs leading-relaxed text-ink">
                <span className="font-semibold">{meta.note}.</span>{" "}
                {meta.detail}
              </p>
            </div>

            {tier != null && (
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-graphite">
                  Evidence Tier
                </p>
                <p className="mt-0.5 font-serif text-xs leading-relaxed text-ink">
                  <span className="font-semibold capitalize">
                    {TIER_NOTE[tier] ?? `Tier ${tier}`}:
                  </span>{" "}
                  {TIER_EXPLANATIONS[tier] ??
                    "Empirical research supporting this recommendation."}
                </p>
              </div>
            )}

            <div className="rounded-sm border border-line/60 bg-paper/60 p-2 text-left">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-graphite">
                Mainline Honesty Commitment
              </p>
              <p className="mt-1 font-serif text-[0.75rem] leading-normal text-graphite">
                No training activity is proven to cause a rating gain. We
                schedule methods with the best available scientific support.
              </p>
            </div>

            <div className="border-t border-line/70 pt-2">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-graphite mb-1.5">
                Grade Scale
              </p>
              <div className="grid grid-cols-2 gap-1 font-mono text-[0.68rem]">
                {(["A", "B", "C", "D"] as EvidenceGrade[]).map((gradeKey) => {
                  const itemMeta = GRADE_DETAILS[gradeKey];
                  const isCurrent = gradeKey === g;
                  return (
                    <div
                      key={gradeKey}
                      className={cn(
                        "flex items-center gap-1 rounded-xs px-1.5 py-0.5",
                        isCurrent
                          ? "bg-ink/10 font-bold text-ink"
                          : "text-graphite",
                      )}
                    >
                      <span className="w-3 text-center">{itemMeta.glyph}</span>
                      <span>{itemMeta.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CONFIDENCE: Record<string, { filled: number; note: string }> = {
  insufficient: { filled: 0, note: "not enough of your data yet" },
  low: { filled: 1, note: "a band prior, not your own data yet" },
  medium: { filled: 2, note: "some of your own data" },
  high: { filled: 4, note: "well-backed by your own data" },
};

/**
 * ConfidenceBar: How much of your data backs a call, drawn like an engine's depth meter.
 * Four segments; empty segments are honest about what we do not know yet.
 */
export function ConfidenceBar({
  confidence,
  className,
}: {
  confidence: string;
  className?: string;
}) {
  const meta = CONFIDENCE[confidence] ?? CONFIDENCE.low!;
  return (
    <span
      className={cn("inline-flex flex-col items-start gap-0.5", className)}
      title={meta.note}
    >
      <span className="inline-flex items-center gap-2">
        <span className="eyebrow !text-[0.62rem] !tracking-[0.14em]">
          Confidence
        </span>
        <span className="flex items-center gap-[3px]" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-[6px] rounded-[1px]",
                i < meta.filled ? "bg-evergreen" : "bg-ink/15",
              )}
            />
          ))}
        </span>
        <span className="text-graphite font-mono text-xs lowercase">
          {confidence}
        </span>
      </span>
      <span className="text-graphite font-serif text-[0.7rem] italic leading-tight">
        {meta.note}
      </span>
    </span>
  );
}

/** ProvisionalTag: Flags a stub / best-guess value so it never reads as established fact (L3). */
export function ProvisionalTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-clay border-clay/40 bg-clay/10 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em]",
        className,
      )}
    >
      <Flag className="h-3 w-3 stroke-[2]" aria-hidden="true" /> Provisional
    </span>
  );
}

/** @deprecated Use ProvisionalTag */
export const PlaceholderTag = ProvisionalTag;
