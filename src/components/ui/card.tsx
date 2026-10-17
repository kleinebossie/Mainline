import * as React from "react";

import type { EvidenceGrade } from "@/components/evidence";
import { cn } from "@/lib/utils";

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
      "bg-card text-card-foreground rounded-md border border-line shadow-sm",
      gutter && "eval-gutter",
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
    className={cn("flex flex-col space-y-1.5 p-5 sm:p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "font-serif text-xl sm:text-2xl font-semibold leading-tight tracking-tight",
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
  <div
    ref={ref}
    className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)}
    {...props}
  />
));
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
