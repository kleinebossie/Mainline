"use client";

// TransparencyCard: The honesty-brand component (BUILD.md §7.6). It renders the
// "why this / why now" rationale snapshotted on a ProgramItem (L3) as a chess-style
// annotation: the evidence grade as an interactive badge, confidence as an eval meter,
// and a dashed/struck treatment for thin or provisional evidence so it can never read as
// established fact (VISION §2).

import { useId, useState } from "react";
import { CircleHelp, ChevronDown } from "lucide-react";
import {
  GradeMark,
  ConfidenceBar,
  ProvisionalTag,
} from "@/components/evidence";
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

function TransparencyDetails({
  item,
  grouped,
}: {
  item: TransparencyCardItem;
  grouped: boolean;
}) {
  return (
    <section
      className={cn(
        grouped && "border-l-2 border-line/40 pl-3 py-3 first:pt-2 last:pb-0",
      )}
    >
      {item.title && (
        <h3 className="text-graphite font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em]">
          {item.title}
        </h3>
      )}
      <p className="text-ink mt-2 font-serif text-[0.95rem] leading-relaxed">
        {item.rationaleText}
      </p>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <GradeMark grade={item.evidenceGrade} tier={item.evidenceTier} />
        <ConfidenceBar confidence={item.confidence} />
      </div>

      {item.soften && (
        <p className="text-graphite mt-3 border-l-2 border-amber/50 pl-3 font-serif text-sm italic leading-relaxed">
          Honest caveat: the evidence here is thin. Treat this as a best-guess
          starting point, not a proven prescription. No training activity is
          proven to cause a rating gain.
        </p>
      )}

      <p className="text-graphite mt-3 font-mono text-[0.7rem]">
        <span className="uppercase tracking-[0.12em]">Evidence source</span> ·{" "}
        {item.citationSource ?? item.citationKey}
      </p>
    </section>
  );
}

function TransparencyDisclosure({
  items,
  className,
  defaultCollapsed = true,
  hideToggle = false,
}: TransparencyCardGroupProps & { hideToggle?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const contentId = useId();
  const hasProvisional = items.some(
    (item) => item.flag === "stub" || item.flag === "best-guess",
  );
  const expanded = hideToggle || !collapsed;

  return (
    <div
      className={cn(
        "bg-paper/60 rounded-md border border-dashed p-4",
        className,
      )}
      role="note"
    >
      {!hideToggle && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls={contentId}
            className="eyebrow group flex cursor-pointer items-center gap-2 rounded-sm text-graphite transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <CircleHelp
              className="h-3.5 w-3.5 shrink-0 text-evergreen"
              aria-hidden="true"
            />
            <span>Why this?</span>
            <span className="font-mono text-[0.62rem] text-graphite/70 group-hover:text-ink">
              ({collapsed ? "click to expand" : "click to collapse"})
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-graphite transition-transform duration-200 group-hover:text-ink",
                collapsed && "-rotate-90",
              )}
              aria-hidden="true"
            />
          </button>
          {hasProvisional && <ProvisionalTag />}
        </div>
      )}

      {expanded && (
        <div id={contentId}>
          {items.map((item, index) => (
            <TransparencyDetails
              key={`${item.citationKey}-${index}`}
              item={item}
              grouped={items.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TransparencyCard({
  className,
  defaultCollapsed,
  hideToggle,
  ...item
}: TransparencyCardProps) {
  return (
    <TransparencyDisclosure
      items={[item]}
      className={className}
      defaultCollapsed={defaultCollapsed}
      hideToggle={hideToggle}
    />
  );
}

export function TransparencyCardGroup({
  items,
  className,
  defaultCollapsed,
}: TransparencyCardGroupProps) {
  return (
    <TransparencyDisclosure
      items={items}
      className={className}
      defaultCollapsed={defaultCollapsed}
    />
  );
}
