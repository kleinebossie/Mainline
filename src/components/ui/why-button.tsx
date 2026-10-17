"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EvidenceChip } from "@/components/ui/evidence-chip";
import {
  ConfidenceBar,
  ProvisionalTag,
  TIER_EXPLANATIONS,
  TIER_NOTE,
} from "@/components/evidence";
import { cn } from "@/lib/utils";

export interface WhyButtonRationaleItem {
  title?: string;
  rationaleText: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource?: string | null;
  confidence?: string;
  soften?: boolean;
  flag?: string;
}

export interface WhyButtonProps extends Partial<WhyButtonRationaleItem> {
  items?: readonly WhyButtonRationaleItem[];
  label?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function WhyButton({
  items,
  label = "Why this?",
  className,
  open,
  onOpenChange,
  children,
  ...singleProps
}: WhyButtonProps) {
  const resolvedItems: readonly WhyButtonRationaleItem[] = items ?? [
    {
      title: singleProps.title,
      rationaleText: singleProps.rationaleText ?? "",
      evidenceGrade: singleProps.evidenceGrade ?? "C",
      evidenceTier: singleProps.evidenceTier ?? 1,
      citationKey: singleProps.citationKey ?? "",
      citationSource: singleProps.citationSource,
      confidence: singleProps.confidence ?? "medium",
      soften: singleProps.soften ?? false,
      flag: singleProps.flag,
    },
  ];

  const hasProvisional = resolvedItems.some(
    (item) => item.flag === "stub" || item.flag === "best-guess",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label="Inspect evidence rationale"
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-xs px-2 py-1 font-sans text-xs font-medium text-graphite transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper min-h-9 sm:min-h-0",
              className,
            )}
          >
            <HelpCircle
              className="h-3.5 w-3.5 shrink-0 text-evergreen"
              aria-hidden="true"
            />
            <span>{label}</span>
            {hasProvisional && <ProvisionalTag className="ml-1" />}
          </button>
        )}
      </SheetTrigger>

      <SheetContent side="responsive" className="flex flex-col gap-5 text-left">
        <SheetHeader>
          <SheetTitle>
            {singleProps.title ?? "Recommendation rationale"}
          </SheetTitle>
          <SheetDescription>
            Scientific rationale and empirical backing from the Mainline methodology.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 divide-y divide-line/60 overflow-y-auto pr-1">
          {resolvedItems.map((item, index) => {
            const isProvisional =
              item.flag === "stub" || item.flag === "best-guess";
            const tierNote =
              TIER_NOTE[item.evidenceTier] ?? `tier ${item.evidenceTier}`;
            const tierExplanation = TIER_EXPLANATIONS[item.evidenceTier];

            return (
              <div
                key={`${item.citationKey}-${index}`}
                className={cn("flex flex-col gap-3.5", index > 0 && "pt-6")}
              >
                {item.title && (
                  <h4 className="font-sans text-sm font-semibold text-ink">
                    {item.title}
                  </h4>
                )}

                <p className="font-sans text-sm leading-relaxed text-ink">
                  {item.rationaleText}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <EvidenceChip
                    grade={item.evidenceGrade}
                    tier={item.evidenceTier}
                  />
                  {item.confidence && (
                    <ConfidenceBar confidence={item.confidence} />
                  )}
                  {isProvisional && <ProvisionalTag />}
                </div>

                {item.soften && (
                  <div className="rounded-xs border-l-2 border-amber/60 bg-amber/5 p-3 font-sans text-xs italic leading-relaxed text-graphite">
                    Honest caveat: the evidence here is thin. Treat this as a
                    best-guess starting point, not a proven prescription. No
                    training activity is proven to cause a rating gain.
                  </div>
                )}

                <div className="rounded-xs border border-line bg-paper p-3 text-xs space-y-1.5">
                  <p className="font-sans text-xs text-ink leading-relaxed">
                    <span className="font-semibold capitalize">
                      {tierNote}:
                    </span>{" "}
                    <span className="text-graphite">
                      {tierExplanation ??
                        "Empirical research supporting this recommendation."}
                    </span>
                  </p>
                  <p className="font-mono text-[0.7rem] text-graphite">
                    <span className="uppercase tracking-[0.1em]">
                      Evidence source
                    </span>{" "}
                    · {item.citationSource ?? item.citationKey}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
