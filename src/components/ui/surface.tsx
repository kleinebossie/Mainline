import * as React from "react";
import type { EvidenceGrade } from "@/components/evidence";
import { cn } from "@/lib/utils";

export interface SurfaceProps extends React.ComponentProps<"div"> {
  gutter?: EvidenceGrade;
  provisional?: boolean;
  raised?: boolean;
}

const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, gutter, provisional, raised = true, ...props }, ref) => (
    <div
      ref={ref}
      data-grade={gutter}
      data-provisional={provisional ? "true" : undefined}
      className={cn(
        "rounded-md border border-line text-ink transition-colors",
        raised ? "bg-paper-raised" : "bg-paper",
        gutter && "eval-gutter",
        className,
      )}
      {...props}
    />
  ),
);
Surface.displayName = "Surface";

const SurfaceHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5 sm:p-6", className)}
    {...props}
  />
));
SurfaceHeader.displayName = "SurfaceHeader";

const SurfaceTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentProps<"h3">
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-serif text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-ink",
      className,
    )}
    {...props}
  />
));
SurfaceTitle.displayName = "SurfaceTitle";

const SurfaceDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<"p">
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-graphite leading-relaxed", className)}
    {...props}
  />
));
SurfaceDescription.displayName = "SurfaceDescription";

const SurfaceContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)}
    {...props}
  />
));
SurfaceContent.displayName = "SurfaceContent";

export {
  Surface,
  SurfaceHeader,
  SurfaceTitle,
  SurfaceDescription,
  SurfaceContent,
};
