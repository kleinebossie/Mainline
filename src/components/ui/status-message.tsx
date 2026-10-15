import * as React from "react";

import { cn } from "@/lib/utils";

type StatusTone = "loading" | "neutral" | "success" | "error";

// Feedback sits on the sheet as a marginal note: a leading rule in the tone colour, never a
// coloured box that shouts. Errors state what happened and what to press next.
const TONE_CLASSES: Record<StatusTone, { rule: string; text: string }> = {
  loading: { rule: "bg-rule", text: "text-graphite" },
  neutral: { rule: "bg-rule", text: "text-graphite" },
  success: { rule: "bg-tile", text: "text-ink" },
  error: { rule: "bg-brick", text: "text-ink" },
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
    const toneClass = TONE_CLASSES[tone];
    return (
      <div
        ref={ref}
        role={role ?? (tone === "error" ? "alert" : "status")}
        aria-live={ariaLive ?? (tone === "error" ? "assertive" : "polite")}
        aria-busy={tone === "loading" ? true : undefined}
        className={cn(
          "relative flex gap-3 py-3 pl-4 pr-1 text-sm",
          toneClass.text,
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 left-0 w-[3px] rounded-[1px]",
            toneClass.rule,
          )}
        />
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
            className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-rule font-mono text-[0.7rem] font-semibold leading-none"
          >
            {TONE_MARKS[tone]}
          </span>
        )}
        <div className="min-w-0">
          {heading && (
            <p className="text-[0.9rem] font-semibold leading-snug">
              {heading}
            </p>
          )}
          {children && (
            <div
              className={cn(
                "font-serif text-[0.95rem] leading-relaxed",
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
