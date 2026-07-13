import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CalibrationTrackGauges } from "@/app/onboarding/calibration-track-gauges";

describe("CalibrationTrackGauges", () => {
  it("renders the estimate, uncertainty, grade, and a clamped gauge", () => {
    const html = renderToStaticMarkup(
      <CalibrationTrackGauges
        tracks={[
          {
            id: "tactics",
            label: "Tactical vision",
            estimate: {
              tacticalRatingEstimate: 700,
              uncertainty: 400,
              evidenceGrade: "B",
            },
          },
        ]}
      />,
    );

    expect(html).toContain("Tactical vision");
    expect(html).toContain("≈ 700 ± 400");
    expect(html).toContain("Grade B");
    expect(html).toContain("left:0%");
    expect(html).not.toMatch(/(?:left|width):-/);
  });
});
