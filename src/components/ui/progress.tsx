import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  segments?: boolean;
}

export function Progress({
  value,
  max = 100,
  segments = false,
  className,
  ...props
}: ProgressProps) {
  const safeMax = Math.max(1, max);
  const clampedValue = Math.min(Math.max(0, value), safeMax);
  const percentage = Math.round((clampedValue / safeMax) * 100);

  if (segments) {
    return (
      <div
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className={cn("flex items-center gap-1.5 w-full", className)}
        {...props}
      >
        {Array.from({ length: safeMax }, (_, i) => {
          const filled = i < clampedValue;
          return (
            <div
              key={i}
              className={cn(
                "h-2 flex-1 rounded-xs transition-colors duration-200",
                filled ? "bg-evergreen" : "bg-line",
              )}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-line",
        className,
      )}
      {...props}
    >
      <div
        className="h-full bg-evergreen transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
