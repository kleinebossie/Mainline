import { describe, expect, it, vi } from "vitest";

import { loadMethodology, nextCalibrationItem } from "@/methodology";
import {
  applyCalibrationResponse,
  applyGuestCalibrationResponse,
} from "@/server/assessment";

describe("calibration response persistence", () => {
  it("rejects a rating that is not the server-selected active target", async () => {
    const cfg = loadMethodology();
    const activeTarget = nextCalibrationItem(
      {
        responses: [],
        startRating: cfg.assessment.calibration.startRating.value,
      },
      cfg,
    ).ratingTarget;
    const upsert = vi.fn();
    const db = {
      assessment: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert,
      },
      chessProfileSnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      platformConnection: {
        findMany: vi.fn().mockResolvedValue([{ platform: "lichess" }]),
      },
      lichessPuzzle: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      constraintSet: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(
      applyCalibrationResponse(
        db as never,
        "user-1",
        {
          ratingShown: activeTarget + 1,
          correct: true,
        },
        new Date("2026-07-17T12:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "That calibration puzzle changed. Reload the calibration before submitting it.",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("resolves and advances guest calibration responses deterministically when connection exists", async () => {
    const db = {
      lichessPuzzle: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const initial = await applyGuestCalibrationResponse(db as never, {
      ratingShown: 1400,
      correct: true,
      guestConnections: [{ platform: "lichess" }],
    });

    expect(initial.guestResponses.length).toBe(1);
    expect(initial.guestResponses[0]?.correct).toBe(true);
    expect(initial.tracks.length).toBeGreaterThan(0);
  });

  it("rejects guest calibration submission when no accounts are connected", async () => {
    const db = {
      lichessPuzzle: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await expect(
      applyGuestCalibrationResponse(db as never, {
        ratingShown: 1400,
        correct: true,
        guestConnections: [],
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Connect a chess account before completing calibration.",
    });
  });
});

