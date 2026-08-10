import * as React from "react";

import { cn } from "@/lib/utils";

type StatusTone = "loading" | "neutral" | "success" | "error";

const TONE_CLASSES: Record<StatusTone, string> = {
  loading: "border-line bg-paper/70 text-graphite",
  neutral: "border-line bg-paper/70 text-graphite",
  success: "border-evergreen/35 bg-evergreen/5 text-evergreen",
  error: "border-clay/35 bg-clay/[0.06] text-clay",
};

const TONE_MARKS: Record<Exclude<StatusTone, "loading">, string> = {
  neutral: "i",
  success: "✓",
  error: "!",
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
    return (
      <div
        ref={ref}
        role={role ?? (tone === "error" ? "alert" : "status")}
        aria-live={ariaLive ?? (tone === "error" ? "assertive" : "polite")}
        aria-busy={tone === "loading" ? true : undefined}
        className={cn(
          "flex items-start gap-3 rounded-md border px-4 py-3",
          TONE_CLASSES[tone],
          className,
        )}
        {...props}
      >
        {tone === "loading" ? (
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center"
          >
            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current" />
          </span>
        ) : (
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-current/25 font-mono text-xs font-semibold leading-none"
          >
            {TONE_MARKS[tone]}
          </span>
        )}
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
