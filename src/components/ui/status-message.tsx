import * as React from "react";

import { cn } from "@/lib/utils";

type StatusTone = "loading" | "neutral" | "success" | "error";

const TONE: Record<StatusTone, { mark: string; classes: string }> = {
  loading: {
    mark: "·",
    classes: "border-line bg-paper/70 text-graphite",
  },
  neutral: {
    mark: "i",
    classes: "border-line bg-paper/70 text-graphite",
  },
  success: {
    mark: "✓",
    classes: "border-evergreen/35 bg-evergreen/5 text-evergreen",
  },
  error: {
    mark: "!",
    classes: "border-clay/35 bg-clay/[0.06] text-clay",
  },
};

interface StatusMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: StatusTone;
  heading?: React.ReactNode;
}

const StatusMessage = React.forwardRef<HTMLDivElement, StatusMessageProps>(
  (
    {
      className,
      tone = "neutral",
      heading,
      children,
      role,
      "aria-live": ariaLive,
      ...props
    },
    ref,
  ) => {
    const meta = TONE[tone];
    return (
      <div
        ref={ref}
        role={role ?? (tone === "error" ? "alert" : "status")}
        aria-live={ariaLive ?? (tone === "error" ? "assertive" : "polite")}
        className={cn(
          "flex items-start gap-3 rounded-md border px-4 py-3",
          meta.classes,
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-current/25 font-mono text-xs font-semibold leading-none"
        >
          {meta.mark}
        </span>
        <div className="min-w-0">
          {heading && (
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em]">
              {heading}
            </p>
          )}
          {children && (
            <div
              className={cn(
                "font-serif text-sm leading-relaxed",
                heading && "mt-1",
              )}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    );
  },
);
StatusMessage.displayName = "StatusMessage";

export { StatusMessage };
