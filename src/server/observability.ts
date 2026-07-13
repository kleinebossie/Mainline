import * as Sentry from "@sentry/nextjs";

type OperationName =
  | "analysis_handoff"
  | "program_generation"
  | "import"
  | "adaptation"
  | "job";
type OperationStatus = "success" | "error" | "skipped" | "blocked";

interface OperationalEventInput {
  operation: OperationName;
  status: OperationStatus;
  durationMs?: number;
  count?: number;
  jobKind?: string;
  platform?: string;
}

interface SafeOperationalEvent {
  message: string;
  level: "info" | "warning" | "error";
  tags: Record<string, string>;
  extra: Record<string, number>;
}

export function buildOperationalEvent(
  input: OperationalEventInput,
): SafeOperationalEvent {
  const tags: Record<string, string> = {
    operation: input.operation,
    status: input.status,
  };
  if (input.jobKind) tags.job_kind = input.jobKind;
  if (input.platform) tags.platform = input.platform;

  const extra: Record<string, number> = {};
  if (input.durationMs !== undefined)
    extra.duration_ms = Math.max(0, Math.round(input.durationMs));
  if (input.count !== undefined)
    extra.count = Math.max(0, Math.round(input.count));

  return {
    message: `ops.${input.operation}.${input.status}`,
    level:
      input.status === "error"
        ? "error"
        : input.status === "blocked"
          ? "warning"
          : "info",
    tags,
    extra,
  };
}

/** Aggregate operational signal only. Never pass payloads, text, tokens, URLs, or user ids. */
export function captureOperationalEvent(input: OperationalEventInput): void {
  Sentry.captureEvent(buildOperationalEvent(input));
}
