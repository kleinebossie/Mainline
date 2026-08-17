import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const SAFE_OPERATIONS = new Set([
  "api",
  "analysis_handoff",
  "program_generation",
  "import",
  "adaptation",
  "job",
]);
const SAFE_STATUSES = new Set(["success", "error", "skipped", "blocked"]);
const SAFE_PLATFORMS = new Set(["lichess", "chesscom"]);
const SAFE_EXTRA = new Set(["duration_ms", "count", "attempt"]);
const SAFE_JOB_KINDS = new Set([
  "daily_adaptation",
  "day_missed",
  "import_sync",
  "account_purge",
]);
const SAFE_RUNTIMES = new Set(["browser", "edge", "node", "nodejs"]);
const SAFE_ERROR_TYPES = new Set([
  "error",
  "typeerror",
  "rangeerror",
  "referenceerror",
  "syntaxerror",
  "urierror",
  "aggregateerror",
  "platformerror",
]);
const SAFE_MECHANISMS = new Set([
  "generic",
  "onerror",
  "onunhandledrejection",
  "instrument",
]);

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z0-9_-]{1,48}$/.test(value)
    ? value
    : undefined;
}

function safeErrorType(value: unknown): string {
  const type = safeIdentifier(
    typeof value === "string" ? value.toLowerCase() : value,
  );
  return type && SAFE_ERROR_TYPES.has(type) ? type : "error";
}

function safePath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.split("?")[0]?.split("#")[0]?.trim();
  if (!clean || clean.length > 256) return undefined;
  if (/[\r\n\t\0]/.test(clean)) return undefined;
  return clean;
}

function safeFunctionName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_$.<>[\]\s/:@-]{1,120}$/.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

function safeModule(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_@/.:-]{1,100}$/.test(trimmed)) {
    return trimmed;
  }
  return undefined;
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
  if (jobKind && SAFE_JOB_KINDS.has(jobKind)) tags.job_kind = jobKind;
  if (runtime && SAFE_RUNTIMES.has(runtime)) tags.runtime = runtime;
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
        values: event.exception.values?.map((value) => {
          const type = safeErrorType(value.type);
          const mechanismType = safeIdentifier(
            value.mechanism?.type?.toLowerCase(),
          );
          return {
            type,
            value: type,
            stacktrace: value.stacktrace
              ? {
                  frames: value.stacktrace.frames?.map((frame) => ({
                    filename: safePath(frame.filename),
                    abs_path: safePath(frame.abs_path),
                    function: safeFunctionName(frame.function),
                    module: safeModule(frame.module),
                    lineno: frame.lineno,
                    colno: frame.colno,
                    in_app: frame.in_app,
                  })),
                  frames_omitted: value.stacktrace.frames_omitted,
                }
              : undefined,
            mechanism: value.mechanism
              ? {
                  type:
                    mechanismType && SAFE_MECHANISMS.has(mechanismType)
                      ? mechanismType
                      : "generic",
                  handled: value.mechanism.handled,
                  synthetic: value.mechanism.synthetic,
                  is_exception_group: value.mechanism.is_exception_group,
                  exception_id: value.mechanism.exception_id,
                  parent_id: value.mechanism.parent_id,
                }
              : undefined,
          };
        }),
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
