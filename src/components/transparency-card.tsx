// TransparencyCard — the honesty-brand component (BUILD.md §7.6). It renders the
// "why this / why now" rationale snapshotted on a ProgramItem (L3) as a chess-style
// annotation: the evidence grade as a glyph, the confidence as an eval meter, and a
// dashed/struck treatment for thin (C/D) or placeholder evidence so it can never read as
// established fact (VISION §2).

import {
  GradeMark,
  ConfidenceBar,
  PlaceholderTag,
} from "@/components/evidence";
import { cn } from "@/lib/utils";

export interface TransparencyCardProps {
  rationaleText: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource?: string | null;
  confidence: string;
  soften: boolean;
  flag?: string;
  className?: string;
}

export function TransparencyCard({
  rationaleText,
  evidenceGrade,
  evidenceTier,
  citationKey,
  citationSource,
  confidence,
  soften,
  flag,
  className,
}: TransparencyCardProps) {
  const isPlaceholder = flag === "stub" || flag === "best-guess";

  return (
    <div
      className={cn("bg-paper/60 rounded-md border border-dashed p-4", className)}
      role="note"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-2">
          <span aria-hidden className="text-evergreen not-italic">
            ∴
          </span>
          Why this?
        </p>
        {isPlaceholder && <PlaceholderTag />}
      </div>

      <p className="text-ink mt-2 font-serif text-[0.95rem] leading-relaxed">
        {rationaleText}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <GradeMark grade={evidenceGrade} tier={evidenceTier} />
        <ConfidenceBar confidence={confidence} />
      </div>

      {soften && (
        <p className="text-graphite mt-3 border-l-2 border-amber/50 pl-3 font-serif text-sm italic leading-relaxed">
          Honest caveat: the evidence here is thin — treat this as a best-guess
          starting point, not a proven prescription. No training activity is
          proven to cause a rating gain.
        </p>
      )}

      <p className="text-graphite mt-3 font-mono text-[0.7rem]">
        <span className="uppercase tracking-[0.12em]">Source</span> ·{" "}
        {citationSource ?? citationKey}
      </p>
    </div>
  );
}
