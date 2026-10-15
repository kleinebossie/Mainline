import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared furniture for every signed-in surface: one sheet with a ruled head band, one stat
// readout, one empty state. A panel's `aside` is a readout (a count, a date, a source), not
// a label — if it would not be worth reading twice, leave it out.

export function Panel({
  title,
  aside,
  children,
  className,
  bodyClassName,
  as: Tag = "section",
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div" | "aside";
}) {
  return (
    <Tag className={cn("sheet", className)}>
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2.5 sm:px-5">
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {aside && (
            <span className="font-mono text-[0.72rem] text-graphite">
              {aside}
            </span>
          )}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </Tag>
  );
}

export function Stat({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 py-1", className)}>
      <p className="label">{label}</p>
      <p className="font-mono mt-1 text-[1.5rem] font-semibold leading-none text-ink">
        {value}
      </p>
      {note && (
        <p className="font-serif mt-1.5 text-[0.82rem] leading-snug text-graphite">
          {note}
        </p>
      )}
    </div>
  );
}

/** An empty screen is an invitation: name the next action and link straight to it. */
export function EmptyState({
  title,
  detail,
  action,
  actionHref,
  onAction,
  actionLabel,
  className,
}: {
  title: string;
  detail: ReactNode;
  action?: ReactNode;
  actionHref?: string;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border-l-[3px] border-rule py-1 pl-4",
        className,
      )}
    >
      <p className="text-[1.05rem] font-semibold leading-snug">{title}</p>
      <p className="font-serif max-w-[54ch] text-[0.95rem] leading-relaxed text-graphite">
        {detail}
      </p>
      {action}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {actionLabel}
        </Link>
      )}
      {onAction && actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
