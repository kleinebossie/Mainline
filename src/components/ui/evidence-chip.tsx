import * as React from "react";
import {
  asEvidenceGrade,
  GRADE_DETAILS,
  TIER_NOTE,
} from "@/components/evidence";
import { cn } from "@/lib/utils";

export interface EvidenceChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  grade: string;
  tier?: number;
}

export function EvidenceChip({
  grade,
  tier,
  className,
  ...props
}: EvidenceChipProps) {
  const g = asEvidenceGrade(grade);
  const meta = GRADE_DETAILS[g];
  const tierNote = tier != null ? TIER_NOTE[tier] ?? `tier ${tier}` : null;
  const accessibleLabel = tierNote
    ? `${meta.label}, ${tierNote}`
    : meta.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 font-sans text-xs font-medium",
        meta.cls,
        className,
      )}
      title={meta.note}
      aria-label={accessibleLabel}
      {...props}
    >
      <span>{meta.label}</span>
      <span
        aria-hidden="true"
        className="font-mono text-[0.7rem] font-bold leading-none shrink-0"
      >
        {meta.glyph}
      </span>
      {tierNote && (
        <span className="text-graphite font-normal" aria-hidden="true">
          · {tierNote}
        </span>
      )}
    </span>
  );
}
