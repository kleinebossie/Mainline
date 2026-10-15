"use client";

// TransparencyCard: the honesty-brand component (BUILD.md §7.6). It renders the
// "why this / why now" rationale snapshotted on a ProgramItem (L3) as a margin note: the
// evidence grade as an annotation glyph, confidence as an eval meter, and a dashed rule for
// thin or provisional evidence so it can never read as established fact (VISION §2).

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  GradeMark,
  ConfidenceMeter,
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
    <section className={cn(grouped && "py-3 first:pt-1 last:pb-1")}>
      {item.title && <h3 className="label-ink">{item.title}</h3>}
      <p className="font-serif mt-1.5 text-[0.95rem] leading-relaxed text-ink">
        {item.rationaleText}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <GradeMark grade={item.evidenceGrade} tier={item.evidenceTier} />
        <ConfidenceMeter confidence={item.confidence} />
      </div>

      {item.soften && (
        <p className="font-serif mt-2.5 border-l-[3px] border-dashed border-ochre/60 pl-2.5 text-[0.88rem] italic leading-relaxed text-graphite">
          The evidence here is thin. Treat this as a best-guess starting point,
          not a proven prescription. No training activity is proven to cause a
          rating gain.
        </p>
      )}

      <p className="mt-2.5 font-mono text-[0.72rem] leading-relaxed text-graphite">
        <span className="text-ink">Source</span>{" "}
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
        "rounded-[3px] border-l-[3px] border-rule bg-ink/[0.02] py-2.5 pl-3 pr-2",
        hasProvisional && "border-dashed border-ochre/55",
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
            className="group inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[2px] pr-1 text-[0.85rem] font-medium text-graphite transition-colors hover:text-ink"
          >
            <span>Why this?</span>
            <span className="font-mono text-[0.7rem] text-graphite/80 group-hover:text-ink">
              {expanded ? "hide" : "show"}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
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
