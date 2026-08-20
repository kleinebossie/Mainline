import { describe, expect, it, vi } from "vitest";

import {
  errorMessage,
  presentError,
  shouldRetryRequest,
} from "@/lib/error-presentation";

const fallback = {
  heading: "Session unavailable",
  message: "The session could not be loaded.",
};

describe("error presentation", () => {
  it("never exposes an unexpected server message", () => {
    const copy = presentError(
      {
        message: "database host and secret query text",
        data: { code: "INTERNAL_SERVER_ERROR" },
      },
      fallback,
    );

    expect(copy.heading).toBe("Session unavailable");
    expect(copy.message).toContain("saved work is safe");
    expect(copy.message).not.toContain("database");
    expect(copy.message).not.toContain("secret");
  });

  it("keeps intentional validation guidance from the public API", () => {
    expect(
      errorMessage(
        {
          message: "Select at least one playing format.",
          data: { code: "BAD_REQUEST" },
        },
        "Fallback",
      ),
    ).toBe("Select at least one playing format.");
  });

  it("explains stale, missing, throttled, and offline failures", () => {
    expect(presentError({ data: { code: "CONFLICT" } }, fallback).heading).toBe(
      "The page changed",
    );
    expect(
      presentError({ data: { code: "NOT_FOUND" } }, fallback).heading,
    ).toBe("No longer available");
    expect(
      presentError({ data: { code: "TOO_MANY_REQUESTS" } }, fallback).heading,
    ).toBe("Try again shortly");
    expect(presentError({ message: "Failed to fetch" }, fallback).heading).toBe(
      "Connection lost",
    );
  });

  it("retries a transient query once and skips permanent failures", () => {
    expect(shouldRetryRequest(0, { data: { code: "BAD_GATEWAY" } })).toBe(true);
    expect(shouldRetryRequest(1, { data: { code: "BAD_GATEWAY" } })).toBe(
      false,
    );
    expect(shouldRetryRequest(0, { data: { code: "BAD_REQUEST" } })).toBe(
      false,
    );
    expect(shouldRetryRequest(0, { data: { code: "UNAUTHORIZED" } })).toBe(
      false,
    );
  });

  it("suppresses sign-in expired error when in guest session", () => {
    const error = { data: { code: "UNAUTHORIZED" } };
    expect(presentError(error, fallback).heading).toBe("Sign-in expired");

    const mockStorage = {
      getItem: (key: string) =>
        key === "mainline_guest_session_data"
          ? JSON.stringify({ baseline: { username: "guest" } })
          : null,
    };
    vi.stubGlobal("localStorage", mockStorage);

    expect(presentError(error, fallback).heading).toBe("Session unavailable");
    vi.unstubAllGlobals();
  });
});
