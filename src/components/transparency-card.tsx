"use client";

// TransparencyCard: The honesty-brand component (BUILD.md section 7.6). It renders the
// "why this / why now" rationale snapshotted on a ProgramItem (L3) as a chess annotation:
// the evidence grade as an interactive badge, confidence as an eval meter,
// and a dashed or struck treatment for thin or provisional evidence so it can never read as
// established fact (VISION section 2).

import {
  GradeMark,
  ConfidenceBar,
} from "@/components/evidence";
import { WhyButton } from "@/components/ui/why-button";
import { cn } from "@/lib/utils";

export interface TransparencyCardItem {
  title?: string;
  rationaleText: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource?: string | null;
  confidence: string;
  soften: boolean;
  flag?: string;
}

export interface TransparencyCardProps extends TransparencyCardItem {
  className?: string;
  defaultCollapsed?: boolean;
  /** When true, the toggle button is hidden and the content is always visible. */
  hideToggle?: boolean;
}

export interface TransparencyCardGroupProps {
  items: readonly TransparencyCardItem[];
  className?: string;
  defaultCollapsed?: boolean;
}

export function TransparencyDetails({
  item,
  grouped,
}: {
  item: TransparencyCardItem;
  grouped: boolean;
}) {
  return (
    <section
      className={cn(
        grouped && "border-l-2 border-line/60 pl-3 py-3 first:pt-2 last:pb-0",
      )}
    >
      {item.title && (
        <h3 className="text-graphite font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em]">
          {item.title}
        </h3>
      )}
      <p className="text-ink mt-2 font-sans text-sm leading-relaxed">
        {item.rationaleText}
      </p>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <GradeMark grade={item.evidenceGrade} tier={item.evidenceTier} />
        <ConfidenceBar confidence={item.confidence} />
      </div>

      {item.soften && (
        <p className="text-graphite mt-3 border-l-2 border-amber/50 pl-3 font-sans text-xs italic leading-relaxed">
          Honest caveat: the evidence here is thin. Treat this as a best-guess
          starting point, not a proven prescription. No training activity is
          proven to cause a rating gain.
        </p>
      )}

      <p className="text-graphite mt-3 font-mono text-xs">
        <span className="uppercase tracking-[0.12em]">Evidence source</span> ·{" "}
        {item.citationSource ?? item.citationKey}
      </p>
    </section>
  );
}

export function TransparencyCard({
  className,
  defaultCollapsed = true,
  hideToggle = false,
  ...item
}: TransparencyCardProps) {
  if (hideToggle || !defaultCollapsed) {
    return (
      <div
        className={cn(
          "bg-paper-raised/60 rounded-md border border-line p-3 sm:p-4",
          className,
        )}
        role="note"
      >
        <div className="flex items-center justify-between mb-2">
          <WhyButton items={[item]} label="Why this?" />
        </div>
        <TransparencyDetails item={item} grouped={false} />
      </div>
    );
  }

  return (
    <div className={cn("inline-block", className)}>
      <WhyButton
        items={[item]}
        title={item.title ?? "Why this recommendation?"}
        label="Why this?"
      />
    </div>
  );
}

export function TransparencyCardGroup({
  items,
  className,
  defaultCollapsed = true,
}: TransparencyCardGroupProps) {
  if (!defaultCollapsed) {
    return (
      <div
        className={cn(
          "bg-paper-raised/60 rounded-md border border-line p-3 sm:p-4",
          className,
        )}
        role="note"
      >
        <div className="flex items-center justify-between mb-2">
          <WhyButton items={items} label="Why this?" />
        </div>
        {items.map((item, index) => (
          <TransparencyDetails
            key={`${item.citationKey}-${index}`}
            item={item}
            grouped={items.length > 1}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("inline-block", className)}>
      <WhyButton items={items} label="Why this?" />
    </div>
  );
}
