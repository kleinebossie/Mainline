import * as React from "react";
import { Check, Info, AlertCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type NoticeTone = "loading" | "neutral" | "success" | "error";

const TONE_STYLES: Record<
  NoticeTone,
  { container: string; icon: React.ReactNode; text: string }
> = {
  loading: {
    container: "border-line bg-paper-raised text-graphite",
    icon: (
      <Loader2
        className="h-4 w-4 shrink-0 animate-spin text-graphite"
        aria-hidden="true"
      />
    ),
    text: "text-ink",
  },
  neutral: {
    container: "border-line bg-paper-raised text-graphite",
    icon: (
      <Info
        className="h-4 w-4 shrink-0 text-graphite"
        aria-hidden="true"
      />
    ),
    text: "text-ink",
  },
  success: {
    container: "border-evergreen/40 bg-evergreen/10 text-evergreen",
    icon: (
      <Check
        className="h-4 w-4 shrink-0 text-evergreen"
        aria-hidden="true"
      />
    ),
    text: "text-ink",
  },
  error: {
    container: "border-clay/40 bg-clay/10 text-clay",
    icon: (
      <AlertCircle
        className="h-4 w-4 shrink-0 text-clay"
        aria-hidden="true"
      />
    ),
    text: "text-ink",
  },
};

export interface NoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: NoticeTone;
  heading?: React.ReactNode;
  action?: React.ReactNode;
}

const Notice = React.forwardRef<HTMLDivElement, NoticeProps>(
  (
    {
      className,
      tone = "neutral",
      heading,
      action,
      children,
      role,
      "aria-live": ariaLive,
      ...props
    },
    ref,
  ) => {
    const style = TONE_STYLES[tone];

    return (
      <div
        ref={ref}
        role={role ?? (tone === "error" ? "alert" : "status")}
        aria-live={ariaLive ?? (tone === "error" ? "assertive" : "polite")}
        aria-busy={tone === "loading" ? true : undefined}
        className={cn(
          "flex items-start gap-3 rounded-md border p-4 text-left",
          style.container,
          className,
        )}
        {...props}
      >
        <span className="mt-0.5 shrink-0">{style.icon}</span>
        <div className="flex-1 min-w-0">
          {heading && (
            <h4 className="font-sans text-sm font-semibold text-ink leading-tight">
              {heading}
            </h4>
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
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    );
  },
);
Notice.displayName = "Notice";

export { Notice };
