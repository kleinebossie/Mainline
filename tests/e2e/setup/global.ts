import { chmod, mkdir, writeFile } from "node:fs/promises";

import { PrismaClient, type Prisma } from "@prisma/client";

import {
  applyCalibrationResponse,
  getCalibrationState,
} from "../../../src/server/assessment";
import {
  AUTHJS_SESSION_COOKIE,
  AUTH_STATE_DIRECTORY,
  requireDisposablePlaywrightDatabaseUrl,
  SEEDED_USERS,
  type SeededUser,
} from "./database";

const FIXED_AT = new Date("2026-07-18T12:00:00.000Z");
const SESSION_EXPIRES = new Date("2099-01-01T00:00:00.000Z");
const METHODOLOGY_VERSION = "research-1.4.0";

function storageState(user: SeededUser) {
  return {
    cookies: [
      {
        name: AUTHJS_SESSION_COOKIE,
        value: user.sessionToken,
        domain: "localhost",
        path: "/",
        expires: Math.floor(SESSION_EXPIRES.getTime() / 1_000),
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };
}

async function seedUser(
  db: Prisma.TransactionClient,
  user: SeededUser,
): Promise<void> {
  await db.user.create({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      betaAccessGrantedAt: FIXED_AT,
      createdAt: FIXED_AT,
    },
  });
  await db.allowlistEntry.create({
    data: {
      id: user.allowlistId,
      email: user.email,
      usedByUserId: user.id,
      createdAt: FIXED_AT,
    },
  });
  await db.session.create({
    data: {
      id: user.sessionId,
      sessionToken: user.sessionToken,
      userId: user.id,
      expires: SESSION_EXPIRES,
    },
  });
  await db.platformConnection.create({
    data: {
      id: user.connectionId,
      userId: user.id,
      platform: "chesscom",
      externalUsername: user.id,
      status: "active",
      connectedAt: FIXED_AT,
      createdAt: FIXED_AT,
    },
  });
}

async function seedOnboardedState(
  db: Prisma.TransactionClient,
  user: typeof SEEDED_USERS.primary | typeof SEEDED_USERS.secondary,
): Promise<void> {
  await db.assessment.create({
    data: {
      id: user.assessmentId,
      userId: user.id,
      completedAt: FIXED_AT,
      calibrationResponses: [],
      tacticalRatingEstimate: 1500,
      uncertainty: 100,
      methodologyVersion: METHODOLOGY_VERSION,
      createdAt: FIXED_AT,
    },
  });
  await db.constraintSet.create({
    data: {
      id: user.constraintId,
      userId: user.id,
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
      isCurrent: true,
      version: 1,
      createdAt: FIXED_AT,
    },
  });
}

async function seedCalibrationThroughService(
  db: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  for (let responseCount = 0; responseCount < 100; responseCount += 1) {
    const state = await getCalibrationState(db, userId);
    if (state.completed) return;
    if (!state.activeTrack) {
      throw new Error("Core-loop calibration has no active track.");
    }
    await applyCalibrationResponse(
      db,
      userId,
      {
        ratingShown: state.activeTrack.next.ratingTarget,
        correct: false,
      },
      FIXED_AT,
    );
  }
  throw new Error("Core-loop calibration did not finish within 100 responses.");
}

/** Restore the dedicated core-loop user before each attempt, including Playwright retries. */
export async function resetCoreLoopFixture(db: PrismaClient): Promise<void> {
  await db.$transaction(
    async (tx) => {
      await tx.allowlistEntry.deleteMany({
        where: { id: SEEDED_USERS.coreLoop.allowlistId },
      });
      await tx.user.deleteMany({ where: { id: SEEDED_USERS.coreLoop.id } });
      await tx.lichessPuzzle.deleteMany({
        where: { puzzleId: SEEDED_USERS.coreLoop.puzzleId },
      });
      await seedUser(tx, SEEDED_USERS.coreLoop);
      await seedCalibrationThroughService(tx, SEEDED_USERS.coreLoop.id);
    },
    { timeout: 30_000 },
  );
}

async function writeStorageState(user: SeededUser): Promise<void> {
  await writeFile(
    user.storageStatePath,
    `${JSON.stringify(storageState(user), null, 2)}\n`,
    { mode: 0o600 },
  );
  await chmod(user.storageStatePath, 0o600);
}

export default async function globalSetup(): Promise<void> {
  const databaseUrl = requireDisposablePlaywrightDatabaseUrl();
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  const users = [
    SEEDED_USERS.primary,
    SEEDED_USERS.secondary,
    SEEDED_USERS.coreLoop,
  ] as const;

  try {
    await db.$transaction(
      async (tx) => {
        await tx.allowlistEntry.deleteMany({
          where: { id: { in: users.map((user) => user.allowlistId) } },
        });
        await tx.user.deleteMany({
          where: { id: { in: users.map((user) => user.id) } },
        });
        await tx.lichessPuzzle.deleteMany({
          where: { puzzleId: SEEDED_USERS.coreLoop.puzzleId },
        });

        for (const user of users) await seedUser(tx, user);
        await seedOnboardedState(tx, SEEDED_USERS.primary);
        await seedOnboardedState(tx, SEEDED_USERS.secondary);
        await seedCalibrationThroughService(tx, SEEDED_USERS.coreLoop.id);

        await tx.program.create({
          data: {
            id: SEEDED_USERS.secondary.programId,
            userId: SEEDED_USERS.secondary.id,
            methodologyVersion: METHODOLOGY_VERSION,
            generationInput: { source: "playwright-fixture" },
            createdAt: FIXED_AT,
          },
        });
        await tx.programItem.create({
          data: {
            id: SEEDED_USERS.secondary.programItemId,
            programId: SEEDED_USERS.secondary.programId,
            date: FIXED_AT,
            orderIndex: 0,
            activityId: "themed_tactics",
            activityType: "puzzle_theme",
            params: {
              theme: "playwright-empty-theme",
              track: "pattern",
              targetRating: 1500,
              count: 1,
              estMinutes: 10,
            },
            dimensionsTargeted: ["calculation"],
            rationaleKey: "playwright_fixture",
            rationaleText: "Disposable browser authorization fixture.",
            evidenceGrade: "D",
            evidenceTier: 2,
            citationKey: "playwright_fixture",
            confidence: "insufficient",
            soften: true,
            createdAt: FIXED_AT,
          },
        });
      },
      { timeout: 30_000 },
    );

    await mkdir(AUTH_STATE_DIRECTORY, { recursive: true });
    await Promise.all(users.map(writeStorageState));
  } finally {
    await db.$disconnect();
  }
}
