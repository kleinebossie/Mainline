import * as React from "react";

import { cn } from "@/lib/utils";

// A card is an "analysis entry" on the sheet: raised paper, a hairline, a soft shadow.
// Pass `gutter` (an evidence grade) to light the leading eval-gutter that ties a card to
// how strong its evidence is.
type Grade = "A" | "B" | "C" | "D";

const Card = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { gutter?: Grade; provisional?: boolean }
>(({ className, gutter, provisional, ...props }, ref) => (
  <div
    ref={ref}
    data-grade={gutter}
    data-provisional={provisional ? "true" : undefined}
    className={cn(
      "bg-card text-card-foreground rounded-lg border shadow-sheet",
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
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "font-serif text-2xl font-semibold leading-tight tracking-tight",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-graphite text-sm leading-relaxed", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
