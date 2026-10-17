import * as React from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "loading" | "neutral" | "success" | "error";

const TONE_CLASSES: Record<StatusTone, string> = {
  loading: "border-line bg-paper-raised text-graphite",
  neutral: "border-line bg-paper-raised text-graphite",
  success: "border-evergreen/35 bg-evergreen/10 text-evergreen",
  error: "border-clay/35 bg-clay/10 text-clay",
};

const TONE_MARKS: Record<Exclude<StatusTone, "loading">, string> = {
  neutral: "i",
  success: "✓",
  error: "!",
};

export interface StatusMessageProps extends React.HTMLAttributes<HTMLDivElement> {
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
          "flex items-start gap-3 rounded-md border p-4 text-left",
          TONE_CLASSES[tone],
          className,
        )}
        {...props}
      >
        {tone === "loading" ? (
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5"
          >
            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current" />
          </span>
        ) : (
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xs border border-current/25 font-mono text-xs font-semibold leading-none mt-0.5"
          >
            {TONE_MARKS[tone]}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {heading && (
            <p className="font-sans text-sm font-semibold text-ink leading-tight">
              {heading}
            </p>
          )}
          {children && (
            <div
              className={cn(
                "font-sans text-sm leading-relaxed text-ink/90",
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
