import * as React from "react";

import type { EvidenceGrade } from "@/components/evidence";
import { cn } from "@/lib/utils";

// A card is one entry on the sheet: flat paper, a hairline, a 1px lift. Pass `gutter` (an
// evidence grade) to light the eval meter on its leading edge — colour is the grade, fill
// height is how much of the bar that grade earns, so thin evidence never fills the bar.
const Card = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    gutter?: EvidenceGrade;
    provisional?: boolean;
  }
>(({ className, gutter, provisional, ...props }, ref) => (
  <div
    ref={ref}
    data-grade={gutter}
    data-provisional={provisional ? "true" : undefined}
    className={cn(
      "sheet text-card-foreground rounded-[6px]",
      gutter && "meter",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "text-[1.15rem] font-semibold leading-[1.2] tracking-[-0.02em]",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
