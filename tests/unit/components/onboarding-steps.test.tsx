import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OnboardingSteps } from "@/app/onboarding/onboarding-steps";
import type { OnboardingStatus } from "@/server/onboarding";

const steps = [
  ["/connections", "Connect a chess account", true, true],
  ["/onboarding/calibration", "Tactical calibration", true, true],
  ["/onboarding/constraints", "Your time, goals & formats", true, true],
  ["/onboarding/reveal", "See where you stand", false, false],
  ["/today", "Build your first session", false, false],
] as const;

describe("Setup progress", () => {
  it("counts all five steps and reports required completion separately", () => {
    const status: OnboardingStatus = {
      complete: true,
      allComplete: false,
      nextStep: {
        href: steps[3][0],
        label: steps[3][1],
        done: steps[3][2],
        required: steps[3][3],
      },
      steps: steps.map(([href, label, done, required]) => ({
        href,
        label,
        done,
        required,
      })),
    };

    const html = renderToStaticMarkup(<OnboardingSteps status={status} />);

    expect(html).toContain("3 of 5 steps done");
    expect(html).toContain("Required setup complete");
    expect(html).toContain("See where you stand");
    expect(html).toContain("Build your first session");
  });
});
