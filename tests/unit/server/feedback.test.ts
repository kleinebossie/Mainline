import { describe, expect, it, vi } from "vitest";

import { fixedClock } from "@/lib/clock";
import { EMPTY_TRAINING_PREFERENCES } from "@/lib/decision-input";
import {
  claimTrainingFeedbackPrompt,
  resetTrainingPreferences,
  setPositiveTrainingPreference,
  submitProductFeedback,
  submitTrainingFeedback,
} from "@/server/feedback";

const AT = Date.parse("2026-07-15T10:00:00.000Z");

describe("P8 feedback service", () => {
  it("appends owned training feedback and writes only positive preference state", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({ id: "feedback-1" });
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "feedback-1",
        relevance: "not_relevant",
        enjoyment: "not_enjoyed",
        timeFit: "too_long",
        frictionTags: ["setup"],
        occurredAt: new Date(AT),
        programItem: {
          activityType: "calculation",
          resourceRefId: "resource-1",
          params: {},
        },
      },
    ]);
    const tx = {
      programItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: "item-1",
          programId: "program-1",
          activityType: "calculation",
          resourceRefId: "resource-1",
          params: {},
        }),
      },
      program: { findFirst: vi.fn() },
      trainingFeedback: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create,
        findMany,
      },
      trainingPreferenceState: {
        findUnique: vi.fn().mockResolvedValue({
          preferences: {
            ...EMPTY_TRAINING_PREFERENCES,
            methodologyVersion: "research-1.4.0",
          },
          resetAt: new Date(AT),
        }),
        upsert,
      },
    };
    const db = {
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    };

    const result = await submitTrainingFeedback(
      db as never,
      "user-1",
      {
        requestId: "request-training-1",
        scope: "item",
        source: "contextual",
        programId: "program-1",
        programItemId: "item-1",
        relevance: "not_relevant",
        enjoyment: "not_enjoyed",
        timeFit: "too_long",
        frictionTags: ["setup"],
        comment: "Setup was slow.",
      },
      fixedClock(AT),
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        requestId: "request-training-1",
        programId: "program-1",
        programItemId: "item-1",
        methodologyVersion: "research-1.4.0",
        occurredAt: new Date(AT),
      }),
      select: { id: true },
    });
    expect(result.preferences).toMatchObject({
      enjoyment: {},
      resourceAffinity: {},
      timeFit: { calculation: "too_long" },
      frictionTags: ["setup"],
      evidenceCount: 1,
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { preferences: expect.any(Object) },
      }),
    );
    expect(tx).not.toHaveProperty("skillState");
  });

  it("rejects feedback for a block the user does not own", async () => {
    const create = vi.fn();
    const tx = {
      programItem: { findFirst: vi.fn().mockResolvedValue(null) },
      program: { findFirst: vi.fn() },
      trainingFeedback: {
        findUnique: vi.fn().mockResolvedValue(null),
        create,
      },
      trainingPreferenceState: {},
    };
    const db = {
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    };
    await expect(
      submitTrainingFeedback(
        db as never,
        "user-1",
        {
          requestId: "request-training-not-owned",
          scope: "item",
          source: "always_available",
          programItemId: "not-owned",
          relevance: "neutral",
          enjoyment: "neutral",
          timeFit: "fits",
          frictionTags: [],
        },
        fixedClock(AT),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(create).not.toHaveBeenCalled();
  });

  it("stores product feedback separately with safe route and version context", async () => {
    const create = vi.fn().mockResolvedValue({ id: "product-1" });
    const tx = {
      productFeedback: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create,
      },
    };
    await submitProductFeedback(
      {
        $transaction: (run: (value: typeof tx) => unknown) => run(tx),
      } as never,
      "user-1",
      {
        requestId: "request-product-1",
        category: "bug",
        message: "The board did not load.",
        routeContext: "/train/private-item?token=secret",
        contactAllowed: false,
      },
      fixedClock(AT),
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: "request-product-1",
        routeContext: "/train/[itemId]",
        methodologyVersion: "research-1.4.0",
        occurredAt: new Date(AT),
      }),
      select: { id: true },
    });
  });

  it("returns an idempotent product-feedback result without another write", async () => {
    const create = vi.fn();
    const tx = {
      productFeedback: {
        findUnique: vi.fn().mockResolvedValue({ id: "product-existing" }),
        count: vi.fn(),
        create,
      },
    };
    const result = await submitProductFeedback(
      {
        $transaction: (run: (value: typeof tx) => unknown) => run(tx),
      } as never,
      "user-1",
      {
        requestId: "request-product-existing",
        category: "idea",
        message: "Keep this once.",
        contactAllowed: false,
      },
      fixedClock(AT),
    );
    expect(result.id).toBe("product-existing");
    expect(create).not.toHaveBeenCalled();
  });

  it("bounds product-feedback writes per user without blocking an idempotent retry", async () => {
    const create = vi.fn();
    const tx = {
      productFeedback: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(12),
        create,
      },
    };
    await expect(
      submitProductFeedback(
        {
          $transaction: (run: (value: typeof tx) => unknown) => run(tx),
        } as never,
        "user-1",
        {
          requestId: "request-product-limited",
          category: "bug",
          message: "One report too many.",
          contactAllowed: false,
        },
        fixedClock(AT),
      ),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(create).not.toHaveBeenCalled();
  });

  it("claims and records a weekly prompt in one transaction", async () => {
    const shownAt = new Date(AT - 8 * 24 * 60 * 60 * 1000);
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      program: {
        findFirst: vi.fn().mockResolvedValue({ createdAt: shownAt }),
      },
      trainingFeedback: { findFirst: vi.fn().mockResolvedValue(null) },
      trainingFeedbackPrompt: {
        findFirst: vi.fn().mockResolvedValue(null),
        createMany,
      },
      activityEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn(),
      },
    };
    const prompt = await claimTrainingFeedbackPrompt(
      {
        $transaction: (run: (value: typeof tx) => unknown) => run(tx),
      } as never,
      "user-1",
      fixedClock(AT),
    );
    expect(prompt?.kind).toBe("weekly");
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "user-1",
          kind: "weekly",
          shownAt: new Date(AT),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("supports a positive-only override and a non-destructive reset", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const tx = { trainingPreferenceState: { upsert } };
    const db = {
      $transaction: (run: (value: typeof tx) => unknown) => run(tx),
    };
    await setPositiveTrainingPreference(db as never, "user-1", {
      activityType: "puzzle_theme",
    });
    expect(upsert.mock.calls[0]?.[0].update.userOverride).toMatchObject({
      enjoyment: { puzzle_theme: 1 },
    });

    await resetTrainingPreferences(db as never, "user-1", fixedClock(AT));
    expect(upsert.mock.calls[1]?.[0].update).toMatchObject({
      resetAt: new Date(AT),
      preferences: { evidenceCount: 0 },
    });
  });
});
