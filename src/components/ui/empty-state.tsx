import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptyState({
  message,
  action,
  icon,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-md border border-line bg-paper-raised/60",
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3 text-graphite" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="font-sans text-sm text-graphite max-w-md leading-relaxed">
        {message}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
