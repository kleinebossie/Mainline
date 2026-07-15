import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  INTERNAL_ERROR_MESSAGE,
  INVALID_INPUT_MESSAGE,
  expectedError,
  safeTRPCErrorMessage,
} from "@/server/errors";

describe("server error boundary", () => {
  it("replaces unexpected internal messages", () => {
    expect(
      safeTRPCErrorMessage(
        { code: "INTERNAL_SERVER_ERROR" },
        "database connection string leaked",
      ),
    ).toBe(INTERNAL_ERROR_MESSAGE);
  });

  it("replaces raw Zod diagnostics with form guidance", () => {
    const parsed = z.string().min(3).safeParse("x");
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(
      safeTRPCErrorMessage(
        { code: "BAD_REQUEST", cause: parsed.error },
        JSON.stringify(parsed.error.issues),
      ),
    ).toBe(INVALID_INPUT_MESSAGE);
  });

  it("preserves intentional public messages and causes", () => {
    const cause = new Error("upstream detail");
    const error = expectedError.upstreamUnavailable(
      "Lichess did not respond. Try again in a moment.",
      cause,
    );

    expect(error.code).toBe("BAD_GATEWAY");
    expect(error.message).toBe(
      "Lichess did not respond. Try again in a moment.",
    );
    expect(error.cause).toBe(cause);
    expect(safeTRPCErrorMessage(error, error.message)).toBe(error.message);
  });
});
