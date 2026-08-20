import type { ReactNode } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { errorCode, presentError } from "@/lib/error-presentation";
import { cn } from "@/lib/utils";

type ErrorNoticeBaseProps = {
  error?: unknown;
  heading: string;
  message: string;
  secondaryAction?: ReactNode;
  className?: string;
};

type ErrorNoticeProps = ErrorNoticeBaseProps &
  (
    | {
        onRetry: () => void;
        retryLabel?: string;
        retrying?: boolean;
      }
    | {
        onRetry?: never;
        retryLabel?: never;
        retrying?: never;
      }
  );

/** A consistent recovery point for query, mutation, and browser failures. */
export function ErrorNotice({
  error,
  heading,
  message,
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  secondaryAction,
  className,
}: ErrorNoticeProps) {
  const copy = presentError(error, { heading, message });
  const signInRequired = errorCode(error) === "UNAUTHORIZED";
  const showActions = onRetry || secondaryAction || signInRequired;

  return (
    <StatusMessage
      tone="error"
      heading={copy.heading}
      className={cn("border-l-[3px] bg-paper-raised/90", className)}
    >
      <p>{copy.message}</p>
      {showActions && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onRetry && !signInRequired && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={retrying}
            >
              {retrying ? "Trying again…" : retryLabel}
            </Button>
          )}
          {signInRequired && (
            <Link
              href="/signin"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Sign in again
            </Link>
          )}
          {secondaryAction}
        </div>
      )}
    </StatusMessage>
  );
}
