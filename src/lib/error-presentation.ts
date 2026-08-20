import { isGuestSession } from "@/lib/guest-session";

export type ErrorPresentation = {
  heading: string;
  message: string;
};

type ErrorLike = {
  message?: unknown;
  data?: { code?: unknown } | null;
  shape?: { data?: { code?: unknown } | null } | null;
};

const PUBLIC_ERROR_CODES = new Set([
  "BAD_GATEWAY",
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
]);

function errorLike(error: unknown): ErrorLike | null {
  return typeof error === "object" && error !== null
    ? (error as ErrorLike)
    : null;
}

export function errorCode(error: unknown): string | null {
  const candidate = errorLike(error);
  const code = candidate?.data?.code ?? candidate?.shape?.data?.code;
  return typeof code === "string" ? code : null;
}

function publicServerMessage(error: unknown, code: string | null) {
  const message = errorLike(error)?.message;
  if (!code || !PUBLIC_ERROR_CODES.has(code) || typeof message !== "string") {
    return null;
  }
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function looksLikeNetworkFailure(error: unknown): boolean {
  const message = errorLike(error)?.message;
  return (
    typeof message === "string" &&
    /failed to fetch|fetch failed|networkerror|network request failed/i.test(
      message,
    )
  );
}

/**
 * Turns transport and browser failures into copy that is safe to show to a user.
 * Raw exception messages are only used for server codes whose messages are part
 * of the public API contract.
 */
export function presentError(
  error: unknown,
  fallback: ErrorPresentation,
): ErrorPresentation {
  const code = errorCode(error);
  const serverMessage = publicServerMessage(error, code);

  if (code === "UNAUTHORIZED") {
    if (isGuestSession()) {
      return {
        heading: fallback.heading,
        message: fallback.message,
      };
    }
    return {
      heading: "Sign-in expired",
      message: "Sign in again, then return here to continue.",
    };
  }
  if (code === "FORBIDDEN") {
    return {
      heading: "Action unavailable",
      message:
        serverMessage ?? "Your account does not have access to this action.",
    };
  }
  if (code === "NOT_FOUND") {
    return {
      heading: "No longer available",
      message:
        serverMessage ??
        "This item may have been removed or replaced. Reload the latest page and try again.",
    };
  }
  if (code === "CONFLICT" || code === "PRECONDITION_FAILED") {
    return {
      heading: "The page changed",
      message:
        serverMessage ??
        "Reload the latest version before trying this action again.",
    };
  }
  if (code === "BAD_REQUEST") {
    return {
      heading: fallback.heading,
      message:
        serverMessage ?? "Check the information you entered and try again.",
    };
  }
  if (code === "TOO_MANY_REQUESTS") {
    return {
      heading: "Try again shortly",
      message:
        serverMessage ??
        "The service is receiving too many requests. Your work is safe, so wait a moment and retry.",
    };
  }
  if (code === "BAD_GATEWAY" || code === "TIMEOUT") {
    return {
      heading: "Service temporarily unavailable",
      message:
        serverMessage ??
        "The outside service did not respond. Your work is safe, so try again in a moment.",
    };
  }
  if (code === "INTERNAL_SERVER_ERROR") {
    return {
      heading: fallback.heading,
      message:
        "Mainline could not finish that request. Your saved work is safe. Try again, or reload the page if it keeps happening.",
    };
  }
  if (looksLikeNetworkFailure(error)) {
    return {
      heading: "Connection lost",
      message:
        "Mainline could not reach the server. Check your connection, then try again.",
    };
  }

  return fallback;
}

export function errorMessage(error: unknown, fallback: string): string {
  return presentError(error, {
    heading: "Action not completed",
    message: fallback,
  }).message;
}

const DO_NOT_RETRY = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "PRECONDITION_FAILED",
  "UNAUTHORIZED",
]);

/** Retries transient query failures once without delaying permanent failures. */
export function shouldRetryRequest(
  failureCount: number,
  error: unknown,
): boolean {
  const code = errorCode(error);
  if (code && DO_NOT_RETRY.has(code)) return false;
  return failureCount < 1;
}
