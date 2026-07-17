import { describe, expect, it } from "vitest";

import {
  resultAdvanceBlocked,
  resultAdvanceLabel,
  resultPersistenceState,
} from "@/lib/result-persistence";

describe("training result persistence gate", () => {
  it.each([
    [true, null, "saving", true, "Saving result..."],
    [false, new Error("offline"), "failed", true, "Save result to continue"],
    [false, null, "ready", false, "Next puzzle"],
  ] as const)(
    "maps pending=%s and error=%s to %s",
    (pending, error, expectedState, blocked, expectedLabel) => {
      const state = resultPersistenceState(pending, error);

      expect(state).toBe(expectedState);
      expect(resultAdvanceBlocked(state)).toBe(blocked);
      expect(resultAdvanceLabel(state, "Next puzzle")).toBe(expectedLabel);
    },
  );

  it("keeps a reported failure blocked even when no request is pending", () => {
    const state = resultPersistenceState(false, { code: "NETWORK_ERROR" });

    expect(resultAdvanceBlocked(state)).toBe(true);
    expect(resultAdvanceLabel(state, "Finish")).not.toBe("Finish");
  });
});
