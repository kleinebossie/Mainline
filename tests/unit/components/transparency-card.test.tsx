import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TransparencyCard,
  TransparencyCardGroup,
} from "@/components/transparency-card";
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

  it("combines multiple rationales under one toggle", () => {
    const html = renderToStaticMarkup(
      <TransparencyCardGroup
        defaultCollapsed={false}
        items={[
          {
            title: "First choice",
            rationaleText: "The first rationale.",
            evidenceGrade: "B",
            evidenceTier: 1,
            citationKey: "first",
            confidence: "medium",
            soften: false,
          },
          {
            title: "Second choice",
            rationaleText: "The second rationale.",
            evidenceGrade: "C",
            evidenceTier: 2,
            citationKey: "second",
            confidence: "low",
            soften: true,
          },
        ]}
      />,
    );

    expect(html.match(/Why this\?/g)).toHaveLength(1);
    expect(html).toContain("First choice");
    expect(html).toContain("The first rationale.");
    expect(html).toContain("Second choice");
    expect(html).toContain("The second rationale.");
  });
});
