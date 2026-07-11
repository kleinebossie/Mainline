import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const SAFE_OPERATIONS = new Set([
  "analysis_handoff",
  "program_generation",
  "import",
  "adaptation",
  "job",
]);
const SAFE_STATUSES = new Set(["success", "error", "skipped", "blocked"]);
const SAFE_PLATFORMS = new Set(["lichess", "chesscom"]);
const SAFE_EXTRA = new Set(["duration_ms", "count", "attempt"]);

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z0-9_-]{1,48}$/.test(value)
    ? value
    : undefined;
}

/**
 * Fail-closed monitoring filter. Stack frames and safe operational tags remain useful,
 * while request payloads, credentials, user identity, free text, and upstream error
 * bodies are removed before an event can leave the process.
 */
export function scrubMonitoringEvent(event: ErrorEvent): ErrorEvent {
  const operation = safeIdentifier(event.tags?.operation);
  const status = safeIdentifier(event.tags?.status);
  const platform = safeIdentifier(event.tags?.platform);
  const jobKind = safeIdentifier(event.tags?.job_kind);
  const runtime = safeIdentifier(event.tags?.runtime);
  const tags: Record<string, string> = {};
  if (operation && SAFE_OPERATIONS.has(operation)) tags.operation = operation;
  if (status && SAFE_STATUSES.has(status)) tags.status = status;
  if (platform && SAFE_PLATFORMS.has(platform)) tags.platform = platform;
  if (jobKind) tags.job_kind = jobKind;
  if (runtime) tags.runtime = runtime;
  const extra = Object.fromEntries(
    Object.entries(event.extra ?? {}).filter(
      ([key, value]) => SAFE_EXTRA.has(key) && typeof value === "number",
    ),
  );

  const request = event.request
    ? {
        method: event.request.method,
      }
    : undefined;

  const exception = event.exception
    ? {
        ...event.exception,
        values: event.exception.values?.map((value) => ({
          ...value,
          value: safeIdentifier(value.type?.toLowerCase()) ?? "error",
          mechanism: value.mechanism
            ? { ...value.mechanism, data: undefined }
            : undefined,
        })),
      }
    : undefined;

  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    message:
      tags.operation && tags.status
        ? `ops.${tags.operation}.${tags.status}`
        : undefined,
    exception,
    request,
    contexts: event.contexts
      ? { runtime: event.contexts.runtime, trace: event.contexts.trace }
      : undefined,
    tags,
    extra: event.tags?.operation ? extra : undefined,
  };
}

export function scrubMonitoringBreadcrumb(
  breadcrumb: Breadcrumb,
): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;

  return {
    type: breadcrumb.type,
    category: breadcrumb.category,
    level: breadcrumb.level,
    timestamp: breadcrumb.timestamp,
  };
}
