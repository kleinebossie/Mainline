import { describe, expect, it } from "vitest";

import {
  CURRENT_DATA_USE_NOTICE,
  hasCurrentResearchConsent,
} from "@/lib/research-consent";

const base = {
  id: "c1",
  userId: "u1",
  noticeVersion: CURRENT_DATA_USE_NOTICE.id,
  scopes: ["aggregate_observational_training"],
  grantedAt: new Date("2026-07-11T00:00:00Z"),
  withdrawnAt: null,
};

describe("research consent eligibility", () => {
  it("locks notice copy to its stable version identifier", () => {
    expect(CURRENT_DATA_USE_NOTICE).toEqual({
      id: "research-data-use/2026-07-11",
      title: "Optional aggregate observational research",
      summary:
        "A future feature may use consented training and game records in de-identified aggregate analyses to study associations. It will not prove that an activity causes rating gain. Secondary research capture is currently disabled.",
      withdrawal:
        "Withdrawal stops future optional secondary inclusion. It does not remove operational storage needed for personal training. Use account deletion to erase your account data.",
    });
  });

  it("accepts only an active grant for the current notice and requested scope", () => {
    expect(
      hasCurrentResearchConsent(base, "aggregate_observational_training"),
    ).toBe(true);
    expect(
      hasCurrentResearchConsent(null, "aggregate_observational_training"),
    ).toBe(false);
    expect(
      hasCurrentResearchConsent(
        { ...base, withdrawnAt: new Date() },
        "aggregate_observational_training",
      ),
    ).toBe(false);
    expect(
      hasCurrentResearchConsent(
        { ...base, noticeVersion: "old" },
        "aggregate_observational_training",
      ),
    ).toBe(false);
    expect(
      hasCurrentResearchConsent(
        { ...base, scopes: [] },
        "aggregate_observational_training",
      ),
    ).toBe(false);
  });
});
