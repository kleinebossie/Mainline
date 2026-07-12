import type { Prisma, PrismaClient } from "@prisma/client";

import { buildSevenDayForecast } from "@/engine/forecast";
import {
  availabilityOverrideInputSchema,
  programDayForecastSchema,
  programRevisionSchema,
  weeklyAvailabilityInputSchema,
  type AvailabilityOverrideInput,
  type WeeklyAvailabilityInput,
} from "@/lib/program-forecast";
import { programGenerationInputSchema } from "@/lib/weekly-focus";
import { systemClock, type Clock } from "@/lib/clock";
import { lockUserProgramMutation } from "@/db/user-mutation-lock";

type ForecastDb = Pick<
  PrismaClient,
  | "weeklyAvailability"
  | "availabilityOverride"
  | "programDayForecast"
  | "programRevision"
  | "program"
>;
type Db = ForecastDb & Partial<Pick<PrismaClient, "$transaction">>;

export interface ForecastSource {
  methodologyVersion: string;
  generationInput: unknown;
  items: Array<{
    activityId: string;
    activityType: string;
    params: unknown;
    dimensionsTargeted: string[];
    rationaleKey: string;
    rationaleText: string;
    evidenceGrade: string;
    evidenceTier: number;
    citationKey: string;
    confidence: string;
    soften: boolean;
  }>;
}

function startOfDay(epoch: number): Date {
  const date = new Date(epoch);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export async function getWeeklyAvailability(db: Db, userId: string) {
  const row = await db.weeklyAvailability.findUnique({ where: { userId } });
  return row
    ? {
        mode: row.mode as "flexible" | "preferred",
        preferredWeekdays: row.preferredWeekdays,
        defaultMinutesByDay: row.defaultMinutesByDay as Record<string, number>,
        promptResolvedAt: row.promptResolvedAt?.getTime() ?? null,
      }
    : {
        mode: "flexible" as const,
        preferredWeekdays: [],
        defaultMinutesByDay: {},
        promptResolvedAt: null,
      };
}

export async function saveWeeklyAvailability(
  db: Db,
  userId: string,
  raw: WeeklyAvailabilityInput,
  clock: Clock = systemClock,
) {
  const input = weeklyAvailabilityInputSchema.parse(raw);
  const row = await db.weeklyAvailability.upsert({
    where: { userId },
    create: {
      userId,
      ...input,
      defaultMinutesByDay: input.defaultMinutesByDay as Prisma.InputJsonValue,
      promptResolvedAt: new Date(clock.now()),
    },
    update: {
      ...input,
      defaultMinutesByDay: input.defaultMinutesByDay as Prisma.InputJsonValue,
      promptResolvedAt: new Date(clock.now()),
    },
  });
  return row;
}

export async function saveAvailabilityOverride(
  db: Db,
  userId: string,
  raw: AvailabilityOverrideInput,
) {
  const input = availabilityOverrideInputSchema.parse(raw);
  const date = startOfDay(input.date);
  return db.availabilityOverride.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      minutes: input.minutes,
      unavailable: input.unavailable,
    },
    update: { minutes: input.minutes, unavailable: input.unavailable },
  });
}

export async function getAvailabilityOverrides(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
) {
  const from = startOfDay(clock.now());
  const through = new Date(from.getTime() + 6 * 86_400_000);
  const rows = await db.availabilityOverride.findMany({
    where: { userId, date: { gte: from, lte: through } },
    orderBy: { date: "asc" },
  });
  return rows.map((row) => ({
    date: row.date.getTime(),
    minutes: row.minutes,
    unavailable: row.unavailable,
  }));
}

export async function removeAvailabilityOverride(
  db: Db,
  userId: string,
  dateEpoch: number,
) {
  return db.availabilityOverride.deleteMany({
    where: { userId, date: startOfDay(dateEpoch) },
  });
}

function decodeForecast(row: {
  id: string;
  date: Date;
  status: string;
  plannedBlocks: unknown;
  expectedMinutes: number;
  focusLinks: string[];
  dueReviewPressure: unknown;
  rationaleSnapshots: unknown;
  methodologyVersion: string;
}) {
  return programDayForecastSchema.parse({
    id: row.id,
    date: row.date.getTime(),
    status: row.status,
    plannedBlocks: row.plannedBlocks,
    expectedMinutes: row.expectedMinutes,
    focusLinks: row.focusLinks,
    dueReviewPressure: row.dueReviewPressure,
    rationaleSnapshots: row.rationaleSnapshots,
    methodologyVersion: row.methodologyVersion,
  });
}

export async function getForecast(db: Db, userId: string) {
  const rows = await db.programDayForecast.findMany({
    where: { userId, status: { in: ["provisional", "materialized"] } },
    orderBy: { date: "asc" },
  });
  return rows.map(decodeForecast);
}

export async function getProgramRevisions(db: Db, userId: string) {
  const rows = await db.programRevision.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map((row) =>
    programRevisionSchema.parse({
      id: row.id,
      previousFocusId: row.previousFocusId,
      newFocusId: row.newFocusId,
      previousForecastId: row.previousForecastId,
      newForecastId: row.newForecastId,
      trigger: row.trigger,
      changedFields: row.changedFields,
      gradedDecisions: row.gradedDecisions,
      methodologyVersion: row.methodologyVersion,
      occurredAt: row.occurredAt.getTime(),
    }),
  );
}

function forecastChangedFields(
  previous:
    | {
        weeklyFocusId: string;
        expectedMinutes: number;
        plannedBlocks: unknown;
        focusLinks: string[];
      }
    | undefined,
  next:
    | {
        weeklyFocusId: string;
        expectedMinutes: number;
        plannedBlocks: unknown;
        focusLinks: string[];
      }
    | undefined,
): string[] {
  if (!previous || !next) return ["forecast"];
  const changed: string[] = [];
  if (previous.expectedMinutes !== next.expectedMinutes) {
    changed.push("expectedMinutes");
  }
  if (
    JSON.stringify(previous.plannedBlocks) !==
    JSON.stringify(next.plannedBlocks)
  ) {
    changed.push("plannedBlocks");
  }
  if (JSON.stringify(previous.focusLinks) !== JSON.stringify(next.focusLinks)) {
    changed.push("focusLinks");
  }
  if (previous.weeklyFocusId !== next.weeklyFocusId) {
    changed.push("weeklyFocus");
  }
  return changed.length > 0 ? changed : ["forecastVersion"];
}

async function inTransaction<T>(
  db: Db,
  work: (tx: ForecastDb) => Promise<T>,
): Promise<T> {
  if (db.$transaction) {
    return db.$transaction((tx) => work(tx as ForecastDb));
  }
  return work(db);
}

/** Replace the provisional projection atomically. No unfinished discretionary block is
 * carried from an old date; due pressure is read fresh from the decision snapshot. */
export async function refreshForecast(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
  trigger = "state_change",
  preserveCommittedToday = true,
  suppliedSource?: ForecastSource,
) {
  const source =
    suppliedSource ??
    (await db.program.findFirst({
      where: { userId, status: "active" },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { orderIndex: "asc" } } },
    }));
  if (!source) return [];
  const snapshot = programGenerationInputSchema.parse(source.generationInput);
  const availability = await getWeeklyAvailability(db, userId);
  const from = startOfDay(clock.now());
  const through = new Date(from.getTime() + 6 * 86_400_000);
  const overrideRows = await db.availabilityOverride.findMany({
    where: { userId, date: { gte: from, lte: through } },
    orderBy: { date: "asc" },
  });
  const candidateBlocks = source.items.map((item) => ({
    activityId: item.activityId,
    activityType: item.activityType,
    expectedMinutes:
      typeof (item.params as { estMinutes?: unknown }).estMinutes === "number"
        ? (item.params as { estMinutes: number }).estMinutes
        : 0,
    dimensionsTargeted: item.dimensionsTargeted,
    rationaleKey: item.rationaleKey,
    rationaleText: item.rationaleText,
    evidenceGrade: item.evidenceGrade as "A" | "B" | "C" | "D",
    evidenceTier: item.evidenceTier as 1 | 2,
    citationKey: item.citationKey,
    confidence: item.confidence,
    soften: item.soften,
  }));
  const drafts = buildSevenDayForecast({
    now: clock.now(),
    fallbackMinutes: snapshot.constraints.minutesPerDay,
    availability: weeklyAvailabilityInputSchema.parse({
      mode: availability.mode,
      preferredWeekdays: availability.preferredWeekdays,
      defaultMinutesByDay: availability.defaultMinutesByDay,
    }),
    overrides: overrideRows.map((row) => ({
      date: row.date.getTime(),
      minutes: row.minutes,
      unavailable: row.unavailable,
    })),
    candidateBlocks,
  });
  const persisted = await inTransaction(db, async (tx) => {
    await lockUserProgramMutation(tx, userId);
    const prior = await tx.programDayForecast.findMany({
      where: { userId, status: { in: ["provisional", "materialized"] } },
      orderBy: { date: "asc" },
    });
    const committedToday = preserveCommittedToday
      ? prior.find(
          (row) =>
            row.status === "materialized" &&
            row.date.getTime() === from.getTime(),
        )
      : undefined;
    await tx.programDayForecast.updateMany({
      where: {
        userId,
        status: { in: ["provisional", "materialized"] },
        ...(committedToday ? { id: { not: committedToday.id } } : {}),
      },
      data: { status: "superseded" },
    });
    const next = [];
    for (const draft of drafts) {
      if (committedToday && draft.date === from.getTime()) continue;
      next.push(
        await tx.programDayForecast.create({
          data: {
            userId,
            weeklyFocusId: snapshot.weeklyFocus.id,
            date: new Date(draft.date),
            status:
              draft.date === from.getTime() ? "materialized" : "provisional",
            plannedBlocks:
              draft.plannedBlocks as unknown as Prisma.InputJsonValue,
            expectedMinutes: draft.expectedMinutes,
            focusLinks: snapshot.weeklyFocus.focusAreas,
            dueReviewPressure: { count: snapshot.dueWork.length },
            rationaleSnapshots: snapshot.weeklyFocus
              .rationaleSnapshots as unknown as Prisma.InputJsonValue,
            methodologyVersion: source.methodologyVersion,
            inputSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        }),
      );
    }
    if (prior.length > 0) {
      const eligiblePrior = prior.filter(
        (row) => row.id !== committedToday?.id,
      );
      const priorByDate = new Map(
        eligiblePrior.map((row) => [row.date.getTime(), row]),
      );
      const nextByDate = new Map(next.map((row) => [row.date.getTime(), row]));
      const dates = [
        ...new Set([...priorByDate.keys(), ...nextByDate.keys()]),
      ].sort((a, b) => a - b);
      const changedPairs = dates.map((date) => ({
        previous: priorByDate.get(date),
        next: nextByDate.get(date),
      }));
      const materialPair =
        changedPairs.find(
          ({ previous, next }) =>
            !previous ||
            !next ||
            forecastChangedFields(previous, next).some(
              (field) => field !== "forecastVersion",
            ),
        ) ?? changedPairs[0];
      const allChangedFields = [
        ...new Set(
          changedPairs.flatMap(({ previous, next }) =>
            forecastChangedFields(previous, next),
          ),
        ),
      ];
      const changedFields = allChangedFields.some(
        (field) => field !== "forecastVersion",
      )
        ? allChangedFields.filter((field) => field !== "forecastVersion")
        : allChangedFields;
      await tx.programRevision.create({
        data: {
          userId,
          previousFocusId: materialPair?.previous?.weeklyFocusId ?? null,
          newFocusId: snapshot.weeklyFocus.id,
          previousForecastId: materialPair?.previous?.id ?? null,
          newForecastId: materialPair?.next?.id ?? null,
          trigger,
          changedFields: changedFields as Prisma.InputJsonValue,
          gradedDecisions: snapshot.weeklyFocus
            .rationaleSnapshots as unknown as Prisma.InputJsonValue,
          methodologyVersion: source.methodologyVersion,
          occurredAt: new Date(clock.now()),
        },
      });
    }
    return { next, committedToday };
  });
  return [
    ...(persisted.committedToday
      ? [decodeForecast(persisted.committedToday)]
      : []),
    ...persisted.next.map(decodeForecast),
  ].sort((a, b) => a.date - b.date);
}

export async function hasStartedToday(
  db: Db,
  userId: string,
): Promise<boolean> {
  const count = await db.program.count({
    where: {
      userId,
      status: "active",
      items: { some: { activityEvents: { some: {} } } },
    },
  });
  return count > 0;
}
