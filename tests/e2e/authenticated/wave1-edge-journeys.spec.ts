import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import {
  expect,
  test as base,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { logOutcome } from "@/server/tracker";
import { recordEngagementForMissedDay } from "@/server/engagement";
import { connectionsRouter } from "@/server/routers/connections";
import {
  AUTHJS_SESSION_COOKIE,
  requireDisposablePlaywrightDatabaseUrl,
} from "../setup/database";

const db = new PrismaClient({
  datasourceUrl: requireDisposablePlaywrightDatabaseUrl(),
});
const FIXTURE_AT = new Date("2026-07-18T12:00:00.000Z");
const SESSION_EXPIRES = new Date("2099-01-01T00:00:00.000Z");
const METHODOLOGY_VERSION = "research-1.4.0";

interface EdgeUser {
  id: string;
  email: string;
  sessionToken: string;
  connectionId: string;
  externalUsername: string;
}

interface EdgeFixtures {
  edgeUser: EdgeUser;
}

function testSlug(testInfo: TestInfo): string {
  return testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
}

async function createEdgeUser(label: string): Promise<EdgeUser> {
  const nonce = randomUUID();
  const id = `wave1-edge-${label}-${nonce}`;
  const email = `${id}@mainline.playwright.invalid`;
  const sessionToken = `wave1-edge-session-${nonce}`;
  const connectionId = `wave1-edge-connection-${nonce}`;
  const externalUsername = `edge_${nonce.replace(/-/g, "").slice(0, 20)}`;

  await db.user.create({
    data: {
      id,
      name: `Wave 1 ${label}`,
      email,
      betaAccessGrantedAt: FIXTURE_AT,
      setupRevealSeenAt: FIXTURE_AT,
      createdAt: FIXTURE_AT,
      sessions: {
        create: {
          id: `wave1-edge-auth-session-${nonce}`,
          sessionToken,
          expires: SESSION_EXPIRES,
        },
      },
      platformConnections: {
        create: {
          id: connectionId,
          platform: "chesscom",
          externalUsername,
          status: "active",
          connectedAt: FIXTURE_AT,
          createdAt: FIXTURE_AT,
        },
      },
      assessment: {
        create: {
          id: `wave1-edge-assessment-${nonce}`,
          completedAt: FIXTURE_AT,
          calibrationResponses: [],
          tacticalRatingEstimate: 1500,
          uncertainty: 100,
          methodologyVersion: METHODOLOGY_VERSION,
          createdAt: FIXTURE_AT,
        },
      },
      constraintSets: {
        create: {
          id: `wave1-edge-constraints-${nonce}`,
          minutesPerDay: 20,
          daysPerWeek: 5,
          goals: [],
          ownedResources: [],
          formatPrefs: {
            formats: ["rapid"],
            preferredVariety: false,
            targetFocus: "online",
          },
          sessionStyle: {
            depthVsBreadth: "balanced",
            interleave: true,
          },
          isCurrent: true,
          version: 1,
          createdAt: FIXTURE_AT,
        },
      },
    },
  });

  return { id, email, sessionToken, connectionId, externalUsername };
}

async function deleteEdgeUser(user: EdgeUser): Promise<void> {
  await db.lichessPuzzle.deleteMany({
    where: { puzzleId: { contains: user.id } },
  });
  await db.user.deleteMany({ where: { id: user.id } });
}

async function authenticatePage(
  page: Page,
  baseURL: string | undefined,
  user: EdgeUser,
): Promise<void> {
  if (!baseURL) throw new Error("Playwright baseURL is required.");
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: AUTHJS_SESSION_COOKIE,
      value: user.sessionToken,
      url: baseURL,
      expires: Math.floor(SESSION_EXPIRES.getTime() / 1_000),
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

const test = base.extend<EdgeFixtures>({
  edgeUser: async ({ page, baseURL }, provide, testInfo) => {
    const user = await createEdgeUser(
      `${testSlug(testInfo)}-${testInfo.workerIndex}`,
    );
    await authenticatePage(page, baseURL, user);
    try {
      await provide(user);
    } finally {
      await deleteEdgeUser(user);
    }
  },
});

async function createProgramItem(
  user: EdgeUser,
  options: {
    itemId: string;
    activityType?: "puzzle_theme" | "analyse";
    theme?: string;
  },
): Promise<{ programId: string; itemId: string }> {
  const programId = `program-${options.itemId}`;
  await db.program.create({
    data: {
      id: programId,
      userId: user.id,
      methodologyVersion: METHODOLOGY_VERSION,
      generationInput: { source: "wave1_edge_browser_fixture" },
      createdAt: FIXTURE_AT,
      items: {
        create: {
          id: options.itemId,
          date: FIXTURE_AT,
          orderIndex: 0,
          activityId:
            options.activityType === "analyse"
              ? "review_own_games"
              : "themed_tactics",
          activityType: options.activityType ?? "puzzle_theme",
          params: {
            theme: options.theme ?? null,
            track: "pattern",
            targetRating: 1500,
            count: 1,
            estMinutes: 10,
          },
          dimensionsTargeted: ["tactics"],
          rationaleKey: "wave1_edge_fixture",
          rationaleText: "Disposable edge-journey browser fixture.",
          evidenceGrade: "D",
          evidenceTier: 2,
          citationKey: "wave1_edge_fixture",
          confidence: "insufficient",
          soften: true,
          createdAt: FIXTURE_AT,
        },
      },
    },
  });
  return { programId, itemId: options.itemId };
}

function callerFor(user: EdgeUser) {
  return connectionsRouter.createCaller({
    prisma: db,
    session: {
      user: { id: user.id, email: user.email, name: null },
      expires: SESSION_EXPIRES.toISOString(),
    },
  });
}

function requestIdIn(body: string | null): string | null {
  if (!body) return null;
  const root: unknown = JSON.parse(body);
  const visit = (value: unknown): string | null => {
    if (!value || typeof value !== "object") return null;
    if (
      "requestId" in value &&
      typeof (value as { requestId?: unknown }).requestId === "string"
    ) {
      return (value as { requestId: string }).requestId;
    }
    for (const nested of Object.values(value)) {
      const found = visit(nested);
      if (found) return found;
    }
    return null;
  };
  return visit(root);
}

test("a planned missed day records one graded recovery note and can be cleared", async ({
  page,
  edgeUser,
}) => {
  const missedAt = Date.UTC(2026, 6, 17);
  await createProgramItem(edgeUser, {
    itemId: `missed-${edgeUser.id}`,
    activityType: "analyse",
  });
  await db.programItem.update({
    where: { id: `missed-${edgeUser.id}` },
    data: { date: new Date(missedAt) },
  });

  await expect(
    recordEngagementForMissedDay(db, edgeUser.id, missedAt),
  ).resolves.toEqual({ recorded: true });
  await expect(
    recordEngagementForMissedDay(db, edgeUser.id, missedAt),
  ).resolves.toEqual({ recorded: false });

  const events = await db.rewardEvent.findMany({
    where: { userId: edgeUser.id, type: "recovery_prompt" },
  });
  expect(events).toHaveLength(1);
  expect(events[0]!.occurredAt).toEqual(new Date(missedAt));
  expect(events[0]!.seen).toBe(false);

  await page.goto("/progress");
  const note = page.getByRole("complementary", {
    name: "Return to the board",
  });
  await expect(note).toContainText(
    "One missed day does not erase completed work.",
  );
  await expect(note).toContainText("Grade B / Tier 2");
  await expect(note).toContainText("Lally et al. 2010");

  await note.getByRole("button", { name: "Clear note" }).click();
  await expect(note).toHaveCount(0);
  await expect
    .poll(() =>
      db.rewardEvent.findUnique({
        where: { id: events[0]!.id },
        select: { seen: true },
      }),
    )
    .toEqual({ seen: true });
});

test("disconnect preserves history, restores setup gating, and rejects a foreign id", async ({
  page,
  edgeUser,
}) => {
  const neighbour = await createEdgeUser("disconnect-neighbour");
  try {
    await db.chessProfileSnapshot.createMany({
      data: [
        {
          id: `snapshot-${edgeUser.id}`,
          userId: edgeUser.id,
          platform: "chesscom",
          capturedAt: FIXTURE_AT,
          ratings: { rapid: { rating: 1500, rd: 80, games: 20 } },
          totalGames: 20,
          raw: { fixture: true },
          createdAt: FIXTURE_AT,
        },
        {
          id: `snapshot-${neighbour.id}`,
          userId: neighbour.id,
          platform: "chesscom",
          capturedAt: FIXTURE_AT,
          ratings: { rapid: { rating: 1600, rd: 70, games: 30 } },
          totalGames: 30,
          raw: { fixture: true },
          createdAt: FIXTURE_AT,
        },
      ],
    });
    await db.importedGame.createMany({
      data: [
        {
          id: `game-${edgeUser.id}`,
          userId: edgeUser.id,
          platform: "chesscom",
          externalGameId: `external-${edgeUser.id}`,
          dedupeKey: `chesscom:${edgeUser.id}`,
          pgn: "1. e4 e5 *",
          source: "chesscom",
          importedAt: FIXTURE_AT,
        },
        {
          id: `game-${neighbour.id}`,
          userId: neighbour.id,
          platform: "chesscom",
          externalGameId: `external-${neighbour.id}`,
          dedupeKey: `chesscom:${neighbour.id}`,
          pgn: "1. d4 d5 *",
          source: "chesscom",
          importedAt: FIXTURE_AT,
        },
      ],
    });

    let foreignError: unknown;
    try {
      await callerFor(edgeUser).disconnect({ id: neighbour.connectionId });
    } catch (error) {
      foreignError = error;
    }
    expect(foreignError).toMatchObject({ code: "NOT_FOUND" });

    await page.goto("/connections");
    const ownConnection = page.getByRole("listitem").filter({
      hasText: edgeUser.externalUsername,
    });
    await expect(ownConnection).toBeVisible();
    await ownConnection.getByRole("button", { name: "Disconnect" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "No accounts connected" }),
    ).toBeVisible();

    expect(
      await db.platformConnection.count({ where: { userId: edgeUser.id } }),
    ).toBe(0);
    expect(
      await db.chessProfileSnapshot.count({ where: { userId: edgeUser.id } }),
    ).toBe(1);
    expect(
      await db.importedGame.count({ where: { userId: edgeUser.id } }),
    ).toBe(1);
    expect(
      await db.platformConnection.count({ where: { userId: neighbour.id } }),
    ).toBe(1);
    expect(
      await db.chessProfileSnapshot.count({ where: { userId: neighbour.id } }),
    ).toBe(1);
    expect(
      await db.importedGame.count({ where: { userId: neighbour.id } }),
    ).toBe(1);

    await page.goto("/today");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByText("Connect a chess account", { exact: true }),
    ).toBeVisible();
  } finally {
    await deleteEdgeUser(neighbour);
  }
});

test("an empty internal block persists one skip without learning credit", async ({
  page,
  edgeUser,
}) => {
  const itemId = `empty-${edgeUser.id}`;
  const theme = `no-positions-${edgeUser.id}`;
  await createProgramItem(edgeUser, { itemId, theme });

  await page.goto(`/train/${itemId}`);
  await expect(
    page.getByRole("heading", {
      name: "This block has no positions left to train.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip unavailable block" }).click();
  await expect(page).toHaveURL(/\/today$/);

  const skip = await db.activityEvent.findFirstOrThrow({
    where: { userId: edgeUser.id, programItemId: itemId, type: "skip" },
  });
  expect(skip.requestId).not.toBeNull();
  expect(
    await db.programItem.findUniqueOrThrow({ where: { id: itemId } }),
  ).toMatchObject({
    status: "skipped",
  });
  expect(await db.skillState.count({ where: { userId: edgeUser.id } })).toBe(0);
  expect(
    await db.skillStateSnapshot.count({ where: { userId: edgeUser.id } }),
  ).toBe(0);
  expect(
    await db.scheduleState.count({
      where: { userId: edgeUser.id, itemType: { not: "endgame" } },
    }),
  ).toBe(0);
  expect(await db.rewardEvent.count({ where: { userId: edgeUser.id } })).toBe(
    0,
  );
  expect(await db.adaptationLog.count({ where: { userId: edgeUser.id } })).toBe(
    1,
  );

  await logOutcome(db, edgeUser.id, {
    requestId: skip.requestId!,
    programItemId: itemId,
    type: "skip",
  });
  expect(
    await db.activityEvent.count({
      where: { userId: edgeUser.id, programItemId: itemId, type: "skip" },
    }),
  ).toBe(1);
  expect(await db.adaptationLog.count({ where: { userId: edgeUser.id } })).toBe(
    1,
  );
});

test("manual PGN import is user-scoped and duplicate replay is explicit", async ({
  page,
  edgeUser,
}) => {
  const neighbour = await createEdgeUser("manual-neighbour");
  const pgn = `[Event "Wave 1 Edge"]
[Site "Local"]
[Date "2026.07.18"]
[Round "1"]
[White "Edge Player"]
[Black "Opponent"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1490"]
[TimeControl "600+0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;

  try {
    await page.goto("/analysis");
    await page.getByLabel("Or paste PGN").fill(pgn);
    await page.getByRole("button", { name: "Check games" }).click();
    await expect(page.getByText("Game 1 · 6 plies")).toBeVisible();
    await page.getByLabel("You played").selectOption("w");
    await page.getByRole("button", { name: "Import 1 valid game" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Import finished" }),
    ).toBeVisible();
    await expect(page.getByText(/Imported 1; already present 0/)).toBeVisible();

    await page.getByRole("button", { name: "Import 1 valid game" }).click();
    await expect(page.getByText(/Imported 0; already present 1/)).toBeVisible();

    const imported = await db.importedGame.findMany({
      where: { userId: edgeUser.id, source: "manual" },
    });
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      platform: "manual",
      source: "manual",
      color: "w",
      result: "win",
    });
    expect(
      await db.platformConnection.count({ where: { userId: edgeUser.id } }),
    ).toBe(1);
    expect(
      await db.chessProfileSnapshot.count({ where: { userId: edgeUser.id } }),
    ).toBe(0);
    expect(
      await db.importedGame.count({ where: { userId: neighbour.id } }),
    ).toBe(0);
  } finally {
    await deleteEdgeUser(neighbour);
  }
});

test("a lost outcome response retries the same request with one effect set", async ({
  page,
  edgeUser,
}) => {
  const itemId = `lost-response-${edgeUser.id}`;
  const puzzleId = `puzzle-${edgeUser.id}`;
  const theme = `lost-response-theme-${edgeUser.id}`;
  await createProgramItem(edgeUser, { itemId, theme });
  await db.lichessPuzzle.create({
    data: {
      puzzleId,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      moves: "e2e4 c7c5",
      rating: 1500,
      ratingDeviation: 70,
      popularity: 100,
      nbPlays: 100,
      themes: [theme],
      openingTags: [],
      createdAt: FIXTURE_AT,
    },
  });

  const outcomeRequestIds: (string | null)[] = [];
  await page.route("**/api/trpc/tracker.logOutcome**", async (route) => {
    outcomeRequestIds.push(requestIdIn(route.request().postData()));
    if (outcomeRequestIds.length === 1) {
      const committed = await route.fetch();
      expect(committed.ok()).toBe(true);
      await route.abort("connectionreset");
      return;
    }
    await route.continue();
  });

  await page.goto(`/train/${itemId}`);
  await expect(
    page.getByRole("heading", { name: "Current puzzle" }),
  ).toBeVisible();
  await page.locator('[data-square="c7"]').click();
  await page.locator('[data-square="c5"]').click();
  await expect(page.getByText("Solved", { exact: true })).toBeVisible();
  const retryResult = page.getByRole("button", { name: "Try saving result" });
  await expect(retryResult).toBeVisible();
  await expect
    .poll(() =>
      db.activityEvent.count({
        where: {
          userId: edgeUser.id,
          programItemId: itemId,
          type: "puzzle_attempt",
        },
      }),
    )
    .toBe(1);

  await retryResult.click();
  await expect(retryResult).toHaveCount(0);
  expect(outcomeRequestIds).toHaveLength(2);
  expect(outcomeRequestIds[0]).not.toBeNull();
  expect(outcomeRequestIds[1]).toBe(outcomeRequestIds[0]);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByText("Session complete", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to Today" }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      db.programItem.findUnique({
        where: { id: itemId },
        select: { status: true },
      }),
    )
    .toEqual({ status: "done" });

  expect(
    await db.activityEvent.count({
      where: {
        userId: edgeUser.id,
        programItemId: itemId,
        type: "puzzle_attempt",
      },
    }),
  ).toBe(1);
  expect(
    await db.activityEvent.count({
      where: {
        userId: edgeUser.id,
        programItemId: itemId,
        type: "session_completed",
      },
    }),
  ).toBe(1);
  expect(await db.adaptationLog.count({ where: { userId: edgeUser.id } })).toBe(
    1,
  );
  expect(await db.skillState.count({ where: { userId: edgeUser.id } })).toBe(1);
  expect(
    await db.skillStateSnapshot.count({ where: { userId: edgeUser.id } }),
  ).toBe(1);
  expect(await db.scheduleState.count({ where: { userId: edgeUser.id } })).toBe(
    0,
  );
  expect(await db.rewardEvent.count({ where: { userId: edgeUser.id } })).toBe(
    1,
  );
});

test.afterAll(async () => {
  await db.$disconnect();
});
