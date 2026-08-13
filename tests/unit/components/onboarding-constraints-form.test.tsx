import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock TRPC react hooks for static rendering
vi.mock("@/lib/trpc/react", () => ({
  trpc: {
    constraints: {
      getCurrent: {
        useQuery: () => ({
          isLoading: false,
          error: null,
          data: {
            id: "test-constraints",
            version: 1,
            minutesPerDay: 20,
            daysPerWeek: 5,
            goals: [],
            ownedResources: [],
            formatPrefs: {
              formats: ["rapid"],
              preferredVariety: false,
              targetFocus: "online",
            },
            sessionStyle: { depthVsBreadth: "balanced", interleave: true },
            ifThenPlan: null,
          },
        }),
      },
      save: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      constraints: {
        getCurrent: {
          invalidate: vi.fn(),
        },
      },
    }),
  },
}));

import { OnboardingConstraintsForm } from "@/app/onboarding/constraints/onboarding-constraints-form";

describe("OnboardingConstraintsForm", () => {
  it("renders the 3 core questions and the Settings signpost card", () => {
    const html = renderToStaticMarkup(<OnboardingConstraintsForm />);

    // Question 1: Daily time budget
    expect(html).toContain("01 / Daily time budget");
    expect(html).toContain("How much time can you train each day?");
    expect(html).toContain("20 min");
    expect(html).toContain("Custom minutes:");

    // Question 2: Primary format
    expect(html).toContain("02 / Primary format");
    expect(html).toContain("What is your main game format?");
    expect(html).toContain("Blitz");
    expect(html).toContain("Rapid");
    expect(html).toContain("Classical");

    // Question 3: Board modality
    expect(html).toContain("03 / Board modality");
    expect(html).toContain("Where do you mostly play?");
    expect(html).toContain("Screen only");
    expect(html).toContain("Physical board");
    expect(html).toContain("Both");

    // Settings signpost
    expect(html).toContain("Advanced settings live in Settings");
    expect(html).toContain("Customizable later");
    expect(html).toContain(
      "You can add your owned chess books, customize habit cues, and adjust topic mixing in <span class=\"text-ink font-medium\">Settings</span> at any time.",
    );

    // Save button
    expect(html).toContain("Save constraints");
  });
});
