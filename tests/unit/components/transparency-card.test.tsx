import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TransparencyCard } from "@/components/transparency-card";
import React from "react";

describe("TransparencyCard", () => {
  it("renders a caveat for a stub/best-guess flag", () => {
    const html = renderToStaticMarkup(
      <TransparencyCard
        rationaleText="This is a test rationale."
        evidenceGrade="C"
        evidenceTier={1}
        citationKey="test"
        confidence="low"
        soften={true}
        flag="stub"
      />,
    );
    expect(html).toContain("Placeholder");
  });

  it("does not render a caveat for unflagged values", () => {
    const html = renderToStaticMarkup(
      <TransparencyCard
        rationaleText="This is a tested rationale."
        evidenceGrade="B"
        evidenceTier={1}
        citationKey="test"
        confidence="high"
        soften={false}
      />,
    );
    expect(html).not.toContain("Placeholder");
  });

  it("surfaces the confidence note inline, not only via the title tooltip", () => {
    const html = renderToStaticMarkup(
      <TransparencyCard
        rationaleText="This is a tested rationale."
        evidenceGrade="B"
        evidenceTier={1}
        citationKey="test"
        confidence="low"
        soften={false}
        defaultCollapsed={false}
      />,
    );
    expect(html).toContain("a band prior, not your own data yet");
  });
});
