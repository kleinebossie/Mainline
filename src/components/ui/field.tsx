import * as React from "react";
import { cn } from "@/lib/utils";

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  id?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: FieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  return (
    <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-sm font-sans font-medium text-ink flex items-center gap-1"
        >
          {label}
          {required && (
            <span className="text-clay text-xs" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-graphite leading-normal">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-clay leading-normal font-medium"
        >
          {error}
        </p>
      )}
    </div>
  );
}
