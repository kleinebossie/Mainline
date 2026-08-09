// The evidence-annotation system — Mainline's signature, and the visible form of the
// honesty brand (VISION §2). Evidence grades borrow chess's own annotation grammar
// (!! ! ?! ??) and confidence reads like an engine's depth meter. Color encodes evidence
// and nothing else, so trust is legible at a glance and a placeholder can never pose as
// established fact (L3).

import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export type EvidenceGrade = "A" | "B" | "C" | "D";

const GRADE: Record<
  EvidenceGrade,
  { glyph: string; label: string; note: string; cls: string }
> = {
  A: {
    glyph: "‼",
    label: "Grade A",
    note: "Strong, replicated evidence",
    cls: "text-grade-a border-grade-a/40 bg-grade-a/10",
  },
  B: {
    glyph: "!",
    label: "Grade B",
    note: "Suggestive but limited",
    cls: "text-grade-b border-grade-b/40 bg-grade-b/10",
  },
  C: {
    glyph: "?!",
    label: "Grade C",
    note: "Theory / best-guess",
    cls: "text-grade-c border-grade-c/40 bg-grade-c/10",
  },
  D: {
    glyph: "??",
    label: "Grade D",
    note: "Popular but unsupported; avoid",
    cls: "text-grade-d border-grade-d/40 bg-grade-d/10",
  },
};

const TIER_NOTE: Record<number, string> = {
  1: "chess-specific",
  2: "general learning science",
};

export function asEvidenceGrade(g: string): EvidenceGrade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

/**
 * GradeMark — a chess-annotation chip for an evidence grade. The glyph carries the verdict
 * (‼ best line … ?? blunder-to-avoid); the optional tier names where the evidence comes from.
 */
export function GradeMark({
  grade,
  tier,
  className,
}: {
  grade: string;
  tier?: number;
  className?: string;
}) {
  const g = asEvidenceGrade(grade);
  const meta = GRADE[g];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-xs font-medium",
        meta.cls,
        className,
      )}
      title={meta.note}
    >
      <span aria-hidden className="text-sm font-bold leading-none">
        {meta.glyph}
      </span>
      <span className="tracking-tight">{meta.label}</span>
      {tier != null && (
        <span className="text-graphite font-normal">
          · {TIER_NOTE[tier] ?? `tier ${tier}`}
        </span>
      )}
    </span>
  );
}

const CONFIDENCE: Record<string, { filled: number; note: string }> = {
  insufficient: { filled: 0, note: "not enough of your data yet" },
  low: { filled: 1, note: "a band prior, not your own data yet" },
  medium: { filled: 2, note: "some of your own data" },
  high: { filled: 4, note: "well-backed by your own data" },
};

/**
 * ConfidenceBar — how much of *your* data backs a call, drawn like an engine's depth/eval
 * meter. Four segments; empty segments are honest about what we don't know yet. The note
 * is surfaced inline (not only via the `title` tooltip) so the meaning is legible on
 * touch devices and at a glance, without a hover gesture or a trip to the About page.
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

/** PlaceholderTag — flags a stub / best-guess value so it never reads as fact (L3). */
export function PlaceholderTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-clay border-clay/40 bg-clay/10 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em]",
        className,
      )}
    >
      <Flag className="h-3 w-3 stroke-[2]" aria-hidden="true" /> Placeholder
    </span>
  );
}
