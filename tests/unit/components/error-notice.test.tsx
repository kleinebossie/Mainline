import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ErrorNotice } from "@/components/ui/error-notice";

describe("ErrorNotice", () => {
  it("renders understandable recovery copy and an accessible action", () => {
    const html = renderToStaticMarkup(
      <ErrorNotice
        error={{
          message: "private database failure",
          data: { code: "INTERNAL_SERVER_ERROR" },
        }}
        heading="Progress unavailable"
        message="Progress could not be loaded."
        onRetry={vi.fn()}
        retryLabel="Reload progress"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Progress unavailable");
    expect(html).toContain("saved work is safe");
    expect(html).toContain("Reload progress");
    expect(html).not.toContain("private database failure");
  });

  it("uses the server message for an intentional public conflict", () => {
    const html = renderToStaticMarkup(
      <ErrorNotice
        error={{
          message:
            "Your weekly focus changed. Reload Today before choosing again.",
          data: { code: "CONFLICT" },
        }}
        heading="Focus not saved"
        message="Fallback"
      />,
    );

    expect(html).toContain("The page changed");
    expect(html).toContain("Your weekly focus changed");
  });

  it("replaces a pointless retry with a sign-in action after expiry", () => {
    const html = renderToStaticMarkup(
      <ErrorNotice
        error={{ data: { code: "UNAUTHORIZED" } }}
        heading="Library unavailable"
        message="The library could not be loaded."
        onRetry={vi.fn()}
        retryLabel="Reload library"
      />,
    );

    expect(html).toContain("Sign-in expired");
    expect(html).toContain('href="/signin"');
    expect(html).toContain("Sign in again");
    expect(html).not.toContain("Reload library");
  });
});
