import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FirstSessionAction } from "@/app/onboarding/reveal/reveal";

describe("Reveal first-session action", () => {
  it("uses an action button instead of linking to an unbuilt Today page", () => {
    const html = renderToStaticMarkup(
      <FirstSessionAction error={null} pending={false} onBuild={() => {}} />,
    );

    expect(html).toContain("<button");
    expect(html).toContain("Build my first session");
    expect(html).not.toContain('href="/today"');
  });

  it("makes the in-progress state explicit and prevents a duplicate build", () => {
    const html = renderToStaticMarkup(
      <FirstSessionAction error={null} pending onBuild={() => {}} />,
    );

    expect(html).toContain("Building your session...");
    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
  });

  it("keeps setup safe and offers the same action again after failure", () => {
    const html = renderToStaticMarkup(
      <FirstSessionAction
        error={new Error("generation failed")}
        pending={false}
        onBuild={() => {}}
      />,
    );

    expect(html).toContain("First session not built");
    expect(html).toContain("Your setup is saved");
    expect(html).toContain("Try building again");
  });
});
