import { ZodError } from "zod";

export type ExpectedErrorCode =
  | "BAD_GATEWAY"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "PRECONDITION_FAILED"
  | "TOO_MANY_REQUESTS";

/**
 * A transport-independent failure that is safe and useful to show to a user.
 * The tRPC boundary converts it to the matching protocol error.
 */
export class ExpectedError extends Error {
  override name = "ExpectedError";

  constructor(
    readonly code: ExpectedErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export const expectedError = {
  upstreamUnavailable: (message: string, cause?: unknown) =>
    new ExpectedError("BAD_GATEWAY", message, { cause }),
  badRequest: (message: string, cause?: unknown) =>
    new ExpectedError("BAD_REQUEST", message, { cause }),
  conflict: (message: string, cause?: unknown) =>
    new ExpectedError("CONFLICT", message, { cause }),
  forbidden: (message: string, cause?: unknown) =>
    new ExpectedError("FORBIDDEN", message, { cause }),
  notFound: (message: string, cause?: unknown) =>
    new ExpectedError("NOT_FOUND", message, { cause }),
  tooManyRequests: (message: string, cause?: unknown) =>
    new ExpectedError("TOO_MANY_REQUESTS", message, { cause }),
};

export const INTERNAL_ERROR_MESSAGE =
  "Mainline could not finish that request. Try again or reload the page.";
export const INVALID_INPUT_MESSAGE =
  "Some information was not accepted. Check the form and try again.";

/** Prevents internal exception and validation details from crossing the API boundary. */
export function safeTRPCErrorMessage(
  error: { code: string; cause?: unknown },
  currentMessage: string,
): string {
  if (error.code === "INTERNAL_SERVER_ERROR") return INTERNAL_ERROR_MESSAGE;
  if (error.cause instanceof ZodError) return INVALID_INPUT_MESSAGE;
  return currentMessage;
}
