import { PrismaClient, type Prisma } from "@prisma/client";

import { expect, test } from "../fixtures/authenticated";
import { requireDisposablePlaywrightDatabaseUrl } from "../setup/database";
import { resetCoreLoopFixture } from "../setup/global";

const INITIAL_MINUTES = 45;
const REPLAN_MINUTES = 15;
const PUZZLE_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PUZZLE_MOVES = "e2e4 e7e5";

function asRecord(value: Prisma.JsonValue): Prisma.JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Expected a persisted JSON object.");
  }
  return value;
}

function expectGradedRationaleSnapshots(value: Prisma.JsonValue): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Expected at least one graded rationale snapshot.");
  }
  for (const snapshot of value) {
    const row = asRecord(snapshot);
    expect(row.text).toEqual(expect.any(String));
    expect((row.text as string).length).toBeGreaterThan(0);
    expect(["A", "B", "C", "D"]).toContain(row.grade);
    expect([1, 2]).toContain(row.tier);
    expect(row.citationKey).toEqual(expect.any(String));
    expect((row.citationKey as string).length).toBeGreaterThan(0);
    expect(row.soften).toEqual(expect.any(Boolean));
  }
}

function programSnapshot(program: {
  methodologyVersion: string;
  generationInput: Prisma.JsonValue;
  createdAt: Date;
}) {
  return {
    methodologyVersion: program.methodologyVersion,
    generationInput: program.generationInput,
    createdAt: program.createdAt.toISOString(),
  };
}

function itemSnapshot(item: {
  date: Date;
  orderIndex: number;
  activityId: string;
  activityType: string;
  resourceRefId: string | null;
  params: Prisma.JsonValue;
  dimensionsTargeted: string[];
  rationaleKey: string;
  rationaleText: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  confidence: string;
  soften: boolean;
  status: string;
  createdAt: Date;
}) {
  return {
    date: item.date.toISOString(),
    orderIndex: item.orderIndex,
    activityId: item.activityId,
    activityType: item.activityType,
    resourceRefId: item.resourceRefId,
    params: item.params,
    dimensionsTargeted: item.dimensionsTargeted,
    rationaleKey: item.rationaleKey,
    rationaleText: item.rationaleText,
    evidenceGrade: item.evidenceGrade,
    evidenceTier: item.evidenceTier,
    citationKey: item.citationKey,
    confidence: item.confidence,
    soften: item.soften,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
  };
}

function eventSnapshot(event: {
  requestId: string | null;
  programItemId: string | null;
  type: string;
  occurredAt: Date;
  payload: Prisma.JsonValue;
  source: string;
  createdAt: Date;
}) {
  return {
    requestId: event.requestId,
    programItemId: event.programItemId,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    payload: event.payload,
    source: event.source,
    createdAt: event.createdAt.toISOString(),
  };
}

function exposureSnapshot(exposure: {
  programId: string;
  programItemId: string;
  methodologyVersion: string;
  servedRecommendation: Prisma.JsonValue;
  eligibleAlternatives: Prisma.JsonValue;
  exposedAt: Date;
  createdAt: Date;
}) {
  return {
    programId: exposure.programId,
    programItemId: exposure.programItemId,
    methodologyVersion: exposure.methodologyVersion,
    servedRecommendation: exposure.servedRecommendation,
    eligibleAlternatives: exposure.eligibleAlternatives,
    exposedAt: exposure.exposedAt.toISOString(),
    createdAt: exposure.createdAt.toISOString(),
  };
}

function focusSnapshot(focus: {
  id: string;
  userId: string;
  weekStart: Date;
  focusAreas: string[];
  supportingSignals: Prisma.JsonValue;
  confidence: string;
  methodologyVersion: string;
  inputSnapshot: Prisma.JsonValue;
  rationaleSnapshots: Prisma.JsonValue;
  alternatives: Prisma.JsonValue;
  selectedAlternative: string | null;
  revisionTrigger: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: focus.id,
    userId: focus.userId,
    weekStart: focus.weekStart.toISOString(),
    focusAreas: focus.focusAreas,
    supportingSignals: focus.supportingSignals,
    confidence: focus.confidence,
    methodologyVersion: focus.methodologyVersion,
    inputSnapshot: focus.inputSnapshot,
    rationaleSnapshots: focus.rationaleSnapshots,
    alternatives: focus.alternatives,
    selectedAlternative: focus.selectedAlternative,
    revisionTrigger: focus.revisionTrigger,
    createdAt: focus.createdAt.toISOString(),
  };
}

function forecastSnapshot(forecast: {
  id: string;
  userId: string;
  weeklyFocusId: string;
  date: Date;
  plannedBlocks: Prisma.JsonValue;
  expectedMinutes: number;
  focusLinks: string[];
  dueReviewPressure: Prisma.JsonValue;
  rationaleSnapshots: Prisma.JsonValue;
  methodologyVersion: string;
  inputSnapshot: Prisma.JsonValue;
  status: string;
  createdAt: Date;
}) {
  return {
    id: forecast.id,
    userId: forecast.userId,
    weeklyFocusId: forecast.weeklyFocusId,
    date: forecast.date.toISOString(),
    plannedBlocks: forecast.plannedBlocks,
    expectedMinutes: forecast.expectedMinutes,
    focusLinks: forecast.focusLinks,
    dueReviewPressure: forecast.dueReviewPressure,
    rationaleSnapshots: forecast.rationaleSnapshots,
    methodologyVersion: forecast.methodologyVersion,
    inputSnapshot: forecast.inputSnapshot,
    createdAt: forecast.createdAt.toISOString(),
  };
}

function revisionSnapshot(revision: {
  id: string;
  userId: string;
  previousFocusId: string | null;
  newFocusId: string | null;
  previousForecastId: string | null;
  newForecastId: string | null;
  trigger: string;
  changedFields: Prisma.JsonValue;
  gradedDecisions: Prisma.JsonValue;
  methodologyVersion: string;
  occurredAt: Date;
  createdAt: Date;
}) {
  return {
    ...revision,
    occurredAt: revision.occurredAt.toISOString(),
    createdAt: revision.createdAt.toISOString(),
  };
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  const db = new PrismaClient({
    datasourceUrl: requireDisposablePlaywrightDatabaseUrl(),
  });
  try {
    await resetCoreLoopFixture(db);
  } finally {
    await db.$disconnect();
  }
});

test("normal core loop persists outcomes, adaptation, history, replan, and feedback", async ({
  coreLoopPage,
  coreLoopUser,
}) => {
  const db = new PrismaClient({
    datasourceUrl: requireDisposablePlaywrightDatabaseUrl(),
  });

  try {
    const assessment = await db.assessment.findUniqueOrThrow({
      where: { userId: coreLoopUser.id },
    });
    expect(assessment.completedAt).not.toBeNull();
    expect(Array.isArray(assessment.calibrationResponses)).toBe(true);
    expect(
      (assessment.calibrationResponses as Prisma.JsonArray).length,
    ).toBeGreaterThan(0);
    expect(Array.isArray(assessment.derivedSkillSeed)).toBe(true);
    expect(
      (assessment.derivedSkillSeed as Prisma.JsonArray).length,
    ).toBeGreaterThan(0);
    expect(assessment.tacticalRatingEstimate).not.toBeNull();
    expect(assessment.uncertainty).not.toBeNull();
    await expect(
      db.constraintSet.count({ where: { userId: coreLoopUser.id } }),
    ).resolves.toBe(0);
    await expect(
      db.program.count({ where: { userId: coreLoopUser.id } }),
    ).resolves.toBe(0);

    await coreLoopPage.goto("/onboarding");
    await expect(
      coreLoopPage.getByRole("heading", { name: "Set up your training" }),
    ).toBeVisible();
    await expect(coreLoopPage.getByText("2 of 5 steps done")).toBeVisible();
    await expect(
      coreLoopPage.getByText("2 of 3 required steps done"),
    ).toBeVisible();
    const constraintsStep = coreLoopPage.getByRole("listitem").filter({
      hasText: "Your time, goals & formats",
    });
    await expect(constraintsStep).toContainText("Start");
    await constraintsStep.getByRole("link", { name: "Start" }).click();

    await expect(coreLoopPage).toHaveURL(/\/onboarding\/constraints$/);
    await coreLoopPage
      .getByLabel(/Minutes per day/)
      .fill(String(INITIAL_MINUTES));
    await coreLoopPage.getByLabel(/Days per week/).fill("6");
    await coreLoopPage.getByLabel("Raise my rating").check();
    await coreLoopPage.getByLabel("Sharpen tactics").check();
    await coreLoopPage.getByLabel("rapid", { exact: true }).check();
    await coreLoopPage.getByLabel("If-then cue").fill("finishing breakfast");
    await coreLoopPage
      .getByLabel("If-then plan")
      .fill("open my Mainline session");
    await coreLoopPage
      .getByRole("button", { name: "Save constraints" })
      .click();
    await expect(
      coreLoopPage.getByText(
        "Saved. Your next session will use these settings.",
      ),
    ).toBeVisible();

    const savedConstraints = await db.constraintSet.findFirstOrThrow({
      where: { userId: coreLoopUser.id, isCurrent: true },
    });
    expect(savedConstraints).toMatchObject({
      userId: coreLoopUser.id,
      minutesPerDay: INITIAL_MINUTES,
      daysPerWeek: 6,
      isCurrent: true,
      version: 1,
    });
    expect(savedConstraints.goals).toEqual([
      { kind: "rating", label: "Raise my rating" },
      { kind: "tactics", label: "Sharpen tactics" },
    ]);
    expect(savedConstraints.formatPrefs).toEqual({
      formats: ["rapid"],
      preferredVariety: false,
      targetFocus: "online",
    });
    expect(savedConstraints.ifThenPlan).toEqual({
      cue: "finishing breakfast",
      plan: "open my Mainline session",
    });

    await coreLoopPage.getByRole("link", { name: /Continue/ }).click();
    await expect(coreLoopPage).toHaveURL(/\/onboarding\/reveal$/);
    await expect(
      coreLoopPage.getByText("What your games reveal", { exact: true }),
    ).toBeVisible();
    await expect(
      coreLoopPage.getByText(/No analysed games yet, so we won't guess/),
    ).toBeVisible();
    await expect(
      db.importedGame.count({ where: { userId: coreLoopUser.id } }),
    ).resolves.toBe(0);
    const revealedUser = await db.user.findUniqueOrThrow({
      where: { id: coreLoopUser.id },
      select: { setupRevealSeenAt: true },
    });
    expect(revealedUser.setupRevealSeenAt).not.toBeNull();

    await coreLoopPage
      .getByRole("button", { name: /Build my first session/ })
      .click();
    await expect(coreLoopPage).toHaveURL(/\/today$/);
    await expect(
      coreLoopPage.getByRole("heading", { name: "Today" }),
    ).toBeVisible();

    await expect
      .poll(
        async () =>
          (
            await db.program.findFirst({
              where: { userId: coreLoopUser.id, status: "active" },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: { id: true },
            })
          )?.id ?? null,
        { message: "the generated core-loop program to persist" },
      )
      .not.toBeNull();
    const initialProgram = await db.program.findFirstOrThrow({
      where: { userId: coreLoopUser.id, status: "active" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { items: { orderBy: { orderIndex: "asc" } } },
    });
    expect(initialProgram.userId).toBe(coreLoopUser.id);
    expect(initialProgram.items.length).toBeGreaterThan(0);
    const initialInput = asRecord(initialProgram.generationInput);
    expect(initialInput).toMatchObject({
      userId: coreLoopUser.id,
      constraints: { minutesPerDay: INITIAL_MINUTES },
      weaknessSignals: [],
      weeklyFocus: { confidence: "insufficient" },
    });

    const puzzleItem = initialProgram.items.find(
      (item) => item.activityType === "puzzle_theme",
    );
    if (!puzzleItem) {
      throw new Error("The generated session did not contain a puzzle block.");
    }
    const puzzleParams = asRecord(puzzleItem.params);
    const targetRating = puzzleParams.targetRating;
    const theme = puzzleParams.theme;
    if (typeof targetRating !== "number") {
      throw new Error(
        "The generated puzzle block has no numeric rating target.",
      );
    }
    if (theme !== null && typeof theme !== "string") {
      throw new Error("The generated puzzle block has an invalid theme.");
    }
    await db.lichessPuzzle.create({
      data: {
        puzzleId: coreLoopUser.puzzleId,
        fen: PUZZLE_FEN,
        moves: PUZZLE_MOVES,
        rating: targetRating,
        ratingDeviation: 50,
        popularity: 100,
        nbPlays: 100,
        themes: [theme === null || theme === "mix" ? "fork" : theme],
        openingTags: [],
      },
    });

    const initialProgramPayload = programSnapshot(initialProgram);
    const initialItemBeforeOutcome = itemSnapshot(puzzleItem);
    const exposureBeforeOutcome =
      await db.recommendationExposure.findUniqueOrThrow({
        where: { programItemId: puzzleItem.id },
      });
    expect(exposureBeforeOutcome.userId).toBe(coreLoopUser.id);
    const initialExposurePayload = exposureSnapshot(exposureBeforeOutcome);
    const initialFocus = await db.weeklyFocus.findFirstOrThrow({
      where: { userId: coreLoopUser.id, status: "active" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    expect(initialFocus.confidence).toBe("insufficient");
    expectGradedRationaleSnapshots(initialFocus.rationaleSnapshots);
    const initialFocusPayload = focusSnapshot(initialFocus);
    const initialForecasts = await db.programDayForecast.findMany({
      where: { userId: coreLoopUser.id },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    expect(initialForecasts).toHaveLength(7);
    for (const forecast of initialForecasts) {
      expectGradedRationaleSnapshots(forecast.rationaleSnapshots);
    }
    const initialForecastPayloads = initialForecasts.map(forecastSnapshot);

    await coreLoopPage.locator(`a[href="/train/${puzzleItem.id}"]`).click();
    await expect(coreLoopPage).toHaveURL(
      new RegExp(`/train/${puzzleItem.id}$`),
    );
    await expect(
      coreLoopPage.getByRole("heading", { name: "Current puzzle" }),
    ).toBeVisible();
    await coreLoopPage.locator("#interactive-board-square-e7").click();
    await coreLoopPage.locator("#interactive-board-square-e5").click();
    await expect(
      coreLoopPage.getByText("Solved", { exact: true }),
    ).toBeVisible();
    const continueButton = coreLoopPage.getByRole("button", {
      name: "Continue",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(
      coreLoopPage.getByText("Session complete", { exact: true }),
    ).toBeVisible();
    const backToToday = coreLoopPage.getByRole("button", {
      name: "Back to Today",
    });
    await expect(backToToday).toBeEnabled();
    await backToToday.click();
    await expect(coreLoopPage).toHaveURL(/\/today$/);
    await expect(
      coreLoopPage.getByText(/1 done, 0 skipped, \d+ remaining/),
    ).toBeVisible();

    await expect
      .poll(
        async () =>
          db.programItem
            .findUnique({ where: { id: puzzleItem.id } })
            .then((item) => item?.status),
        { message: "the completed puzzle block status" },
      )
      .toBe("done");
    const outcome = await db.activityEvent.findFirstOrThrow({
      where: {
        userId: coreLoopUser.id,
        programItemId: puzzleItem.id,
        type: "puzzle_attempt",
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    expect(outcome.userId).toBe(coreLoopUser.id);
    expect(outcome.payload).toMatchObject({
      correct: true,
      puzzleId: coreLoopUser.puzzleId,
    });
    expect(asRecord(outcome.payload).solveTimeMs).toEqual(expect.any(Number));
    const completionEvent = await db.activityEvent.findFirstOrThrow({
      where: {
        userId: coreLoopUser.id,
        programItemId: puzzleItem.id,
        type: "session_completed",
      },
    });
    expect(completionEvent.userId).toBe(coreLoopUser.id);

    const adaptation = await db.adaptationLog.findFirstOrThrow({
      where: { userId: coreLoopUser.id, trigger: "new_events" },
      orderBy: [{ runAt: "desc" }, { id: "desc" }],
    });
    expect(adaptation.userId).toBe(coreLoopUser.id);
    expect(adaptation.methodologyVersion).toBe(
      initialProgram.methodologyVersion,
    );
    expect(adaptation.inputsSnapshot).toMatchObject({
      event: {
        type: "puzzle_attempt",
        itemRef: coreLoopUser.puzzleId,
        itemType: "puzzle",
        correct: true,
      },
    });
    expect(Array.isArray(adaptation.decisions)).toBe(true);
    expect((adaptation.decisions as Prisma.JsonArray).length).toBeGreaterThan(
      0,
    );
    const skillStates = await db.skillState.findMany({
      where: { userId: coreLoopUser.id },
      orderBy: { dimension: "asc" },
    });
    expect(skillStates.length).toBeGreaterThan(0);
    expect(skillStates.every((state) => state.userId === coreLoopUser.id)).toBe(
      true,
    );
    expect(skillStates.every((state) => state.sampleSize === 1)).toBe(true);
    await expect(
      db.skillStateSnapshot.count({ where: { userId: coreLoopUser.id } }),
    ).resolves.toBe(skillStates.length);

    const completedItemBeforeReplan = await db.programItem.findUniqueOrThrow({
      where: { id: puzzleItem.id },
    });
    const outcomeBeforeReplan = await db.activityEvent.findUniqueOrThrow({
      where: { id: outcome.id },
    });
    const completedItemPayload = itemSnapshot(completedItemBeforeReplan);
    const outcomePayload = eventSnapshot(outcomeBeforeReplan);

    const timeInput = coreLoopPage.getByLabel(
      "How much time do you have today?",
    );
    await expect(timeInput).toHaveValue(String(INITIAL_MINUTES));
    await timeInput.fill(String(REPLAN_MINUTES));
    await coreLoopPage.getByRole("button", { name: "Update plan" }).click();
    await expect(
      coreLoopPage.getByText("Plan updated", { exact: true }),
    ).toBeVisible();

    await expect
      .poll(
        async () =>
          (
            await db.program.findFirst({
              where: { userId: coreLoopUser.id, status: "active" },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: { id: true },
            })
          )?.id ?? null,
        { message: "the replacement program to become active" },
      )
      .not.toBe(initialProgram.id);
    const replannedProgram = await db.program.findFirstOrThrow({
      where: { userId: coreLoopUser.id, status: "active" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { items: { orderBy: { orderIndex: "asc" } } },
    });
    expect(replannedProgram.userId).toBe(coreLoopUser.id);
    expect(replannedProgram.id).not.toBe(initialProgram.id);
    expect(asRecord(replannedProgram.generationInput)).toMatchObject({
      userId: coreLoopUser.id,
      constraints: { minutesPerDay: REPLAN_MINUTES },
      latestSkillState: expect.arrayContaining([
        expect.objectContaining({ sampleSize: 1 }),
      ]),
    });
    const constraintHistory = await db.constraintSet.findMany({
      where: { userId: coreLoopUser.id },
      orderBy: { version: "asc" },
    });
    expect(
      constraintHistory.map((row) => ({
        minutesPerDay: row.minutesPerDay,
        isCurrent: row.isCurrent,
        version: row.version,
      })),
    ).toEqual([
      { minutesPerDay: INITIAL_MINUTES, isCurrent: false, version: 1 },
      { minutesPerDay: REPLAN_MINUTES, isCurrent: true, version: 2 },
    ]);
    const revision = await db.programRevision.findFirstOrThrow({
      where: { userId: coreLoopUser.id, trigger: "explicit_replan" },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    });
    expect(revision.userId).toBe(coreLoopUser.id);
    expect(revision.previousForecastId).not.toBeNull();
    expect(revision.newForecastId).not.toBeNull();
    expect(revision.changedFields).toEqual(
      expect.arrayContaining(["expectedMinutes"]),
    );
    expectGradedRationaleSnapshots(revision.gradedDecisions);
    const revisionPayload = revisionSnapshot(revision);

    const historicalProgram = await db.program.findUniqueOrThrow({
      where: { id: initialProgram.id },
    });
    const historicalItem = await db.programItem.findUniqueOrThrow({
      where: { id: puzzleItem.id },
    });
    const historicalOutcome = await db.activityEvent.findUniqueOrThrow({
      where: { id: outcome.id },
    });
    const historicalExposure =
      await db.recommendationExposure.findUniqueOrThrow({
        where: { programItemId: puzzleItem.id },
      });
    expect(historicalProgram.status).toBe("superseded");
    expect(historicalProgram.userId).toBe(coreLoopUser.id);
    expect(programSnapshot(historicalProgram)).toEqual(initialProgramPayload);
    expect(itemSnapshot(historicalItem)).toEqual(completedItemPayload);
    expect(eventSnapshot(historicalOutcome)).toEqual(outcomePayload);
    expect(exposureSnapshot(historicalExposure)).toEqual(
      initialExposurePayload,
    );
    expect(
      focusSnapshot(
        await db.weeklyFocus.findUniqueOrThrow({
          where: { id: initialFocus.id },
        }),
      ),
    ).toEqual(initialFocusPayload);
    expect(
      (
        await Promise.all(
          initialForecasts.map((forecast) =>
            db.programDayForecast.findUniqueOrThrow({
              where: { id: forecast.id },
            }),
          ),
        )
      ).map(forecastSnapshot),
    ).toEqual(initialForecastPayloads);
    expect(initialItemBeforeOutcome.status).toBe("pending");
    expect(completedItemPayload.status).toBe("done");
    expect({ ...completedItemPayload, status: "pending" }).toEqual(
      initialItemBeforeOutcome,
    );

    const history = coreLoopPage.locator("section").filter({
      has: coreLoopPage.getByRole("heading", { name: "History" }),
    });
    const historyDay = history.locator("summary").filter({
      hasText: "2 plan versions",
    });
    await expect(historyDay).toBeVisible();
    await historyDay.click();
    await expect(
      history.getByText("Earlier plan", { exact: true }),
    ).toBeVisible();

    const behavioralCountsBeforeFeedback = {
      events: await db.activityEvent.count({
        where: { userId: coreLoopUser.id },
      }),
      adaptationLogs: await db.adaptationLog.count({
        where: { userId: coreLoopUser.id },
      }),
      skillSnapshots: await db.skillStateSnapshot.count({
        where: { userId: coreLoopUser.id },
      }),
    };
    await coreLoopPage.goto(
      `/settings?programItemId=${encodeURIComponent(puzzleItem.id)}&source=contextual#feedback`,
    );
    const feedbackPanel = coreLoopPage.locator("#training-fit");
    await expect(
      feedbackPanel.getByRole("heading", {
        name: "Tell us how delivery fit your life",
      }),
    ).toBeVisible();
    await expect(feedbackPanel.getByLabel("Training block")).toHaveValue(
      puzzleItem.id,
    );
    await feedbackPanel.getByLabel("Felt relevant").selectOption("relevant");
    await feedbackPanel.getByLabel("Enjoyment").selectOption("enjoyed");
    await feedbackPanel.getByLabel("Time fit").selectOption("fits");
    await feedbackPanel
      .getByLabel("Anything else? Optional")
      .fill("The generated puzzle fit this session.");
    await feedbackPanel
      .getByRole("button", { name: "Save training feedback" })
      .click();
    await expect(
      feedbackPanel.getByText(
        "Training feedback saved. The prescription itself was not weakened.",
      ),
    ).toBeVisible();

    const feedback = await db.trainingFeedback.findFirstOrThrow({
      where: { userId: coreLoopUser.id, programItemId: puzzleItem.id },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    });
    expect(feedback).toMatchObject({
      userId: coreLoopUser.id,
      programId: initialProgram.id,
      programItemId: puzzleItem.id,
      scope: "item",
      source: "contextual",
      relevance: "relevant",
      enjoyment: "enjoyed",
      timeFit: "fits",
      frictionTags: [],
      comment: "The generated puzzle fit this session.",
    });
    const preferenceState = await db.trainingPreferenceState.findUniqueOrThrow({
      where: { userId: coreLoopUser.id },
    });
    expect(preferenceState.userId).toBe(coreLoopUser.id);
    expect(asRecord(preferenceState.preferences).evidenceCount).toBe(1);
    await expect(
      Promise.all([
        db.activityEvent.count({ where: { userId: coreLoopUser.id } }),
        db.adaptationLog.count({ where: { userId: coreLoopUser.id } }),
        db.skillStateSnapshot.count({ where: { userId: coreLoopUser.id } }),
      ]),
    ).resolves.toEqual([
      behavioralCountsBeforeFeedback.events,
      behavioralCountsBeforeFeedback.adaptationLogs,
      behavioralCountsBeforeFeedback.skillSnapshots,
    ]);

    const finalProgram = await db.program.findUniqueOrThrow({
      where: { id: initialProgram.id },
    });
    const finalItem = await db.programItem.findUniqueOrThrow({
      where: { id: puzzleItem.id },
    });
    const finalOutcome = await db.activityEvent.findUniqueOrThrow({
      where: { id: outcome.id },
    });
    expect(programSnapshot(finalProgram)).toEqual(initialProgramPayload);
    expect(itemSnapshot(finalItem)).toEqual(completedItemPayload);
    expect(eventSnapshot(finalOutcome)).toEqual(outcomePayload);
    expect(
      focusSnapshot(
        await db.weeklyFocus.findUniqueOrThrow({
          where: { id: initialFocus.id },
        }),
      ),
    ).toEqual(initialFocusPayload);
    expect(
      (
        await Promise.all(
          initialForecasts.map((forecast) =>
            db.programDayForecast.findUniqueOrThrow({
              where: { id: forecast.id },
            }),
          ),
        )
      ).map(forecastSnapshot),
    ).toEqual(initialForecastPayloads);
    expect(
      revisionSnapshot(
        await db.programRevision.findUniqueOrThrow({
          where: { id: revision.id },
        }),
      ),
    ).toEqual(revisionPayload);
  } finally {
    await db.$disconnect();
  }
});
