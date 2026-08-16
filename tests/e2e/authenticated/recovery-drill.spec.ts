import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

import { fixedClock } from "../../../src/lib/clock";
import { lockUserProgramMutation } from "../../../src/db/user-mutation-lock";
import { runDailyOperations } from "../../../src/server/daily-operations";
import { recordEngagementForMissedDay } from "../../../src/server/engagement";
import { assertActiveJobClaim, runJob } from "../../../src/server/jobs";
import {
  importClaimedConnection,
  markConnectionImportError,
} from "../../../src/server/import";
import {
  enqueueDailyWork,
  retryFailedJob,
} from "../../../src/server/maintenance";
import {
  purgeAccountByToken,
  requestAccountDeletion,
} from "../../../src/server/account";
import { connectionsRouter } from "../../../src/server/routers/connections";
import { operationsRouter } from "../../../src/server/routers/operations";
import {
  AUTHJS_SESSION_COOKIE,
  encodePlaywrightSessionToken,
  requireDisposablePlaywrightDatabaseUrl,
} from "../setup/database";

const PREFIX = "wave1-recovery";
const NOW = Date.parse("2026-07-18T12:00:00.000Z");
const MISSED_AT = Date.parse("2026-07-17T00:00:00.000Z");
const METHODOLOGY_VERSION = "research-1.4.0";
const USER_IDS = {
  active: `${PREFIX}-active-user`,
  queued: `${PREFIX}-queued-user`,
  operator: `${PREFIX}-operator-user`,
  nonAdmin: `${PREFIX}-non-admin-user`,
  fenced: `${PREFIX}-fenced-user`,
  concurrent: `${PREFIX}-concurrent-user`,
  disconnectRace: `${PREFIX}-disconnect-race-user`,
  lifecycle: `${PREFIX}-lifecycle-user`,
  importRace: `${PREFIX}-import-race-user`,
  prunedPurge: `${PREFIX}-pruned-purge-user`,
  purge: `${PREFIX}-purge-user`,
} as const;
const PURGE_TOKEN = `${PREFIX}-purge-token`;
const PRUNED_PURGE_TOKEN = `${PREFIX}-pruned-purge-token`;
const STALE_PURGE_TOKEN = `${PREFIX}-stale-purge-token`;

const db = new PrismaClient({
  datasourceUrl: requireDisposablePlaywrightDatabaseUrl(),
});
let jobIdsBeforeTest: Set<string> | null = null;

async function cleanRecoveryFixtures(): Promise<void> {
  await db.jobRun.deleteMany({ where: { key: { contains: PREFIX } } });
  await db.user.deleteMany({ where: { id: { in: Object.values(USER_IDS) } } });
  await db.accountPurgeLedger.deleteMany({
    where: {
      OR: [{ token: { contains: PREFIX } }, { requestedAt: new Date(NOW) }],
    },
  });
}

async function createUser(
  id: string,
  role: "admin" | "user" = "user",
): Promise<void> {
  await db.user.create({
    data: {
      id,
      email: `${id}@mainline.playwright.invalid`,
      role,
      betaAccessGrantedAt: new Date(NOW),
      createdAt: new Date(NOW),
    },
  });
}

async function createMissedDayPlan(userId: string): Promise<void> {
  await db.program.create({
    data: {
      id: `${userId}-program`,
      userId,
      methodologyVersion: METHODOLOGY_VERSION,
      generationInput: { source: PREFIX },
      createdAt: new Date(MISSED_AT),
      items: {
        create: {
          id: `${userId}-item`,
          date: new Date(MISSED_AT),
          orderIndex: 0,
          activityId: "recovery_fixture",
          activityType: "puzzle_theme",
          params: {},
          dimensionsTargeted: [],
          rationaleKey: "recovery_fixture",
          rationaleText: "Disposable recovery acceptance fixture.",
          evidenceGrade: "D",
          evidenceTier: 2,
          citationKey: "recovery_fixture",
          confidence: "insufficient",
          soften: true,
          createdAt: new Date(MISSED_AT),
        },
      },
    },
  });
}

function operationsCaller(userId: string) {
  return operationsRouter.createCaller({
    session: { user: { id: userId }, expires: "2099-01-01" },
    prisma: db,
  } as never);
}

test.beforeEach(async () => {
  await cleanRecoveryFixtures();
  jobIdsBeforeTest = new Set(
    (await db.jobRun.findMany({ select: { id: true } })).map((job) => job.id),
  );
});

test.afterEach(async () => {
  const baselineIds = jobIdsBeforeTest;
  if (baselineIds) {
    const createdIds = (await db.jobRun.findMany({ select: { id: true } }))
      .map((job) => job.id)
      .filter((id) => !baselineIds.has(id));
    await db.jobRun.deleteMany({ where: { id: { in: createdIds } } });
  }
  jobIdsBeforeTest = null;
  await cleanRecoveryFixtures();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("pruning cannot strand an incomplete account purge", async () => {
  await db.user.create({
    data: {
      id: USER_IDS.prunedPurge,
      email: `${USER_IDS.prunedPurge}@mainline.playwright.invalid`,
      betaAccessGrantedAt: new Date(NOW),
      deletedAt: new Date(NOW),
      deletionRequestedAt: new Date(NOW),
      deletionToken: PRUNED_PURGE_TOKEN,
      createdAt: new Date(NOW),
    },
  });
  await db.accountPurgeLedger.create({
    data: { token: PRUNED_PURGE_TOKEN, requestedAt: new Date(NOW) },
  });
  const oldJob = await db.jobRun.create({
    data: {
      kind: "account_purge",
      key: `account_purge:${PRUNED_PURGE_TOKEN}`,
      status: "error",
      attempt: 3,
      startedAt: new Date(NOW - 32 * 86_400_000),
      finishedAt: new Date(NOW - 31 * 86_400_000),
      error: "Job failed. Retry is safe.",
      errorCode: "error",
    },
  });
  const existingIds = new Set(
    (await db.jobRun.findMany({ select: { id: true } })).map((job) => job.id),
  );

  const summary = await runDailyOperations(db, fixedClock(NOW), NOW);

  expect(summary.maintenance.prunedJobRuns).toBeGreaterThanOrEqual(1);
  expect(summary.queue.deadlineReached).toBe(true);
  expect(await db.jobRun.findUnique({ where: { id: oldJob.id } })).toBeNull();
  expect(
    await db.jobRun.findUnique({
      where: { key: `account_purge:${PRUNED_PURGE_TOKEN}` },
    }),
  ).toMatchObject({ status: "queued", attempt: 0 });
  expect(
    await db.accountPurgeLedger.findUnique({
      where: { token: PRUNED_PURGE_TOKEN },
    }),
  ).toMatchObject({ completedAt: null });

  const createdIds = (await db.jobRun.findMany({ select: { id: true } }))
    .map((job) => job.id)
    .filter((id) => !existingIds.has(id));
  await db.jobRun.deleteMany({ where: { id: { in: createdIds } } });
});

test("a stale missing-user purge claim cannot rewrite completion evidence", async () => {
  await db.accountPurgeLedger.create({
    data: { token: STALE_PURGE_TOKEN, requestedAt: new Date(NOW) },
  });
  const key = `account_purge:${STALE_PURGE_TOKEN}`;
  await db.jobRun.create({
    data: {
      kind: "account_purge",
      key,
      status: "running",
      attempt: 2,
      startedAt: new Date(NOW + 1),
      lockedUntil: new Date(NOW + 60_001),
    },
  });

  await expect(
    purgeAccountByToken(db, STALE_PURGE_TOKEN, fixedClock(NOW + 100), {
      key,
      attempt: 1,
    }),
  ).rejects.toThrow("superseded");
  expect(
    await db.accountPurgeLedger.findUnique({
      where: { token: STALE_PURGE_TOKEN },
    }),
  ).toMatchObject({ completedAt: null });

  await expect(
    purgeAccountByToken(db, STALE_PURGE_TOKEN, fixedClock(NOW + 2), {
      key,
      attempt: 2,
    }),
  ).resolves.toEqual({ alreadyPurged: false });
  await db.jobRun.delete({ where: { key } });
  expect(
    await db.accountPurgeLedger.findUnique({
      where: { token: STALE_PURGE_TOKEN },
    }),
  ).toMatchObject({ completedAt: new Date(NOW + 2) });
});

test("a delayed failed import cannot overwrite a newer successful attempt", async () => {
  await createUser(USER_IDS.importRace);
  const connection = await db.platformConnection.create({
    data: {
      id: `${PREFIX}-import-race-connection`,
      userId: USER_IDS.importRace,
      platform: "lichess",
      externalUsername: `${PREFIX}_import_race`,
      status: "active",
      connectedAt: new Date(NOW),
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    },
  });
  const key = `import_sync:${PREFIX}:race:${connection.id}`;
  let releaseOldFailure: (() => void) | undefined;
  const oldFailureGate = new Promise<void>((resolve) => {
    releaseOldFailure = resolve;
  });
  const oldWorker = runJob(db, {
    kind: "import_sync",
    key,
    owner: { userId: USER_IDS.importRace, connectionId: connection.id },
    clock: fixedClock(NOW),
    leaseMs: 60_000,
    run: async (claim) => {
      await oldFailureGate;
      await markConnectionImportError(
        db,
        connection,
        claim,
        fixedClock(NOW + 100),
      );
      throw new Error("delayed old import failure");
    },
  });
  await expect
    .poll(() =>
      db.jobRun.findUnique({
        where: { key },
        select: { status: true, attempt: true },
      }),
    )
    .toEqual({ status: "running", attempt: 1 });
  await expect(
    db.jobRun.updateMany({
      where: { key, attempt: 1, status: "running" },
      data: {
        attempt: 2,
        startedAt: new Date(NOW + 1),
        lockedUntil: new Date(NOW + 60_001),
      },
    }),
  ).resolves.toEqual({ count: 1 });

  await db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, USER_IDS.importRace);
    await assertActiveJobClaim(tx, { key, attempt: 2 });
    await tx.platformConnection.update({
      where: { id: connection.id },
      data: { status: "active", updatedAt: new Date(NOW + 2) },
    });
  });
  await expect(
    markConnectionImportError(
      db,
      connection,
      { key, attempt: 2 },
      fixedClock(NOW + 3),
    ),
  ).resolves.toBe(false);
  await expect(
    db.jobRun.updateMany({
      where: { key, attempt: 2, status: "running" },
      data: {
        status: "success",
        finishedAt: new Date(NOW + 4),
        lockedUntil: null,
      },
    }),
  ).resolves.toEqual({ count: 1 });

  releaseOldFailure?.();
  await expect(oldWorker).resolves.toEqual({
    state: "skipped",
    reason: "superseded",
  });
  expect(
    await db.platformConnection.findUnique({
      where: { id: connection.id },
      select: { status: true, updatedAt: true },
    }),
  ).toEqual({ status: "active", updatedAt: new Date(NOW + 2) });
});

test("an import retry reloads the connection after the first attempt fails", async () => {
  await createUser(USER_IDS.importRace);
  const connection = await db.platformConnection.create({
    data: {
      id: `${PREFIX}-import-refresh-connection`,
      userId: USER_IDS.importRace,
      platform: "lichess",
      externalUsername: `${PREFIX}_import_refresh`,
      status: "active",
      connectedAt: new Date(NOW),
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    },
  });
  const capturedBeforeFailure = connection.updatedAt;
  const key = `import_sync:${PREFIX}:refresh:${connection.id}`;
  await db.jobRun.create({
    data: {
      kind: "import_sync",
      key,
      status: "queued",
      attempt: 0,
    },
  });

  await expect(
    runJob(db, {
      kind: "import_sync",
      key,
      owner: { userId: USER_IDS.importRace, connectionId: connection.id },
      clock: fixedClock(NOW + 1),
      run: (claim) =>
        importClaimedConnection(
          db,
          USER_IDS.importRace,
          connection.id,
          claim,
          fixedClock(NOW + 1),
          async () => {
            throw new Error("deterministic remote failure");
          },
        ),
    }),
  ).rejects.toThrow("deterministic remote failure");
  const failedConnection = await db.platformConnection.findUniqueOrThrow({
    where: { id: connection.id },
  });
  expect(failedConnection).toMatchObject({ status: "error" });
  expect(failedConnection.updatedAt).not.toEqual(capturedBeforeFailure);
  expect(await db.jobRun.findUnique({ where: { key } })).toMatchObject({
    status: "error",
    attempt: 1,
  });

  let refreshedVersion: Date | undefined;
  await expect(
    runJob(db, {
      kind: "import_sync",
      key,
      owner: { userId: USER_IDS.importRace, connectionId: connection.id },
      clock: fixedClock(NOW + 2),
      run: (claim) =>
        importClaimedConnection(
          db,
          USER_IDS.importRace,
          connection.id,
          claim,
          fixedClock(NOW + 2),
          async (client, refreshed, _clock, activeClaim) => {
            refreshedVersion = refreshed.updatedAt;
            const updated = await client.$transaction(async (tx) => {
              await lockUserProgramMutation(tx, USER_IDS.importRace);
              await assertActiveJobClaim(tx, activeClaim);
              return tx.platformConnection.updateMany({
                where: {
                  id: refreshed.id,
                  userId: USER_IDS.importRace,
                  updatedAt: refreshed.updatedAt,
                },
                data: {
                  status: "active",
                  updatedAt: new Date(NOW + 3),
                },
              });
            });
            expect(updated.count).toBe(1);
            return {
              platform: "lichess",
              snapshotCaptured: true,
              fetched: 0,
              imported: 0,
            };
          },
        ),
    }),
  ).resolves.toMatchObject({ state: "completed", attempt: 2 });
  expect(refreshedVersion).toEqual(failedConnection.updatedAt);
  expect(refreshedVersion).not.toEqual(capturedBeforeFailure);
  expect(
    await db.platformConnection.findUnique({
      where: { id: connection.id },
      select: { status: true, updatedAt: true },
    }),
  ).toEqual({ status: "active", updatedAt: new Date(NOW + 3) });
});

test("an admin can inspect and retry a stale job without sensitive fields", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required.");
  await createUser(USER_IDS.operator, "admin");
  const sessionToken = `${PREFIX}-operator-session-token`;
  await db.session.create({
    data: {
      id: `${PREFIX}-operator-session`,
      sessionToken,
      userId: USER_IDS.operator,
      expires: new Date("2099-01-01T00:00:00.000Z"),
    },
  });
  const privateKeyFragment = `${PREFIX}-private-user-fragment`;
  const privateErrorFragment = `${PREFIX}-private-error-fragment`;
  const job = await db.jobRun.create({
    data: {
      kind: "daily_adaptation",
      key: `daily_adaptation:${privateKeyFragment}:${USER_IDS.operator}`,
      status: "running",
      attempt: 2,
      startedAt: new Date(NOW - 60_000),
      lockedUntil: new Date(0),
      error: privateErrorFragment,
      errorCode: "fixture_error",
    },
  });
  const authCookieValue = await encodePlaywrightSessionToken(USER_IDS.operator);
  await page.context().addCookies([
    {
      name: AUTHJS_SESSION_COOKIE,
      value: authCookieValue,
      url: baseURL,
      expires: Date.parse("2099-01-01T00:00:00.000Z") / 1_000,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/settings");
  const operations = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Operations" }),
  });
  const jobCard = operations.locator("article").filter({
    hasText: "daily_adaptation",
  });
  await expect(jobCard).toContainText("running · attempt 2");
  await expect(jobCard).toContainText("stale since");
  await expect(jobCard).toContainText("fixture_error");
  await expect(page.locator("body")).not.toContainText(privateKeyFragment);
  await expect(page.locator("body")).not.toContainText(privateErrorFragment);

  await jobCard.getByRole("button", { name: "Retry" }).click();
  await expect(jobCard).toContainText("success · attempt 3");
  await expect(jobCard.getByRole("button", { name: "Retry" })).toHaveCount(0);
  expect(await db.jobRun.findUnique({ where: { id: job.id } })).toMatchObject({
    status: "success",
    attempt: 3,
    error: null,
  });
});

test("deterministic recovery drill fences effects and keeps recovery operable", async () => {
  for (const userId of Object.values(USER_IDS).filter(
    (id) =>
      id !== USER_IDS.purge &&
      id !== USER_IDS.prunedPurge &&
      id !== USER_IDS.importRace,
  )) {
    await createUser(userId, userId === USER_IDS.operator ? "admin" : "user");
  }
  await createMissedDayPlan(USER_IDS.fenced);
  await createMissedDayPlan(USER_IDS.concurrent);

  const failureKey = `${PREFIX}:sanitized-failure`;
  await expect(
    runJob(db, {
      kind: "recovery_probe",
      key: failureKey,
      clock: fixedClock(NOW),
      run: () =>
        Promise.reject(
          new TypeError("private token and PGN must never enter the ledger"),
        ),
    }),
  ).rejects.toThrow("private token");
  expect(
    await db.jobRun.findUnique({ where: { key: failureKey } }),
  ).toMatchObject({
    status: "error",
    attempt: 1,
    error: "Job failed. Retry is safe.",
    errorCode: "typeerror",
  });
  expect(
    JSON.stringify(await db.jobRun.findUnique({ where: { key: failureKey } })),
  ).not.toContain("private token");

  await expect(
    runJob(db, {
      kind: "recovery_probe",
      key: failureKey,
      clock: fixedClock(NOW + 1),
      run: () => Promise.resolve("recovered"),
    }),
  ).resolves.toMatchObject({ state: "completed", attempt: 2 });
  const immutableSuccess = await db.jobRun.findUnique({
    where: { key: failureKey },
  });
  await expect(
    runJob(db, {
      kind: "recovery_probe",
      key: failureKey,
      clock: fixedClock(NOW + 2),
      run: () => Promise.resolve("must not run"),
    }),
  ).resolves.toEqual({ state: "skipped", reason: "complete" });
  expect(await db.jobRun.findUnique({ where: { key: failureKey } })).toEqual(
    immutableSuccess,
  );

  const activeKey = `${PREFIX}:active-lease`;
  let releaseActive: (() => void) | undefined;
  const activeGate = new Promise<void>((resolve) => {
    releaseActive = resolve;
  });
  const activeWorker = runJob(db, {
    kind: "recovery_probe",
    key: activeKey,
    clock: fixedClock(NOW),
    leaseMs: 60_000,
    run: async () => {
      await activeGate;
      return "active-complete";
    },
  });
  await expect
    .poll(() =>
      db.jobRun.findUnique({
        where: { key: activeKey },
        select: { status: true, attempt: true },
      }),
    )
    .toEqual({ status: "running", attempt: 1 });
  await expect(
    runJob(db, {
      kind: "recovery_probe",
      key: activeKey,
      clock: fixedClock(NOW + 1),
      run: () => Promise.resolve("stolen"),
    }),
  ).resolves.toEqual({ state: "skipped", reason: "active" });
  releaseActive?.();
  await expect(activeWorker).resolves.toMatchObject({
    state: "completed",
    attempt: 1,
  });

  const queuedKey = `daily_adaptation:${PREFIX}:queued:${USER_IDS.queued}`;
  const queued = await db.jobRun.create({
    data: {
      kind: "daily_adaptation",
      key: queuedKey,
      status: "queued",
      attempt: 0,
      startedAt: new Date(NOW),
    },
  });
  await expect(
    retryFailedJob(db, queued.id, fixedClock(NOW)),
  ).resolves.toMatchObject({ state: "completed", kind: "daily_adaptation" });
  expect(
    await db.jobRun.findUnique({ where: { key: queuedKey } }),
  ).toMatchObject({ status: "success", attempt: 1 });

  const fencedKey = `${PREFIX}:stale-effect`;
  let releaseStale: (() => void) | undefined;
  const staleGate = new Promise<void>((resolve) => {
    releaseStale = resolve;
  });
  const staleWorker = runJob(db, {
    kind: "day_missed",
    key: fencedKey,
    clock: fixedClock(NOW),
    leaseMs: 60_000,
    run: async (claim) => {
      await staleGate;
      return recordEngagementForMissedDay(
        db,
        USER_IDS.fenced,
        MISSED_AT,
        claim,
      );
    },
  });
  await expect
    .poll(() =>
      db.jobRun.findUnique({
        where: { key: fencedKey },
        select: { status: true, attempt: true },
      }),
    )
    .toEqual({ status: "running", attempt: 1 });
  await expect(
    db.jobRun.updateMany({
      where: { key: fencedKey, attempt: 1, status: "running" },
      data: {
        attempt: 2,
        startedAt: new Date(NOW + 1),
        lockedUntil: new Date(NOW + 60_001),
      },
    }),
  ).resolves.toEqual({ count: 1 });
  await expect(
    recordEngagementForMissedDay(db, USER_IDS.fenced, MISSED_AT, {
      key: fencedKey,
      attempt: 2,
    }),
  ).resolves.toEqual({ recorded: true });
  await expect(
    db.jobRun.updateMany({
      where: { key: fencedKey, attempt: 2, status: "running" },
      data: {
        status: "success",
        finishedAt: new Date(NOW + 2),
        lockedUntil: null,
      },
    }),
  ).resolves.toEqual({ count: 1 });
  expect(
    await db.jobRun.findUnique({ where: { key: fencedKey } }),
  ).toMatchObject({
    status: "success",
    attempt: 2,
  });
  releaseStale?.();
  await expect(staleWorker).resolves.toEqual({
    state: "skipped",
    reason: "superseded",
  });
  expect(
    await db.rewardEvent.count({
      where: { userId: USER_IDS.fenced, type: "recovery_prompt" },
    }),
  ).toBe(1);

  const concurrentResults = await Promise.all([
    recordEngagementForMissedDay(db, USER_IDS.concurrent, MISSED_AT),
    recordEngagementForMissedDay(db, USER_IDS.concurrent, MISSED_AT),
  ]);
  expect(concurrentResults.map((result) => result.recorded).sort()).toEqual([
    false,
    true,
  ]);
  expect(
    await db.rewardEvent.count({
      where: { userId: USER_IDS.concurrent, type: "recovery_prompt" },
    }),
  ).toBe(1);

  const orphan = await db.jobRun.create({
    data: {
      kind: "import_sync",
      key: `import_sync:${PREFIX}:missing-connection`,
      status: "error",
      attempt: 2,
      startedAt: new Date(NOW),
      finishedAt: new Date(NOW),
      error: "Job failed. Retry is safe.",
      errorCode: "error",
    },
  });
  await expect(retryFailedJob(db, orphan.id, fixedClock(NOW))).resolves.toEqual(
    {
      state: "completed",
      kind: "import_sync",
      imported: 0,
    },
  );
  expect(await db.jobRun.findUnique({ where: { id: orphan.id } })).toBeNull();

  const operatorKey = `daily_adaptation:${PREFIX}:operator:${USER_IDS.active}`;
  const operatorJob = await db.jobRun.create({
    data: {
      kind: "daily_adaptation",
      key: operatorKey,
      status: "running",
      attempt: 2,
      startedAt: new Date(NOW - 60_000),
      lockedUntil: new Date(0),
    },
  });
  await db.jobRun.createMany({
    data: Array.from({ length: 55 }, (_, index) => ({
      kind: "recovery_probe",
      key: `${PREFIX}:recent-success:${index}`,
      status: "success",
      attempt: 1,
      startedAt: new Date(NOW + index),
      finishedAt: new Date(NOW + index),
    })),
  });
  const operator = operationsCaller(USER_IDS.operator);
  const visibleJobs = await operator.recentJobs();
  expect(visibleJobs.find((job) => job.id === operatorJob.id)).toMatchObject({
    id: operatorJob.id,
    retryable: true,
    lockedUntil: new Date(0),
  });
  await expect(
    operator.retryJob({ id: operatorJob.id }),
  ).resolves.toMatchObject({ state: "completed", kind: "daily_adaptation" });
  expect(
    await db.jobRun.findUnique({ where: { id: operatorJob.id } }),
  ).toMatchObject({ status: "success", attempt: 3 });
  await expect(
    operationsCaller(USER_IDS.nonAdmin).recentJobs(),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    operationsCaller(USER_IDS.nonAdmin).retryJob({ id: operatorJob.id }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  const beforeLifecycleJobIds = new Set(
    (await db.jobRun.findMany({ select: { id: true } })).map((job) => job.id),
  );
  const [, lifecycleToken] = await Promise.all([
    enqueueDailyWork(db, fixedClock(NOW)),
    requestAccountDeletion(db, USER_IDS.lifecycle, fixedClock(NOW)),
  ]);
  const lifecyclePurge = await db.jobRun.findUniqueOrThrow({
    where: { key: `account_purge:${lifecycleToken}` },
    select: { id: true },
  });
  await expect(
    retryFailedJob(db, lifecyclePurge.id, fixedClock(NOW)),
  ).resolves.toMatchObject({ state: "completed", kind: "account_purge" });
  expect(
    await db.jobRun.count({
      where: { key: { contains: USER_IDS.lifecycle } },
    }),
  ).toBe(0);
  const lifecycleCreatedJobIds = (
    await db.jobRun.findMany({ select: { id: true } })
  )
    .map((job) => job.id)
    .filter((id) => !beforeLifecycleJobIds.has(id));
  await db.jobRun.deleteMany({
    where: { id: { in: lifecycleCreatedJobIds } },
  });

  const disconnectConnectionId = `${PREFIX}-disconnect-race-connection`;
  await db.platformConnection.create({
    data: {
      id: disconnectConnectionId,
      userId: USER_IDS.disconnectRace,
      platform: "chesscom",
      externalUsername: `${PREFIX}_disconnect_race`,
      status: "active",
      connectedAt: new Date(NOW),
      createdAt: new Date(NOW),
    },
  });
  const beforeDisconnectJobIds = new Set(
    (await db.jobRun.findMany({ select: { id: true } })).map((job) => job.id),
  );
  const disconnectCaller = connectionsRouter.createCaller({
    session: {
      user: { id: USER_IDS.disconnectRace },
      expires: "2099-01-01",
    },
    prisma: db,
  } as never);
  await Promise.all([
    enqueueDailyWork(db, fixedClock(NOW)),
    disconnectCaller.disconnect({ id: disconnectConnectionId }),
  ]);
  expect(
    await db.jobRun.count({
      where: { key: { endsWith: `:${disconnectConnectionId}` } },
    }),
  ).toBe(0);
  let lateImportRan = false;
  await expect(
    runJob(db, {
      kind: "import_sync",
      key: `import_sync:${PREFIX}:late:${disconnectConnectionId}`,
      owner: {
        userId: USER_IDS.disconnectRace,
        connectionId: disconnectConnectionId,
      },
      clock: fixedClock(NOW),
      run: async () => {
        lateImportRan = true;
        return null;
      },
    }),
  ).resolves.toEqual({ state: "skipped", reason: "superseded" });
  expect(lateImportRan).toBe(false);
  expect(
    await db.jobRun.findUnique({
      where: { key: `import_sync:${PREFIX}:late:${disconnectConnectionId}` },
    }),
  ).toBeNull();
  const disconnectCreatedJobIds = (
    await db.jobRun.findMany({ select: { id: true } })
  )
    .map((job) => job.id)
    .filter((id) => !beforeDisconnectJobIds.has(id));
  await db.jobRun.deleteMany({
    where: { id: { in: disconnectCreatedJobIds } },
  });

  await db.user.create({
    data: {
      id: USER_IDS.purge,
      email: `${USER_IDS.purge}@mainline.playwright.invalid`,
      betaAccessGrantedAt: new Date(NOW),
      deletedAt: new Date(NOW),
      deletionRequestedAt: new Date(NOW),
      deletionToken: PURGE_TOKEN,
      createdAt: new Date(NOW),
    },
  });
  await db.accountPurgeLedger.create({
    data: { token: PURGE_TOKEN, requestedAt: new Date(NOW) },
  });
  await db.jobRun.create({
    data: {
      kind: "account_purge",
      key: `account_purge:${PURGE_TOKEN}`,
      status: "queued",
      attempt: 0,
      startedAt: new Date(NOW + 10_000),
    },
  });
  await db.jobRun.createMany({
    data: Array.from({ length: 500 }, (_, index) => ({
      kind: "daily_adaptation",
      key: `daily_adaptation:${PREFIX}:backlog:${index}`,
      status: "queued",
      attempt: 0,
      startedAt: new Date(NOW - 100_000 + index),
    })),
  });
  let drainNow = NOW;
  const drainClock = { now: () => drainNow };
  const deadlineAt = NOW + 100_000;
  const summary = await runDailyOperations(db, drainClock, deadlineAt, {
    enqueue: async () => ({ users: 0, connections: 0, enqueued: 0 }),
    prune: async () => ({ prunedBudgetBuckets: 0, prunedJobRuns: 0 }),
    retry: async (client, jobId, clock) => {
      const result = await retryFailedJob(client, jobId, clock);
      drainNow = deadlineAt;
      return result;
    },
  });
  expect(summary.queue).toMatchObject({
    processed: 1,
    deadlineReached: true,
  });
  expect(summary.queue.remaining).toBeGreaterThanOrEqual(500);
  expect(
    await db.user.findUnique({ where: { id: USER_IDS.purge } }),
  ).toBeNull();
  expect(
    await db.accountPurgeLedger.findUnique({ where: { token: PURGE_TOKEN } }),
  ).toMatchObject({ completedAt: new Date(NOW) });
});
