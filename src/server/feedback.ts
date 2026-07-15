import { Prisma, type PrismaClient } from "@prisma/client";

import { lockUserProgramMutation } from "@/db/user-mutation-lock";
import {
  EMPTY_TRAINING_PREFERENCES,
  trainingPreferencesSchema,
  type TrainingPreferences,
} from "@/lib/decision-input";
import {
  preferenceOverrideInputSchema,
  productFeedbackInputSchema,
  safeRouteContext,
  trainingFeedbackInputSchema,
  type ProductFeedbackInput,
  type TrainingFeedbackInput,
} from "@/lib/feedback";
import { DAY_MS, systemClock, type Clock } from "@/lib/clock";
import {
  loadMethodology,
  rollUpTrainingPreferences,
  selectTrainingFitPrompt,
  updateTrainingPreferences,
  type TrainingFitObservation,
  type TrainingFitPreferenceRollup,
} from "@/methodology";
import { expectedError } from "@/server/errors";

type Db = PrismaClient;

const TRAINING_FEEDBACK_DAILY_LIMIT = 24;
const PRODUCT_FEEDBACK_DAILY_LIMIT = 12;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function emptyPreferences(methodologyVersion?: string): TrainingPreferences {
  return {
    ...EMPTY_TRAINING_PREFERENCES,
    enjoyment: {},
    resourceAffinity: {},
    timeFit: {},
    frictionTags: [],
    ...(methodologyVersion ? { methodologyVersion } : {}),
  };
}

function currentRollup(
  raw: unknown,
  methodologyVersion: string,
): TrainingFitPreferenceRollup | null {
  const parsed = trainingPreferencesSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.methodologyVersion !== methodologyVersion
  ) {
    return null;
  }
  return { ...parsed.data, methodologyVersion };
}

function preferencesForResponse(
  raw: unknown,
  methodologyVersion: string,
): TrainingPreferences {
  const parsed = trainingPreferencesSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyPreferences(methodologyVersion);
}

function resourceKeyFrom(
  resourceRefId: string | null,
  params: unknown,
): string | null {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return resourceRefId;
  }
  const candidate = params as {
    bookResource?: { id?: unknown };
    theme?: unknown;
  };
  if (typeof candidate.bookResource?.id === "string") {
    return candidate.bookResource.id;
  }
  return typeof candidate.theme === "string" ? candidate.theme : resourceRefId;
}

async function ownedProgramItem(
  db: Pick<PrismaClient, "programItem">,
  userId: string,
  programItemId: string,
) {
  const item = await db.programItem.findFirst({
    where: { id: programItemId, program: { userId } },
    select: {
      id: true,
      programId: true,
      activityType: true,
      resourceRefId: true,
      params: true,
    },
  });
  if (!item) throw expectedError.notFound("That training block was not found.");
  return item;
}

async function requireOwnedProgram(
  db: Pick<PrismaClient, "program">,
  userId: string,
  programId: string,
) {
  const program = await db.program.findFirst({
    where: { id: programId, userId },
    select: { id: true },
  });
  if (!program) throw expectedError.notFound("That program was not found.");
  return program;
}

/** Append subjective fit evidence and increment the positive-only preference read model. */
export async function submitTrainingFeedback(
  db: Db,
  userId: string,
  raw: TrainingFeedbackInput,
  clock: Clock = systemClock,
) {
  const input = trainingFeedbackInputSchema.parse(raw);
  const cfg = loadMethodology();
  if (!cfg.trainingFit) {
    throw new Error("Active methodology has no training-fit policy");
  }
  const allowedFriction = new Set(
    cfg.trainingFit.frictionTags.map((tag) => tag.id),
  );
  if (input.frictionTags.some((tag) => !allowedFriction.has(tag))) {
    throw expectedError.badRequest(
      "One or more friction choices were not accepted.",
    );
  }
  const occurredAt = new Date(clock.now());

  return db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, userId);
    const existing = await tx.trainingFeedback.findUnique({
      where: { userId_requestId: { userId, requestId: input.requestId } },
      select: { id: true },
    });
    if (existing) {
      const state = await tx.trainingPreferenceState.findUnique({
        where: { userId },
        select: { preferences: true },
      });
      return {
        ok: true as const,
        id: existing.id,
        preferences: preferencesForResponse(state?.preferences, cfg.version),
      };
    }

    const item = input.programItemId
      ? await ownedProgramItem(tx, userId, input.programItemId)
      : null;
    const programId = item?.programId ?? input.programId ?? null;
    if (input.programId && item && input.programId !== item.programId) {
      throw expectedError.badRequest(
        "The selected program and training block do not match.",
      );
    }
    if (!item && programId) await requireOwnedProgram(tx, userId, programId);

    const recentCount = await tx.trainingFeedback.count({
      where: {
        userId,
        occurredAt: { gte: new Date(occurredAt.getTime() - DAY_MS) },
      },
    });
    if (recentCount >= TRAINING_FEEDBACK_DAILY_LIMIT) {
      throw expectedError.tooManyRequests(
        "Training feedback is temporarily limited. Try again tomorrow.",
      );
    }

    const created = await tx.trainingFeedback.create({
      data: {
        userId,
        requestId: input.requestId,
        programId,
        programItemId: item?.id ?? null,
        scope: input.scope,
        source: input.source,
        relevance: input.relevance,
        enjoyment: input.enjoyment,
        timeFit: input.timeFit,
        frictionTags: input.frictionTags,
        comment: input.comment || null,
        methodologyVersion: cfg.version,
        occurredAt,
      },
      select: { id: true },
    });

    const current = await tx.trainingPreferenceState.findUnique({
      where: { userId },
      select: { preferences: true, resetAt: true },
    });
    const observation: TrainingFitObservation = {
      id: created.id,
      activityType: item?.activityType ?? null,
      resourceKey: resourceKeyFrom(item?.resourceRefId ?? null, item?.params),
      relevance: input.relevance,
      enjoyment: input.enjoyment,
      timeFit: input.timeFit,
      frictionTags: input.frictionTags,
      occurredAt: occurredAt.getTime(),
    };
    const incremental = currentRollup(current?.preferences, cfg.version);
    let preferences: TrainingFitPreferenceRollup;
    if (incremental) {
      preferences = updateTrainingPreferences(incremental, observation, cfg);
    } else {
      const rows = await tx.trainingFeedback.findMany({
        where: {
          userId,
          ...(current?.resetAt
            ? {
                OR: [
                  { occurredAt: { gt: current.resetAt } },
                  { id: created.id },
                ],
              }
            : {}),
        },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          relevance: true,
          enjoyment: true,
          timeFit: true,
          frictionTags: true,
          occurredAt: true,
          programItem: {
            select: {
              activityType: true,
              resourceRefId: true,
              params: true,
            },
          },
        },
      });
      preferences = rollUpTrainingPreferences(
        rows.map((row) => ({
          id: row.id,
          activityType: row.programItem?.activityType ?? null,
          resourceKey: resourceKeyFrom(
            row.programItem?.resourceRefId ?? null,
            row.programItem?.params,
          ),
          relevance: row.relevance as TrainingFitObservation["relevance"],
          enjoyment: row.enjoyment as TrainingFitObservation["enjoyment"],
          timeFit: row.timeFit as TrainingFitObservation["timeFit"],
          frictionTags: row.frictionTags,
          occurredAt: row.occurredAt.getTime(),
        })),
        cfg,
      );
    }
    await tx.trainingPreferenceState.upsert({
      where: { userId },
      create: {
        userId,
        preferences: json(preferences),
        userOverride: Prisma.JsonNull,
      },
      update: { preferences: json(preferences) },
    });
    return { ok: true as const, id: created.id, preferences };
  });
}

/** Store operational feedback separately from training evidence. */
export async function submitProductFeedback(
  db: Db,
  userId: string,
  raw: ProductFeedbackInput,
  clock: Clock = systemClock,
) {
  const input = productFeedbackInputSchema.parse(raw);
  const cfg = loadMethodology();
  const occurredAt = new Date(clock.now());
  return db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, userId);
    const existing = await tx.productFeedback.findUnique({
      where: { userId_requestId: { userId, requestId: input.requestId } },
      select: { id: true },
    });
    if (existing) return { ok: true as const, id: existing.id };
    const recentCount = await tx.productFeedback.count({
      where: {
        userId,
        occurredAt: { gte: new Date(occurredAt.getTime() - DAY_MS) },
      },
    });
    if (recentCount >= PRODUCT_FEEDBACK_DAILY_LIMIT) {
      throw expectedError.tooManyRequests(
        "Product feedback is temporarily limited. Try again tomorrow.",
      );
    }
    const created = await tx.productFeedback.create({
      data: {
        userId,
        requestId: input.requestId,
        category: input.category,
        message: input.message,
        routeContext: safeRouteContext(input.routeContext),
        contactAllowed: input.contactAllowed,
        methodologyVersion: cfg.version,
        appVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? "development",
        occurredAt,
      },
      select: { id: true },
    });
    return { ok: true as const, id: created.id };
  });
}

/** An explicit override may only add a positive preference for an eligible activity. */
export async function setPositiveTrainingPreference(
  db: Db,
  userId: string,
  raw: { activityType: string | null },
) {
  const input = preferenceOverrideInputSchema.parse(raw);
  const cfg = loadMethodology();
  const activityTypes = new Set(
    cfg.activities.map((item) => item.activityType),
  );
  if (input.activityType && !activityTypes.has(input.activityType)) {
    throw expectedError.badRequest("That training activity was not accepted.");
  }
  const override = input.activityType
    ? {
        ...emptyPreferences(cfg.version),
        enjoyment: { [input.activityType]: 1 },
      }
    : null;
  await db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, userId);
    await tx.trainingPreferenceState.upsert({
      where: { userId },
      create: {
        userId,
        preferences: json(emptyPreferences(cfg.version)),
        userOverride: override ? json(override) : undefined,
      },
      update: { userOverride: override ? json(override) : Prisma.JsonNull },
    });
  });
  return { ok: true as const, activityType: input.activityType };
}

/** Reset ignores older fit evidence without deleting the auditable source records. */
export async function resetTrainingPreferences(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
) {
  const cfg = loadMethodology();
  await db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, userId);
    await tx.trainingPreferenceState.upsert({
      where: { userId },
      create: {
        userId,
        preferences: json(emptyPreferences(cfg.version)),
        userOverride: undefined,
        resetAt: new Date(clock.now()),
      },
      update: {
        preferences: json(emptyPreferences(cfg.version)),
        userOverride: Prisma.JsonNull,
        resetAt: new Date(clock.now()),
      },
    });
  });
  return { ok: true as const };
}

export async function getFeedbackSettings(db: Db, userId: string) {
  const cfg = loadMethodology();
  if (!cfg.trainingFit) {
    throw new Error("Active methodology has no training-fit policy");
  }
  const [state, program, items] = await Promise.all([
    db.trainingPreferenceState.findUnique({
      where: { userId },
      select: {
        preferences: true,
        userOverride: true,
        resetAt: true,
        updatedAt: true,
      },
    }),
    db.program.findFirst({
      where: { userId, status: "active" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    }),
    db.programItem.findMany({
      where: { program: { userId }, status: { in: ["done", "skipped"] } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 12,
      select: {
        id: true,
        programId: true,
        activityType: true,
        status: true,
        date: true,
      },
    }),
  ]);
  const parsedPreferences = trainingPreferencesSchema.safeParse(
    state?.preferences,
  );
  const parsedOverrideResult = trainingPreferencesSchema.safeParse(
    state?.userOverride,
  );
  const parsedOverride = parsedOverrideResult.success
    ? parsedOverrideResult.data
    : null;
  const preferredActivity = parsedOverride
    ? (Object.entries(parsedOverride.enjoyment ?? {}).find(
        ([, score]) => score > 0,
      )?.[0] ?? null)
    : null;
  return {
    state: state
      ? {
          preferences: parsedPreferences.success
            ? parsedPreferences.data
            : emptyPreferences(cfg.version),
          preferredActivity,
          resetAt: state.resetAt?.getTime() ?? null,
          updatedAt: state.updatedAt.getTime(),
        }
      : {
          preferences: emptyPreferences(cfg.version),
          preferredActivity: null,
          resetAt: null,
          updatedAt: 0,
        },
    activeProgramId: program?.id ?? null,
    recentItems: items.map((item) => ({
      ...item,
      date: item.date.getTime(),
    })),
    activities: [...new Set(cfg.activities.map((item) => item.activityType))]
      .sort()
      .map((activityType) => ({
        activityType,
        label:
          cfg.activities.find((item) => item.activityType === activityType)
            ?.label ?? activityType,
      })),
    frictionTags: cfg.trainingFit.frictionTags.map((tag) => ({
      value: tag.id,
      label: tag.label,
    })),
    boundary: {
      text: cfg.trainingFit.boundaryExplanation.value,
      grade: cfg.trainingFit.boundaryExplanation.grade,
      tier: cfg.trainingFit.boundaryExplanation.tier,
      citationKey: cfg.trainingFit.boundaryExplanation.citationKey,
      soften:
        cfg.trainingFit.boundaryExplanation.grade === "C" ||
        cfg.trainingFit.boundaryExplanation.grade === "D",
    },
  };
}

/** Select one sparse prompt from persisted behavior and prior prompt exposure. */
async function selectTrainingFeedbackPrompt(
  db: Prisma.TransactionClient,
  userId: string,
  clock: Clock = systemClock,
) {
  const cfg = loadMethodology();
  if (!cfg.trainingFit) return null;
  const [firstProgram, weeklyFeedback, weeklyPrompt, contextPrompt, event] =
    await Promise.all([
      db.program.findFirst({
        where: { userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { createdAt: true },
      }),
      db.trainingFeedback.findFirst({
        where: { userId, source: "weekly_check_in" },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        select: { occurredAt: true },
      }),
      db.trainingFeedbackPrompt.findFirst({
        where: { userId, kind: "weekly" },
        orderBy: [{ shownAt: "desc" }, { id: "desc" }],
        select: { shownAt: true },
      }),
      db.trainingFeedbackPrompt.findFirst({
        where: {
          userId,
          kind: { in: ["novel_activity", "repeated_problem"] },
        },
        orderBy: [{ shownAt: "desc" }, { id: "desc" }],
        select: { shownAt: true },
      }),
      db.activityEvent.findFirst({
        where: {
          userId,
          programItemId: { not: null },
          type: { in: ["puzzle_attempt", "drill_done", "game_played", "skip"] },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        select: {
          programItemId: true,
          programItem: {
            select: { programId: true, activityType: true },
          },
        },
      }),
    ]);
  const activityType = event?.programItem?.activityType ?? null;
  const activityEventCount = activityType
    ? await db.activityEvent.count({
        where: { userId, programItem: { activityType } },
      })
    : 0;
  const problemCount = activityType
    ? await db.activityEvent.count({
        where: { userId, type: "skip", programItem: { activityType } },
      })
    : 0;
  const now = clock.now();
  const prompt = selectTrainingFitPrompt(
    {
      now,
      trainingStartedAt: firstProgram?.createdAt.getTime() ?? null,
      lastWeeklyFeedbackAt: weeklyFeedback?.occurredAt.getTime() ?? null,
      lastWeeklyPromptAt: weeklyPrompt?.shownAt.getTime() ?? null,
      lastContextPromptAt: contextPrompt?.shownAt.getTime() ?? null,
      contextualCandidate: activityType
        ? {
            activityType,
            novel: activityEventCount === 1,
            problemCount,
          }
        : null,
    },
    cfg,
  );
  if (!prompt) return null;
  const programItemId =
    prompt.kind === "weekly" ? null : (event?.programItemId ?? null);
  const programId =
    prompt.kind === "weekly" ? null : (event?.programItem?.programId ?? null);
  const period = Math.floor(
    now / (cfg.trainingFit.weeklyCheckInDays.value * DAY_MS),
  );
  const contextPeriod = Math.floor(
    now / (cfg.trainingFit.contextualCooldownDays.value * DAY_MS),
  );
  return {
    ...prompt,
    programId,
    programItemId,
    promptKey:
      prompt.kind === "weekly"
        ? `weekly:${period}`
        : `${prompt.kind}:${programItemId ?? "none"}:${contextPeriod}`,
  };
}

/** Select and persist one prompt exposure under the per-user mutation lock. */
export async function claimTrainingFeedbackPrompt(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
) {
  return db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, userId);
    const claimedAt = clock.now();
    const prompt = await selectTrainingFeedbackPrompt(tx, userId, {
      now: () => claimedAt,
    });
    if (!prompt) return null;
    const created = await tx.trainingFeedbackPrompt.createMany({
      data: [
        {
          userId,
          promptKey: prompt.promptKey,
          kind: prompt.kind,
          programId: prompt.programId,
          programItemId: prompt.programItemId,
          shownAt: new Date(claimedAt),
        },
      ],
      skipDuplicates: true,
    });
    return created.count === 1 ? prompt : null;
  });
}
