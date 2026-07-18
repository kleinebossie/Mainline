import { PrismaClient, type Prisma } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fixedClock } from "@/lib/clock";
import { CURRENT_DATA_USE_NOTICE } from "@/lib/research-consent";
import {
  exportUserData,
  requestAccountDeletion,
  withdrawResearchConsent,
} from "@/server/account";
import {
  USER_DATA_EXPORT_COVERAGE,
  type UserDataExportModel,
} from "@/server/account-export-coverage";
import { retryFailedJob } from "@/server/maintenance";
import {
  exportControlledObservationalResearch,
  pseudonymizeResearchParticipant,
} from "@/server/research";
import { connectionsRouter } from "@/server/routers/connections";

import { requireDisposablePlaywrightDatabaseUrl } from "../setup/database";

const PREFIX = "wave1_privacy_lifecycle";
const METHODOLOGY_VERSION = "research-1.4.0";
const FIXED_AT = new Date("2040-02-02T12:00:00.000Z");
const SNAPSHOT_AT = new Date("2040-02-03T12:00:00.000Z");
const PURGE_AT = new Date("2040-02-04T12:00:00.000Z");
const RESEARCH_FROM = new Date("2040-02-01T00:00:00.000Z");
const RESEARCH_TO = new Date("2040-02-05T00:00:00.000Z");
const RESEARCH_SECRET = "wave1-privacy-research-secret-0123456789abcdef";

const GLOBAL_IDS = {
  puzzle: `${PREFIX}_puzzle`,
  resource: `${PREFIX}_resource`,
  practice: `${PREFIX}_curated_practice`,
  tablebase: "8/8/8/8/8/8/4K3/7k w - - 87 2040",
} as const;

interface PrivacyUserFixture {
  label: "a" | "b";
  userId: string;
  accountId: string;
  sessionId: string;
  connectionToDisconnectId: string;
  activeConnectionId: string;
  snapshotId: string;
  gameId: string;
  analysisId: string;
  assessmentId: string;
  constraintId: string;
  programId: string;
  programItemId: string;
  exposureId: string;
  weeklyFocusId: string;
  credentialSecrets: readonly string[];
  jobKeys: readonly string[];
}

function privacyUser(label: PrivacyUserFixture["label"]): PrivacyUserFixture {
  const userId = `${PREFIX}_user_${label}`;
  const connectionToDisconnectId = `${PREFIX}_disconnect_connection_${label}`;
  const activeConnectionId = `${PREFIX}_active_connection_${label}`;
  return {
    label,
    userId,
    accountId: `${PREFIX}_account_${label}`,
    sessionId: `${PREFIX}_session_${label}`,
    connectionToDisconnectId,
    activeConnectionId,
    snapshotId: `${PREFIX}_snapshot_${label}`,
    gameId: `${PREFIX}_game_${label}`,
    analysisId: `${PREFIX}_analysis_${label}`,
    assessmentId: `${PREFIX}_assessment_${label}`,
    constraintId: `${PREFIX}_constraint_${label}`,
    programId: `${PREFIX}_program_${label}`,
    programItemId: `${PREFIX}_program_item_${label}`,
    exposureId: `${PREFIX}_exposure_${label}`,
    weeklyFocusId: `${PREFIX}_weekly_focus_${label}`,
    credentialSecrets: [
      `${PREFIX}_account_access_secret_${label}`,
      `${PREFIX}_account_refresh_secret_${label}`,
      `${PREFIX}_account_id_secret_${label}`,
      `${PREFIX}_account_session_state_secret_${label}`,
      `${PREFIX}_session_token_secret_${label}`,
      `${PREFIX}_connection_access_secret_${label}`,
      `${PREFIX}_connection_refresh_secret_${label}`,
      `${PREFIX}_invite_secret_${label}`,
    ],
    jobKeys: [
      `${PREFIX}:manual:${userId}:2040-02-02T12:00:00.000Z:${connectionToDisconnectId}`,
      `${PREFIX}:import_sync:daily:2040-02-02:${connectionToDisconnectId}`,
      `${PREFIX}:import_sync:daily:2040-02-02:${activeConnectionId}`,
      `${PREFIX}:manual:${userId}:2040-02-02T13:00:00.000Z:detached_${label}`,
      `${PREFIX}:daily_adaptation:2040-02-02:${userId}`,
      `${PREFIX}:day_missed:2040-02-01:${userId}`,
    ],
  };
}

const USER_A = privacyUser("a");
const USER_B = privacyUser("b");

function generationInput(userId: string) {
  return {
    schemaVersion: 1,
    methodologyVersion: METHODOLOGY_VERSION,
    assembledAt: FIXED_AT.getTime(),
    userId,
    band: "b1200_1600",
    tacticalRating: 1400,
    libraryBand: "b1200_1600",
    constraints: {
      minutesPerDay: 30,
      daysPerWeek: 5,
      goals: [],
      ownedResources: [],
      formatPrefs: {
        formats: ["rapid"],
        preferredVariety: false,
        targetFocus: "online",
      },
      sessionStyle: { depthVsBreadth: "balanced", interleave: true },
      ifThenPlan: null,
    },
    goals: [],
    ownedResources: [],
    latestSkillState: [],
    skillHistory: [],
    dueWork: [],
    activityRecency: {
      lastEventAtByType: {},
      completionsByType: {},
      skipsByType: {},
      durationMinutesByType: {},
      activeDays: 0,
      totalEvents: 0,
    },
    recentSuccessByTrack: {},
    weaknessSignals: [],
    trainingPreferences: {
      preferences: {
        enjoyment: {},
        enjoymentEvidenceCount: {},
        resourceAffinity: {},
        resourceEvidenceCount: {},
        timeFit: {},
        sessionTimeFit: null,
        frictionTags: [],
        evidenceCount: 0,
      },
      userOverride: null,
      resetAt: null,
      updatedAt: FIXED_AT.getTime(),
    },
    weeklyFocus: null,
  };
}

const servedRecommendation = {
  activityId: "calculation_drill",
  activityType: "puzzle",
  dimensionsTargeted: ["calculation"],
  rank: 0,
  score: 4,
  dueEligible: false,
  confidence: "medium",
  evidenceGrade: "B",
  evidenceTier: 2,
  citationKey: "retrieval",
  softened: true,
  allocatedMinutes: 12,
} as const;

async function seedGlobalCatalogs(db: PrismaClient): Promise<void> {
  await db.lichessPuzzle.create({
    data: {
      puzzleId: GLOBAL_IDS.puzzle,
      fen: "8/8/8/8/8/8/4K3/7k w - - 0 1",
      moves: "e2e3",
      rating: 1400,
      ratingDeviation: 80,
      popularity: 50,
      nbPlays: 10,
      themes: ["endgame"],
      openingTags: [],
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await db.resourceRef.create({
    data: {
      id: GLOBAL_IDS.resource,
      type: "lichess_puzzle_theme",
      title: "Wave 1 privacy fixture",
      externalUrl: "https://lichess.org/training/endgame",
      provider: "lichess",
      metadata: { fixture: PREFIX },
      methodologyKey: "calculation_drill",
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await db.tablebaseCache.create({
    data: {
      fen: GLOBAL_IDS.tablebase,
      result: { category: "draw", fixture: PREFIX },
      fetchedAt: FIXED_AT,
    },
  });
  await db.practiceItem.create({
    data: {
      id: GLOBAL_IDS.practice,
      userId: null,
      kind: "endgame",
      fen: "8/8/8/8/8/8/4K3/7k w - - 0 1",
      solutionLine: ["e2e3"],
      sourceRef: `${PREFIX}_curated_source`,
      methodologyKey: "calculation_drill",
      createdAt: FIXED_AT,
    },
  });
}

async function seedUserFixture(
  tx: Prisma.TransactionClient,
  fixture: PrivacyUserFixture,
): Promise<void> {
  const [
    accountAccess,
    accountRefresh,
    accountIdToken,
    accountSessionState,
    sessionToken,
    connectionAccess,
    connectionRefresh,
    inviteCode,
  ] = fixture.credentialSecrets;

  await tx.user.create({
    data: {
      id: fixture.userId,
      name: `${PREFIX}_${fixture.label}`,
      email: `${fixture.label}@wave1-privacy.playwright.invalid`,
      locale: "en",
      betaAccessGrantedAt: FIXED_AT,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.account.create({
    data: {
      id: fixture.accountId,
      userId: fixture.userId,
      type: "oauth",
      provider: `${PREFIX}_${fixture.label}`,
      providerAccountId: `${PREFIX}_provider_${fixture.label}`,
      access_token: accountAccess,
      refresh_token: accountRefresh,
      id_token: accountIdToken,
      session_state: accountSessionState,
    },
  });
  await tx.session.create({
    data: {
      id: fixture.sessionId,
      sessionToken: sessionToken!,
      userId: fixture.userId,
      expires: new Date("2041-01-01T00:00:00.000Z"),
    },
  });
  await tx.platformConnection.createMany({
    data: [
      {
        id: fixture.connectionToDisconnectId,
        userId: fixture.userId,
        platform: "chesscom",
        externalUsername: `${PREFIX}_chesscom_${fixture.label}`,
        status: "active",
        connectedAt: FIXED_AT,
        createdAt: FIXED_AT,
        updatedAt: FIXED_AT,
      },
      {
        id: fixture.activeConnectionId,
        userId: fixture.userId,
        platform: "lichess",
        externalUsername: `${PREFIX}_lichess_${fixture.label}`,
        accessToken: connectionAccess,
        refreshToken: connectionRefresh,
        scopes: "preference:read",
        status: "active",
        connectedAt: FIXED_AT,
        createdAt: FIXED_AT,
        updatedAt: FIXED_AT,
      },
    ],
  });
  await tx.chessProfileSnapshot.create({
    data: {
      id: fixture.snapshotId,
      userId: fixture.userId,
      platform: "lichess",
      capturedAt: SNAPSHOT_AT,
      ratings: { rapid: { rating: 1400, rd: 80, games: 20 } },
      totalGames: 20,
      raw: { fixture: fixture.label },
      createdAt: FIXED_AT,
    },
  });
  await tx.importedGame.create({
    data: {
      id: fixture.gameId,
      userId: fixture.userId,
      platform: "lichess",
      externalGameId: `${PREFIX}_external_game_${fixture.label}`,
      dedupeKey: `${PREFIX}:game:${fixture.label}`,
      pgn: "1. e4 e5 2. Nf3 Nc6 *",
      playedAt: FIXED_AT,
      timeControl: "600+0",
      color: "w",
      result: "draw",
      userRatingAtGame: 1400,
      opponentRating: 1410,
      source: "lichess",
      importedAt: FIXED_AT,
    },
  });
  await tx.analysisResult.create({
    data: {
      id: fixture.analysisId,
      gameId: fixture.gameId,
      engineVersion: "stockfish-fixture",
      depth: 12,
      rawFeatures: { fixture: fixture.label },
      analyzedAt: FIXED_AT,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.assessment.create({
    data: {
      id: fixture.assessmentId,
      userId: fixture.userId,
      completedAt: FIXED_AT,
      calibrationResponses: [{ ratingShown: 1400, correct: true }],
      tacticalRatingEstimate: 1400,
      uncertainty: 100,
      derivedSkillSeed: { calculation: 0.5 },
      methodologyVersion: METHODOLOGY_VERSION,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.constraintSet.create({
    data: {
      id: fixture.constraintId,
      userId: fixture.userId,
      minutesPerDay: 30,
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
      updatedAt: FIXED_AT,
    },
  });
  await tx.program.create({
    data: {
      id: fixture.programId,
      userId: fixture.userId,
      methodologyVersion: METHODOLOGY_VERSION,
      status: "active",
      generationInput: generationInput(fixture.userId),
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.programItem.create({
    data: {
      id: fixture.programItemId,
      programId: fixture.programId,
      date: FIXED_AT,
      orderIndex: 0,
      activityId: "calculation_drill",
      activityType: "puzzle",
      resourceRefId: GLOBAL_IDS.resource,
      params: { targetRating: 1400, count: 1, estMinutes: 12 },
      dimensionsTargeted: ["calculation"],
      rationaleKey: "retrieval",
      rationaleText: "Fixture rationale.",
      evidenceGrade: "B",
      evidenceTier: 2,
      citationKey: "retrieval",
      confidence: "medium",
      soften: false,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.recommendationExposure.create({
    data: {
      id: fixture.exposureId,
      userId: fixture.userId,
      programId: fixture.programId,
      programItemId: fixture.programItemId,
      methodologyVersion: METHODOLOGY_VERSION,
      servedRecommendation,
      eligibleAlternatives: {
        complete: true,
        totalEligibleCount: 1,
        alternatives: [],
      },
      exposedAt: FIXED_AT,
      createdAt: FIXED_AT,
    },
  });
  await tx.activityEvent.create({
    data: {
      id: `${PREFIX}_activity_${fixture.label}`,
      userId: fixture.userId,
      requestId: `${PREFIX}_activity_request_${fixture.label}`,
      programItemId: fixture.programItemId,
      type: "puzzle_attempt",
      occurredAt: FIXED_AT,
      payload: { correct: true, solveTimeMs: 30_000 },
      source: "user",
      createdAt: FIXED_AT,
    },
  });
  await tx.trainingFeedback.create({
    data: {
      id: `${PREFIX}_training_feedback_${fixture.label}`,
      userId: fixture.userId,
      requestId: `${PREFIX}_training_feedback_request_${fixture.label}`,
      programId: fixture.programId,
      programItemId: fixture.programItemId,
      scope: "item",
      source: "always_available",
      relevance: "relevant",
      enjoyment: "enjoyed",
      timeFit: "fits",
      frictionTags: [],
      methodologyVersion: METHODOLOGY_VERSION,
      occurredAt: FIXED_AT,
      createdAt: FIXED_AT,
    },
  });
  await tx.productFeedback.create({
    data: {
      id: `${PREFIX}_product_feedback_${fixture.label}`,
      userId: fixture.userId,
      requestId: `${PREFIX}_product_feedback_request_${fixture.label}`,
      category: "idea",
      message: `Fixture feedback ${fixture.label}`,
      routeContext: "/settings",
      contactAllowed: false,
      methodologyVersion: METHODOLOGY_VERSION,
      appVersion: "wave1-fixture",
      occurredAt: FIXED_AT,
      createdAt: FIXED_AT,
    },
  });
  await tx.trainingFeedbackPrompt.create({
    data: {
      id: `${PREFIX}_training_prompt_${fixture.label}`,
      userId: fixture.userId,
      programId: fixture.programId,
      programItemId: fixture.programItemId,
      promptKey: `${PREFIX}_prompt_${fixture.label}`,
      kind: "novel_activity",
      shownAt: FIXED_AT,
      createdAt: FIXED_AT,
    },
  });
  await tx.skillState.create({
    data: {
      id: `${PREFIX}_skill_${fixture.label}`,
      userId: fixture.userId,
      dimension: "calculation",
      estimate: 0.6,
      uncertainty: 0.2,
      sampleSize: 1,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.skillStateSnapshot.create({
    data: {
      id: `${PREFIX}_skill_snapshot_${fixture.label}`,
      userId: fixture.userId,
      dimension: "calculation",
      estimate: 0.6,
      uncertainty: 0.2,
      sampleSize: 1,
      methodologyVersion: METHODOLOGY_VERSION,
      runAt: FIXED_AT,
      capturedAt: FIXED_AT,
    },
  });
  await tx.scheduleState.create({
    data: {
      id: `${PREFIX}_schedule_${fixture.label}`,
      userId: fixture.userId,
      itemRef: `${PREFIX}_item_${fixture.label}`,
      itemType: "puzzle_theme",
      fsrsState: {
        stability: 1,
        difficulty: 5,
        due: FIXED_AT.toISOString(),
        reps: 1,
        lapses: 0,
        lastReview: FIXED_AT.toISOString(),
      },
      due: FIXED_AT,
      lastGrade: 3,
      source: "drill",
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.practiceItem.create({
    data: {
      id: `${PREFIX}_practice_${fixture.label}`,
      userId: fixture.userId,
      kind: "blunder_drill",
      fen: "8/8/8/8/8/8/4K3/7k w - - 0 1",
      solutionLine: ["e2e3"],
      sourceRef: `${PREFIX}_source_${fixture.label}`,
      methodologyKey: "calculation_drill",
      createdAt: FIXED_AT,
    },
  });
  await tx.adaptationLog.create({
    data: {
      id: `${PREFIX}_adaptation_${fixture.label}`,
      userId: fixture.userId,
      runAt: FIXED_AT,
      trigger: "new_events",
      inputsSnapshot: { fixture: fixture.label },
      decisions: [],
      methodologyVersion: METHODOLOGY_VERSION,
      createdAt: FIXED_AT,
    },
  });
  await tx.rewardEvent.create({
    data: {
      id: `${PREFIX}_reward_${fixture.label}`,
      userId: fixture.userId,
      type: "consistency_grid",
      copyKey: "consistency",
      occurredAt: FIXED_AT,
      payload: { fixture: fixture.label },
      seen: false,
      createdAt: FIXED_AT,
    },
  });
  await tx.notificationPref.create({
    data: {
      id: `${PREFIX}_notification_${fixture.label}`,
      userId: fixture.userId,
      channel: "none",
      cadenceCap: 0,
      enabled: false,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.apiCallBudget.create({
    data: {
      id: `${PREFIX}_budget_${fixture.label}`,
      userId: fixture.userId,
      platform: "manual",
      windowStart: FIXED_AT,
      count: 1,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.trainingPreferenceState.create({
    data: {
      id: `${PREFIX}_preference_${fixture.label}`,
      userId: fixture.userId,
      preferences: { fixture: fixture.label },
      resetAt: null,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.weeklyFocus.create({
    data: {
      id: fixture.weeklyFocusId,
      userId: fixture.userId,
      weekStart: FIXED_AT,
      focusAreas: ["calculation"],
      supportingSignals: [],
      confidence: "medium",
      methodologyVersion: METHODOLOGY_VERSION,
      inputSnapshot: { fixture: fixture.label },
      status: "active",
      rationaleSnapshots: [],
      alternatives: [],
      createdAt: FIXED_AT,
    },
  });
  await tx.weeklyAvailability.create({
    data: {
      id: `${PREFIX}_weekly_availability_${fixture.label}`,
      userId: fixture.userId,
      mode: "flexible",
      preferredWeekdays: [],
      defaultMinutesByDay: {},
      promptResolvedAt: FIXED_AT,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.availabilityOverride.create({
    data: {
      id: `${PREFIX}_availability_override_${fixture.label}`,
      userId: fixture.userId,
      date: FIXED_AT,
      minutes: 30,
      unavailable: false,
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    },
  });
  await tx.programDayForecast.create({
    data: {
      id: `${PREFIX}_forecast_${fixture.label}`,
      userId: fixture.userId,
      weeklyFocusId: fixture.weeklyFocusId,
      date: FIXED_AT,
      status: "materialized",
      plannedBlocks: [],
      expectedMinutes: 30,
      focusLinks: ["calculation"],
      dueReviewPressure: { count: 0 },
      rationaleSnapshots: [],
      methodologyVersion: METHODOLOGY_VERSION,
      inputSnapshot: { fixture: fixture.label },
      createdAt: FIXED_AT,
    },
  });
  await tx.programRevision.create({
    data: {
      id: `${PREFIX}_revision_${fixture.label}`,
      userId: fixture.userId,
      newFocusId: fixture.weeklyFocusId,
      trigger: "explicit_replan",
      changedFields: [],
      gradedDecisions: [],
      methodologyVersion: METHODOLOGY_VERSION,
      occurredAt: FIXED_AT,
      createdAt: FIXED_AT,
    },
  });
  await tx.allowlistEntry.create({
    data: {
      id: `${PREFIX}_allowlist_${fixture.label}`,
      email: `${fixture.label}@wave1-privacy.playwright.invalid`,
      inviteCode: inviteCode,
      usedByUserId: fixture.userId,
      createdAt: FIXED_AT,
    },
  });
  await tx.researchConsent.createMany({
    data: [
      {
        id: `${PREFIX}_research_consent_prior_${fixture.label}`,
        userId: fixture.userId,
        noticeVersion: CURRENT_DATA_USE_NOTICE.id,
        scopes: ["aggregate_observational_training"],
        grantedAt: new Date(FIXED_AT.getTime() - 86_400_000),
        withdrawnAt: new Date(FIXED_AT.getTime() - 43_200_000),
        createdAt: new Date(FIXED_AT.getTime() - 86_400_000),
      },
      {
        id: `${PREFIX}_research_consent_active_${fixture.label}`,
        userId: fixture.userId,
        noticeVersion: CURRENT_DATA_USE_NOTICE.id,
        scopes: ["aggregate_observational_training"],
        grantedAt: FIXED_AT,
        createdAt: FIXED_AT,
      },
    ],
  });
  await tx.jobRun.createMany({
    data: fixture.jobKeys.map((key, index) => ({
      kind: key.includes("import_sync") ? "import_sync" : "fixture_job",
      key,
      status: "success",
      attempt: 1,
      startedAt: new Date(FIXED_AT.getTime() + index),
      finishedAt: new Date(FIXED_AT.getTime() + index + 1),
      createdAt: FIXED_AT,
      updatedAt: FIXED_AT,
    })),
  });
}

type RelationCounter = (db: PrismaClient, userId: string) => Promise<number>;

const DIRECT_RELATION_COUNTS = {
  Account: (db, userId) => db.account.count({ where: { userId } }),
  ActivityEvent: (db, userId) => db.activityEvent.count({ where: { userId } }),
  AdaptationLog: (db, userId) => db.adaptationLog.count({ where: { userId } }),
  AllowlistEntry: (db, userId) =>
    db.allowlistEntry.count({ where: { usedByUserId: userId } }),
  ApiCallBudget: (db, userId) => db.apiCallBudget.count({ where: { userId } }),
  Assessment: (db, userId) => db.assessment.count({ where: { userId } }),
  AvailabilityOverride: (db, userId) =>
    db.availabilityOverride.count({ where: { userId } }),
  ChessProfileSnapshot: (db, userId) =>
    db.chessProfileSnapshot.count({ where: { userId } }),
  ConstraintSet: (db, userId) => db.constraintSet.count({ where: { userId } }),
  ImportedGame: (db, userId) => db.importedGame.count({ where: { userId } }),
  NotificationPref: (db, userId) =>
    db.notificationPref.count({ where: { userId } }),
  PlatformConnection: (db, userId) =>
    db.platformConnection.count({ where: { userId } }),
  PracticeItem: (db, userId) => db.practiceItem.count({ where: { userId } }),
  ProductFeedback: (db, userId) =>
    db.productFeedback.count({ where: { userId } }),
  Program: (db, userId) => db.program.count({ where: { userId } }),
  ProgramDayForecast: (db, userId) =>
    db.programDayForecast.count({ where: { userId } }),
  ProgramRevision: (db, userId) =>
    db.programRevision.count({ where: { userId } }),
  RecommendationExposure: (db, userId) =>
    db.recommendationExposure.count({ where: { userId } }),
  ResearchConsent: (db, userId) =>
    db.researchConsent.count({ where: { userId } }),
  RewardEvent: (db, userId) => db.rewardEvent.count({ where: { userId } }),
  ScheduleState: (db, userId) => db.scheduleState.count({ where: { userId } }),
  Session: (db, userId) => db.session.count({ where: { userId } }),
  SkillState: (db, userId) => db.skillState.count({ where: { userId } }),
  SkillStateSnapshot: (db, userId) =>
    db.skillStateSnapshot.count({ where: { userId } }),
  TrainingFeedback: (db, userId) =>
    db.trainingFeedback.count({ where: { userId } }),
  TrainingFeedbackPrompt: (db, userId) =>
    db.trainingFeedbackPrompt.count({ where: { userId } }),
  TrainingPreferenceState: (db, userId) =>
    db.trainingPreferenceState.count({ where: { userId } }),
  WeeklyAvailability: (db, userId) =>
    db.weeklyAvailability.count({ where: { userId } }),
  WeeklyFocus: (db, userId) => db.weeklyFocus.count({ where: { userId } }),
} satisfies Record<UserDataExportModel, RelationCounter>;

async function relationCounts(db: PrismaClient, userId: string) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(DIRECT_RELATION_COUNTS).map(async ([model, count]) => [
        model,
        await count(db, userId),
      ]),
    ),
  ) as Record<UserDataExportModel, number>;
}

async function globalCatalogSnapshot(db: PrismaClient) {
  const [puzzles, resources, tablebases, practiceItems] = await Promise.all([
    db.lichessPuzzle.findMany({
      where: { puzzleId: GLOBAL_IDS.puzzle },
      orderBy: { puzzleId: "asc" },
    }),
    db.resourceRef.findMany({
      where: { id: GLOBAL_IDS.resource },
      orderBy: { id: "asc" },
    }),
    db.tablebaseCache.findMany({
      where: { fen: GLOBAL_IDS.tablebase },
      orderBy: { fen: "asc" },
    }),
    db.practiceItem.findMany({
      where: { id: GLOBAL_IDS.practice, userId: null },
      orderBy: { id: "asc" },
    }),
  ]);
  return { puzzles, resources, tablebases, practiceItems };
}

async function fixtureJobSnapshot(
  db: PrismaClient,
  fixture: PrivacyUserFixture,
) {
  return db.jobRun.findMany({
    where: { key: { in: [...fixture.jobKeys] } },
    orderBy: { key: "asc" },
  });
}

async function cleanup(db: PrismaClient): Promise<void> {
  const ledgers = await db.accountPurgeLedger.findMany({
    where: { requestedAt: PURGE_AT },
    select: { token: true },
  });
  await db.jobRun.deleteMany({
    where: {
      OR: [
        { key: { startsWith: `${PREFIX}:` } },
        ...ledgers.map(({ token }) => ({ key: `account_purge:${token}` })),
      ],
    },
  });
  await db.user.deleteMany({
    where: { id: { in: [USER_A.userId, USER_B.userId] } },
  });
  await db.accountPurgeLedger.deleteMany({ where: { requestedAt: PURGE_AT } });
  await db.lichessPuzzle.deleteMany({ where: { puzzleId: GLOBAL_IDS.puzzle } });
  await db.resourceRef.deleteMany({ where: { id: GLOBAL_IDS.resource } });
  await db.tablebaseCache.deleteMany({ where: { fen: GLOBAL_IDS.tablebase } });
  await db.practiceItem.deleteMany({ where: { id: GLOBAL_IDS.practice } });
}

test("export, consent withdrawal, disconnect, and stale purge preserve privacy boundaries", async () => {
  test.setTimeout(90_000);
  const db = new PrismaClient({
    datasourceUrl: requireDisposablePlaywrightDatabaseUrl(),
  });

  try {
    await cleanup(db);
    await seedGlobalCatalogs(db);
    await db.$transaction(async (tx) => {
      await seedUserFixture(tx, USER_A);
      await seedUserFixture(tx, USER_B);
    });

    const initialCountsA = await relationCounts(db, USER_A.userId);
    const initialCountsB = await relationCounts(db, USER_B.userId);
    expect(Object.values(initialCountsA).every((count) => count > 0)).toBe(
      true,
    );
    expect(Object.values(initialCountsB).every((count) => count > 0)).toBe(
      true,
    );

    const exportedA = await exportUserData(db, USER_A.userId);
    const exportedB = await exportUserData(db, USER_B.userId);
    const serializedA = JSON.stringify(exportedA);
    expect(serializedA).toContain(USER_A.userId);
    expect(serializedA).not.toContain(USER_B.userId);
    for (const secret of USER_A.credentialSecrets) {
      expect(serializedA).not.toContain(secret);
    }
    expect(exportedA.accounts.map((account) => account.id)).toEqual([
      USER_A.accountId,
    ]);
    expect(exportedA.sessions.map((session) => session.id)).toEqual([
      USER_A.sessionId,
    ]);
    expect(
      exportedA.platformConnections.map((connection) => connection.id).sort(),
    ).toEqual(
      [USER_A.activeConnectionId, USER_A.connectionToDisconnectId].sort(),
    );
    expect(serializedA).not.toContain(USER_B.accountId);
    expect(serializedA).not.toContain(USER_B.sessionId);
    expect(serializedA).not.toContain(USER_B.activeConnectionId);
    expect(serializedA).not.toContain(USER_B.connectionToDisconnectId);
    const exportRecord = exportedA as unknown as Record<string, unknown>;
    for (const coverage of Object.values(USER_DATA_EXPORT_COVERAGE)) {
      const value = exportRecord[coverage.exportPath];
      expect(value, coverage.exportPath).toBeDefined();
      expect(value, coverage.exportPath).not.toBeNull();
      if (Array.isArray(value)) {
        expect(value.length, coverage.exportPath).toBeGreaterThan(0);
      }
    }
    expect(exportedA.importedGames[0]?.analysis?.id).toBe(USER_A.analysisId);
    expect(exportedA.programs[0]?.items[0]?.id).toBe(USER_A.programItemId);
    expect(
      exportedA.researchConsents.map((consent) => consent.withdrawnAt === null),
    ).toEqual([false, true]);

    const globalBefore = await globalCatalogSnapshot(db);
    const bJobsBefore = await fixtureJobSnapshot(db, USER_B);

    const researchBefore = await exportControlledObservationalResearch(db, {
      from: RESEARCH_FROM,
      to: RESEARCH_TO,
      maxRecords: 10,
      secret: RESEARCH_SECRET,
    });
    expect(researchBefore.rows).toHaveLength(2);
    const researchBeforeText = JSON.stringify(researchBefore);
    expect(researchBeforeText).not.toContain(USER_A.userId);
    expect(researchBeforeText).not.toContain(USER_B.userId);
    expect(researchBefore.rows.map((row) => row.participant).sort()).toEqual(
      [
        pseudonymizeResearchParticipant(USER_A.userId, RESEARCH_SECRET),
        pseudonymizeResearchParticipant(USER_B.userId, RESEARCH_SECRET),
      ].sort(),
    );

    await withdrawResearchConsent(db, USER_A.userId, PURGE_AT);
    const researchAfterWithdrawal = await exportControlledObservationalResearch(
      db,
      {
        from: RESEARCH_FROM,
        to: RESEARCH_TO,
        maxRecords: 10,
        secret: RESEARCH_SECRET,
      },
    );
    expect(researchAfterWithdrawal.rows).toHaveLength(1);
    expect(researchAfterWithdrawal.rows[0]?.participant).toBe(
      pseudonymizeResearchParticipant(USER_B.userId, RESEARCH_SECRET),
    );
    expect(researchAfterWithdrawal.metadata.excludedForConsent).toBe(1);
    expect(await db.user.count({ where: { id: USER_A.userId } })).toBe(1);
    expect(await relationCounts(db, USER_A.userId)).toEqual(initialCountsA);

    const historiesBeforeDisconnect = await Promise.all([
      db.importedGame.count({ where: { userId: USER_A.userId } }),
      db.chessProfileSnapshot.count({ where: { userId: USER_A.userId } }),
    ]);
    const connectionCaller = connectionsRouter.createCaller({
      session: {
        user: { id: USER_A.userId },
        expires: "2041-01-01T00:00:00.000Z",
      },
      prisma: db,
    } as never);
    await expect(
      connectionCaller.disconnect({ id: USER_A.connectionToDisconnectId }),
    ).resolves.toEqual({ id: USER_A.connectionToDisconnectId });
    expect(
      await db.jobRun.count({
        where: { key: { endsWith: `:${USER_A.connectionToDisconnectId}` } },
      }),
    ).toBe(0);
    expect(
      await db.platformConnection.count({
        where: { id: USER_A.connectionToDisconnectId },
      }),
    ).toBe(0);
    expect(
      await Promise.all([
        db.importedGame.count({ where: { userId: USER_A.userId } }),
        db.chessProfileSnapshot.count({ where: { userId: USER_A.userId } }),
      ]),
    ).toEqual(historiesBeforeDisconnect);
    expect(
      await db.platformConnection.count({
        where: { id: USER_A.activeConnectionId },
      }),
    ).toBe(1);

    const token = await requestAccountDeletion(
      db,
      USER_A.userId,
      fixedClock(PURGE_AT.getTime()),
    );
    expect(token).not.toContain(USER_A.userId);
    const purgeJob = await db.jobRun.update({
      where: { key: `account_purge:${token}` },
      data: {
        status: "running",
        attempt: 3,
        startedAt: new Date(PURGE_AT.getTime() - 60_000),
        lockedUntil: new Date(PURGE_AT.getTime() - 1),
        error: "Job failed. Retry is safe.",
        errorCode: "fixture_failure",
      },
      select: { id: true },
    });
    await expect(
      retryFailedJob(db, purgeJob.id, fixedClock(PURGE_AT.getTime())),
    ).resolves.toMatchObject({ state: "completed", kind: "account_purge" });

    expect(
      await db.user.findUnique({ where: { id: USER_A.userId } }),
    ).toBeNull();
    expect(
      Object.values(await relationCounts(db, USER_A.userId)).every(
        (count) => count === 0,
      ),
    ).toBe(true);
    expect(
      await db.analysisResult.count({ where: { id: USER_A.analysisId } }),
    ).toBe(0);
    expect(
      await db.programItem.count({ where: { id: USER_A.programItemId } }),
    ).toBe(0);
    expect(
      await db.jobRun.count({
        where: {
          OR: [
            { key: { contains: USER_A.userId } },
            { key: { contains: USER_A.connectionToDisconnectId } },
            { key: { contains: USER_A.activeConnectionId } },
            { key: `account_purge:${token}` },
          ],
        },
      }),
    ).toBe(0);
    const ledger = await db.accountPurgeLedger.findUnique({
      where: { token },
    });
    expect(ledger).toMatchObject({ token, requestedAt: PURGE_AT });
    expect(ledger?.completedAt).toEqual(PURGE_AT);
    expect(JSON.stringify(ledger)).not.toContain(USER_A.userId);
    expect(
      await db.accountPurgeLedger.count({ where: { requestedAt: PURGE_AT } }),
    ).toBe(1);

    const exportedBAfter = await exportUserData(db, USER_B.userId);
    expect(JSON.stringify(exportedBAfter)).toBe(JSON.stringify(exportedB));
    expect(await fixtureJobSnapshot(db, USER_B)).toEqual(bJobsBefore);
    expect(await relationCounts(db, USER_B.userId)).toEqual(initialCountsB);
    expect(await globalCatalogSnapshot(db)).toEqual(globalBefore);
  } finally {
    await cleanup(db);
    await db.$disconnect();
  }
});
