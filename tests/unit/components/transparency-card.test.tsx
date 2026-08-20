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
    expect(html).toContain("Provisional");
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
    expect(html).not.toContain("Provisional");
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

  it("presents confident direct training statements first", () => {
    const html = renderToStaticMarkup(
      <TransparencyCard
        rationaleText="Trains deep calculation and candidate move validation."
        evidenceGrade="A"
        evidenceTier={1}
        citationKey="charness1981"
        confidence="high"
        soften={false}
        defaultCollapsed={false}
      />,
    );
    expect(html).toContain(
      "Trains deep calculation and candidate move validation.",
    );
    expect(html).toContain("Grade A");
    expect(html).toContain("!!");
    expect(html).toContain("chess-specific");
  });

  it("renders interactive GradeMark with accessible button attributes", () => {
    const html = renderToStaticMarkup(
      <TransparencyCard
        rationaleText="Reinforces previously missed tactics."
        evidenceGrade="B"
        evidenceTier={2}
        citationKey="cepeda2006"
        confidence="medium"
        soften={false}
        defaultCollapsed={false}
      />,
    );
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("general learning science");
  });
});
