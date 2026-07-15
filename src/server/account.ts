import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import {
  CURRENT_DATA_USE_NOTICE,
  hasCurrentResearchConsent,
  type ResearchConsentScope,
} from "@/lib/research-consent";
import { systemClock, type Clock } from "@/lib/clock";
import { runJob } from "@/server/jobs";

export const ACCOUNT_PURGE_JOB_KIND = "account_purge";
const RESEARCH_SCOPE: ResearchConsentScope = "aggregate_observational_training";

export class StaleDataUseNoticeError extends Error {
  override name = "StaleDataUseNoticeError";
}

const analysisExportSelect = {
  id: true,
  gameId: true,
  engineVersion: true,
  depth: true,
  rawFeatures: true,
  analyzedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
const programItemExportSelect = {
  id: true,
  programId: true,
  date: true,
  orderIndex: true,
  activityId: true,
  activityType: true,
  resourceRefId: true,
  params: true,
  dimensionsTargeted: true,
  rationaleKey: true,
  rationaleText: true,
  evidenceGrade: true,
  evidenceTier: true,
  citationKey: true,
  confidence: true,
  soften: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Safe, versioned portable export. Credential and global catalog fields are explicit exclusions. */
export async function exportUserData(db: PrismaClient, userId: string) {
  // Keep these queries sequential. User-triggered exports favor completeness over
  // latency, and bounded session pools can reject this full relation set if it fans out.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      locale: true,
      role: true,
      patronStatus: true,
      primaryPlatform: true,
      betaAccessGrantedAt: true,
      setupRevealSeenAt: true,
      deletedAt: true,
      deletionRequestedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const accounts = await db.account.findMany({
    where: { userId },
    select: {
      id: true,
      type: true,
      provider: true,
      providerAccountId: true,
      expires_at: true,
      token_type: true,
      scope: true,
    },
  });
  const sessions = await db.session.findMany({
    where: { userId },
    select: { id: true, expires: true },
  });
  const connections = await db.platformConnection.findMany({
    where: { userId },
    select: {
      id: true,
      platform: true,
      externalUsername: true,
      scopes: true,
      status: true,
      connectedAt: true,
      lastSyncedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const snapshots = await db.chessProfileSnapshot.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      platform: true,
      capturedAt: true,
      ratings: true,
      totalGames: true,
      raw: true,
      createdAt: true,
    },
  });
  const games = await db.importedGame.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      platform: true,
      externalGameId: true,
      dedupeKey: true,
      pgn: true,
      playedAt: true,
      timeControl: true,
      color: true,
      result: true,
      userRatingAtGame: true,
      opponentRating: true,
      eco: true,
      opening: true,
      source: true,
      importedAt: true,
      analysis: { select: analysisExportSelect },
    },
  });
  const assessment = await db.assessment.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      completedAt: true,
      calibrationResponses: true,
      tacticalRatingEstimate: true,
      uncertainty: true,
      derivedSkillSeed: true,
      methodologyVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const constraintSets = await db.constraintSet.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      minutesPerDay: true,
      daysPerWeek: true,
      goals: true,
      ownedResources: true,
      formatPrefs: true,
      sessionStyle: true,
      ifThenPlan: true,
      isCurrent: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const programs = await db.program.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      methodologyVersion: true,
      status: true,
      generationInput: true,
      createdAt: true,
      updatedAt: true,
      items: { select: programItemExportSelect },
    },
  });
  const activityEvents = await db.activityEvent.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      programItemId: true,
      type: true,
      occurredAt: true,
      payload: true,
      source: true,
      createdAt: true,
    },
  });
  const trainingFeedback = await db.trainingFeedback.findMany({
    where: { userId },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      programId: true,
      programItemId: true,
      scope: true,
      source: true,
      relevance: true,
      enjoyment: true,
      timeFit: true,
      frictionTags: true,
      comment: true,
      methodologyVersion: true,
      occurredAt: true,
      createdAt: true,
    },
  });
  const productFeedback = await db.productFeedback.findMany({
    where: { userId },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      category: true,
      message: true,
      routeContext: true,
      contactAllowed: true,
      methodologyVersion: true,
      appVersion: true,
      occurredAt: true,
      createdAt: true,
    },
  });
  const trainingFeedbackPrompts = await db.trainingFeedbackPrompt.findMany({
    where: { userId },
    orderBy: [{ shownAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      programId: true,
      programItemId: true,
      promptKey: true,
      kind: true,
      shownAt: true,
      createdAt: true,
    },
  });
  const skillStates = await db.skillState.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      dimension: true,
      estimate: true,
      uncertainty: true,
      sampleSize: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  const skillStateSnapshots = await db.skillStateSnapshot.findMany({
    where: { userId },
    orderBy: { runAt: "asc" },
    select: {
      id: true,
      userId: true,
      dimension: true,
      estimate: true,
      uncertainty: true,
      sampleSize: true,
      methodologyVersion: true,
      runAt: true,
      capturedAt: true,
    },
  });
  const scheduleStates = await db.scheduleState.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      itemRef: true,
      itemType: true,
      fsrsState: true,
      due: true,
      lastGrade: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const practiceItems = await db.practiceItem.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      kind: true,
      fen: true,
      solutionLine: true,
      sourceRef: true,
      methodologyKey: true,
      createdAt: true,
    },
  });
  const adaptationLogs = await db.adaptationLog.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      runAt: true,
      trigger: true,
      inputsSnapshot: true,
      decisions: true,
      methodologyVersion: true,
      createdAt: true,
    },
  });
  const rewardEvents = await db.rewardEvent.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      type: true,
      copyKey: true,
      occurredAt: true,
      payload: true,
      seen: true,
      createdAt: true,
    },
  });
  const notificationPref = await db.notificationPref.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      channel: true,
      cadenceCap: true,
      enabled: true,
      quietHours: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const apiCallBudgets = await db.apiCallBudget.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      platform: true,
      windowStart: true,
      count: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const trainingPreferenceState = await db.trainingPreferenceState.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      preferences: true,
      userOverride: true,
      resetAt: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  const weeklyFocuses = await db.weeklyFocus.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      weekStart: true,
      focusAreas: true,
      supportingSignals: true,
      confidence: true,
      methodologyVersion: true,
      inputSnapshot: true,
      status: true,
      rationaleSnapshots: true,
      alternatives: true,
      selectedAlternative: true,
      revisionTrigger: true,
      createdAt: true,
    },
  });
  const weeklyAvailability = await db.weeklyAvailability.findUnique({
    where: { userId },
  });
  const availabilityOverrides = await db.availabilityOverride.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
  const programDayForecasts = await db.programDayForecast.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  const programRevisions = await db.programRevision.findMany({
    where: { userId },
    orderBy: { occurredAt: "asc" },
  });
  const allowlistEntries = await db.allowlistEntry.findMany({
    where: { usedByUserId: userId },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      createdAt: true,
      usedByUserId: true,
    },
  });
  const researchConsents = await db.researchConsent.findMany({
    where: { userId },
    orderBy: { grantedAt: "asc" },
    select: {
      id: true,
      userId: true,
      noticeVersion: true,
      scopes: true,
      grantedAt: true,
      withdrawnAt: true,
      createdAt: true,
    },
  });

  return {
    exportFormat: "mainline-user-export/v3",
    generatedForUserId: userId,
    user,
    accounts,
    sessions,
    platformConnections: connections,
    chessProfileSnapshots: snapshots,
    importedGames: games,
    assessment,
    constraintSets,
    programs,
    activityEvents,
    trainingFeedback,
    productFeedback,
    trainingFeedbackPrompts,
    skillStates,
    skillStateSnapshots,
    scheduleStates,
    practiceItems,
    adaptationLogs,
    rewardEvents,
    notificationPref,
    apiCallBudgets,
    trainingPreferenceState,
    weeklyFocuses,
    weeklyAvailability,
    availabilityOverrides,
    programDayForecasts,
    programRevisions,
    claimedAllowlistEntries: allowlistEntries,
    researchConsents,
  };
}

export async function consentStatus(db: PrismaClient, userId: string) {
  const active = await db.researchConsent.findFirst({
    where: { userId, withdrawnAt: null },
    orderBy: { grantedAt: "desc" },
  });
  return {
    notice: CURRENT_DATA_USE_NOTICE,
    scope: RESEARCH_SCOPE,
    active,
    isEligible: hasCurrentResearchConsent(active, RESEARCH_SCOPE),
    hasActiveGrant: active !== null,
  };
}

export async function grantResearchConsent(
  db: PrismaClient,
  userId: string,
  displayedNoticeVersion: string,
  grantedAt: Date,
) {
  if (displayedNoticeVersion !== CURRENT_DATA_USE_NOTICE.id) {
    throw new StaleDataUseNoticeError(
      "The displayed data-use notice is no longer current.",
    );
  }
  return db.$transaction(async (tx) => {
    const latest = await tx.researchConsent.findFirst({
      where: { userId },
      orderBy: { grantedAt: "desc" },
    });
    if (
      latest?.withdrawnAt === null &&
      latest.noticeVersion === CURRENT_DATA_USE_NOTICE.id &&
      latest.scopes.includes(RESEARCH_SCOPE)
    ) {
      return latest;
    }
    await tx.researchConsent.updateMany({
      where: { userId, withdrawnAt: null },
      data: { withdrawnAt: grantedAt },
    });
    return tx.researchConsent.create({
      data: {
        userId,
        noticeVersion: CURRENT_DATA_USE_NOTICE.id,
        scopes: [RESEARCH_SCOPE],
        grantedAt,
      },
    });
  });
}

export async function withdrawResearchConsent(
  db: PrismaClient,
  userId: string,
  withdrawnAt: Date,
) {
  return db.researchConsent.updateMany({
    where: { userId, withdrawnAt: null },
    data: { withdrawnAt },
  });
}

/** Atomically soft-delete, assign an opaque token, and enqueue exactly one purge. */
export async function requestAccountDeletion(
  db: PrismaClient,
  userId: string,
  clock: Clock = systemClock,
): Promise<string> {
  const requestedAt = new Date(clock.now());
  return db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: userId },
      select: { deletionToken: true },
    });
    if (!existing) throw new Error("Account does not exist.");
    if (existing.deletionToken) return existing.deletionToken;

    const token = randomUUID();
    const claimed = await tx.user.updateMany({
      where: { id: userId, deletionToken: null },
      data: {
        deletedAt: requestedAt,
        deletionRequestedAt: requestedAt,
        deletionToken: token,
      },
    });
    if (claimed.count === 0) {
      const concurrent = await tx.user.findUnique({
        where: { id: userId },
        select: { deletionToken: true },
      });
      if (concurrent?.deletionToken) return concurrent.deletionToken;
      throw new Error("Account deletion could not be queued.");
    }
    await tx.accountPurgeLedger.create({ data: { token, requestedAt } });
    await tx.jobRun.create({
      data: {
        kind: ACCOUNT_PURGE_JOB_KIND,
        key: `account_purge:${token}`,
        status: "queued",
        attempt: 0,
        lockedUntil: null,
      },
    });
    return token;
  });
}

/** Hard-delete one account. All owned relations cascade; global catalogs are untouched. */
export async function purgeAccountByToken(
  db: PrismaClient,
  token: string,
  clock: Clock = systemClock,
) {
  const ledger = await db.accountPurgeLedger.findUnique({ where: { token } });
  if (!ledger) throw new Error("Unknown account purge token.");
  if (ledger.completedAt) return { alreadyPurged: true };

  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { deletionToken: token },
      select: { id: true, platformConnections: { select: { id: true } } },
    });
    if (!user) {
      await tx.accountPurgeLedger.update({
        where: { token },
        data: { completedAt: new Date(clock.now()) },
      });
      return;
    }
    const identifiers = [
      user.id,
      ...user.platformConnections.map((row) => row.id),
    ];
    await tx.jobRun.deleteMany({
      where: {
        NOT: { key: `account_purge:${token}` },
        OR: identifiers.map((identifier) => ({
          key: { endsWith: identifier },
        })),
      },
    });
    await tx.user.delete({ where: { id: user.id } });
    await tx.accountPurgeLedger.update({
      where: { token },
      data: { completedAt: new Date(clock.now()) },
    });
  });
  return { alreadyPurged: false };
}

export async function runAccountPurge(
  db: PrismaClient,
  token: string,
  clock: Clock = systemClock,
) {
  const key = `account_purge:${token}`;
  const result = await runJob(db, {
    kind: ACCOUNT_PURGE_JOB_KIND,
    key,
    clock,
    run: () => purgeAccountByToken(db, token, clock),
  });
  // Privacy exception to immutable successful JobRun keys: erase the purge key
  // because it is correlatable during deletion. AccountPurgeLedger is the opaque proof.
  if (result.state === "completed" || result.reason === "complete") {
    await db.jobRun.deleteMany({ where: { key } });
  }
  return result;
}
