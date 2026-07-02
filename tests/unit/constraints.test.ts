import { describe, expect, it } from "vitest";

import {
  EMPTY_CONSTRAINTS,
  constraintsInputSchema,
  type ConstraintsInput,
} from "@/lib/constraints";

// Constraints Zod validation (BUILD.md M4 Tests). The schema is the one validation truth
// shared by the form and the router; these lock its accept/reject boundaries.
const valid: ConstraintsInput = {
  minutesPerDay: 20,
  daysPerWeek: 5,
  goals: [
    { kind: "rating", label: "Raise my rating" },
    { kind: "other", label: "Beat my rival" },
  ],
  ownedResources: [
    { kind: "book", label: "Dvoretsky's Endgame Manual" },
    { kind: "membership", label: "Lichess", externalRef: "lichess.org" },
  ],
  formatPrefs: {
    formats: ["rapid", "blitz"],
    preferredVariety: true,
    targetFocus: "otb",
  },
  sessionStyle: { depthVsBreadth: "depth", interleave: false },
  ifThenPlan: { cue: "my morning coffee", plan: "open today's session" },
};

describe("constraintsInputSchema", () => {
  it("accepts a fully-specified set", () => {
    expect(constraintsInputSchema.parse(valid)).toEqual(valid);
  });

  it("accepts the empty default (no goals, no if-then plan)", () => {
    expect(constraintsInputSchema.safeParse(EMPTY_CONSTRAINTS).success).toBe(
      true,
    );
    expect(EMPTY_CONSTRAINTS.ifThenPlan).toBeNull();
  });

  it("rejects out-of-range time/cadence", () => {
    expect(
      constraintsInputSchema.safeParse({ ...valid, minutesPerDay: 0 }).success,
    ).toBe(false);
    expect(
      constraintsInputSchema.safeParse({ ...valid, minutesPerDay: 1441 })
        .success,
    ).toBe(false);
    expect(
      constraintsInputSchema.safeParse({ ...valid, daysPerWeek: 0 }).success,
    ).toBe(false);
    expect(
      constraintsInputSchema.safeParse({ ...valid, daysPerWeek: 8 }).success,
    ).toBe(false);
  });

  it("rejects non-integer time/cadence", () => {
    expect(
      constraintsInputSchema.safeParse({ ...valid, daysPerWeek: 3.5 }).success,
    ).toBe(false);
  });

  it("defaults targetFocus to online when omitted (M14 — no migration for old rows)", () => {
    const out = constraintsInputSchema.parse({
      ...valid,
      formatPrefs: { formats: ["rapid"], preferredVariety: false },
    });
    expect(out.formatPrefs.targetFocus).toBe("online");
  });

  it("rejects an unknown play medium", () => {
    expect(
      constraintsInputSchema.safeParse({
        ...valid,
        formatPrefs: {
          formats: ["rapid"],
          preferredVariety: false,
          targetFocus: "vr",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown format", () => {
    expect(
      constraintsInputSchema.safeParse({
        ...valid,
        formatPrefs: { formats: ["correspondence"], preferredVariety: false },
      }).success,
    ).toBe(false);
  });

  it("rejects a goal with an empty label", () => {
    expect(
      constraintsInputSchema.safeParse({
        ...valid,
        goals: [{ kind: "tactics", label: "" }],
      }).success,
    ).toBe(false);
  });

  it("rejects an owned resource with an unknown kind", () => {
    expect(
      constraintsInputSchema.safeParse({
        ...valid,
        ownedResources: [{ kind: "dvd", label: "Old VHS course" }],
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown session style", () => {
    expect(
      constraintsInputSchema.safeParse({
        ...valid,
        sessionStyle: { depthVsBreadth: "sideways", interleave: true },
      }).success,
    ).toBe(false);
  });

  it("rejects a partial if-then plan (cue without plan)", () => {
    expect(
      constraintsInputSchema.safeParse({
        ...valid,
        ifThenPlan: { cue: "coffee", plan: "" },
      }).success,
    ).toBe(false);
  });

  it("trims and accepts a null if-then plan", () => {
    const out = constraintsInputSchema.parse({ ...valid, ifThenPlan: null });
    expect(out.ifThenPlan).toBeNull();
  });
});
