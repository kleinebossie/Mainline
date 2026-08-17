import { describe, expect, it, vi } from "vitest";
import { migrateGuestSession, type GuestMigrationInput } from "@/server/guest-migration";
import type { PrismaClient } from "@prisma/client";

describe("guest-migration", () => {
  it("migrates baseline, constraints, program items, and activity events atomically", async () => {
    const createdConnections: Record<string, unknown>[] = [];
    const updatedUsers: Record<string, unknown>[] = [];
    const upsertedAssessments: Record<string, unknown>[] = [];
    const createdConstraints: Record<string, unknown>[] = [];
    const createdPrograms: Record<string, unknown>[] = [];
    const createdProgramItems: Record<string, unknown>[] = [];
    const createdActivityEvents: Record<string, unknown>[] = [];

    const mockTx = {
      platformConnection: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          createdConnections.push(args.data);
          return Promise.resolve({ id: "conn_1", ...args.data });
        }),
      },
      user: {
        update: vi.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) => {
          updatedUsers.push(args.data);
          return Promise.resolve({ id: args.where.id, ...args.data });
        }),
      },
      assessment: {
        upsert: vi.fn().mockImplementation((args: { create: Record<string, unknown> }) => {
          upsertedAssessments.push(args.create);
          return Promise.resolve({ id: "assess_1", ...args.create });
        }),
      },
      constraintSet: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          createdConstraints.push(args.data);
          return Promise.resolve({ id: "cs_1", ...args.data });
        }),
      },
      program: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          createdPrograms.push(args.data);
          return Promise.resolve({ id: "prog_1", ...args.data });
        }),
      },
      programItem: {
        create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          createdProgramItems.push(args.data);
          return Promise.resolve({ id: `item_${createdProgramItems.length}`, ...args.data });
        }),
      },
      activityEvent: {
        create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          createdActivityEvents.push(args.data);
          return Promise.resolve({ id: "evt_1", ...args.data });
        }),
      },
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return await callback(mockTx);
      }),
    } as unknown as PrismaClient;

    const input: GuestMigrationInput = {
      baseline: {
        username: "testuser",
        platform: "lichess",
        tacticalRatingEstimate: 1600,
        uncertainty: 150,
      },
      constraints: {
        minutesPerDay: 25,
        daysPerWeek: 5,
        formatPrefs: {
          formats: ["rapid", "blitz"],
          targetFocus: "online",
        },
        goals: ["improve_tactics"],
      },
      program: {
        methodologyVersion: "2026.04",
        items: [
          {
            id: "guest_item_1",
            orderIndex: 0,
            activityId: "blunder_drill",
            activityType: "blunder_drill",
            label: "Blunder check",
            status: "done",
          },
        ],
      },
      activityEvents: [
        {
          type: "drill_done",
          occurredAt: "2026-08-16T12:00:00.000Z",
          programItemId: "guest_item_1",
          payload: { correct: true, solveTimeMs: 3500 },
        },
      ],
    };

    const result = await migrateGuestSession(mockDb, "user_123", input);

    expect(result.success).toBe(true);
    expect(result.itemsMigrated).toBe(1);
    expect(result.hasAssessment).toBe(true);
    expect(result.hasConstraints).toBe(true);

    expect(createdConnections.length).toBe(1);
    expect(createdConnections[0]?.externalUsername).toBe("testuser");
    expect(upsertedAssessments.length).toBe(1);
    expect(upsertedAssessments[0]?.tacticalRatingEstimate).toBe(1600);
    expect(createdConstraints.length).toBe(1);
    expect(createdConstraints[0]?.minutesPerDay).toBe(25);
    expect(createdPrograms.length).toBe(1);
    expect(createdProgramItems.length).toBe(1);
    expect(createdActivityEvents.length).toBe(1);
    expect(createdActivityEvents[0]?.type).toBe("drill_done");
  });
});
