// Read-only projection over persisted Program, ProgramItem, and ActivityEvent artifacts.

import type { PrismaClient } from "@prisma/client";

import {
  loadMethodology,
  UnknownMethodologyVersionError,
  type MethodologyConfig,
} from "@/methodology";
import {
  activityEventPayloadSchema,
  type LogOutcomeInput,
} from "@/lib/tracker";
import type {
  ProgramHistoryEntry,
  ProgramHistoryInput,
  ProgramHistoryItem,
  ProgramHistoryPage,
} from "@/lib/program-history";

type HistoryDb = Pick<PrismaClient, "program">;

export const MAX_HISTORY_EVENTS_PER_ITEM = 100;

interface HistoryPresentation {
  activityLabels: ReadonlyMap<string, string>;
  dimensionLabels: ReadonlyMap<string, string>;
  citationSources: ReadonlyMap<string, string>;
}

const EMPTY_PRESENTATION: HistoryPresentation = {
  activityLabels: new Map(),
  dimensionLabels: new Map(),
  citationSources: new Map(),
};

function presentationFor(
  version: string,
  methodologyLoader: (version?: string) => MethodologyConfig,
): HistoryPresentation {
  try {
    const cfg = methodologyLoader(version);
    return {
      activityLabels: new Map(
        cfg.activities.map((activity) => [activity.id, activity.label]),
      ),
      dimensionLabels: new Map(
        cfg.dimensions.map((dimension) => [dimension.id, dimension.label]),
      ),
      citationSources: new Map(
        cfg.evidenceLedger.map((citation) => [citation.key, citation.source]),
      ),
    };
  } catch (error) {
    if (!(error instanceof UnknownMethodologyVersionError)) throw error;
    // Persisted snapshots remain readable even if an old methodology package is absent.
    // Never substitute the active release, which would rewrite historical meaning.
    return EMPTY_PRESENTATION;
  }
}

function plannedMinutes(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || !("estMinutes" in raw)) return null;
  const value = (raw as { estMinutes?: unknown }).estMinutes;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function measuredMinutes(raw: unknown): number | null {
  const parsed = activityEventPayloadSchema.safeParse(raw);
  if (!parsed.success) return null;

  const payload: Pick<LogOutcomeInput, "durationMin" | "solveTimeMs"> =
    parsed.data;
  if (payload.durationMin != null) return payload.durationMin;
  if (payload.solveTimeMs != null) return payload.solveTimeMs / 60_000;
  return null;
}

function nullableSum(values: readonly (number | null)[]): number | null {
  const measured = values.filter((value): value is number => value != null);
  return measured.length > 0
    ? measured.reduce((total, value) => total + value, 0)
    : null;
}

function completeSum(values: readonly (number | null)[]): number | null {
  if (values.length === 0 || values.some((value) => value == null)) return null;
  return (values as number[]).reduce((total, value) => total + value, 0);
}

export async function getProgramHistory(
  db: HistoryDb,
  userId: string,
  input: ProgramHistoryInput,
  methodologyLoader: (version?: string) => MethodologyConfig = loadMethodology,
): Promise<ProgramHistoryPage> {
  const cursorFilter = input.cursor
    ? {
        OR: [
          { createdAt: { lt: input.cursor.createdAt } },
          {
            createdAt: input.cursor.createdAt,
            id: { lt: input.cursor.id },
          },
        ],
      }
    : {};

  const rows = await db.program.findMany({
    where: { userId, ...cursorFilter },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    select: {
      id: true,
      status: true,
      createdAt: true,
      methodologyVersion: true,
      items: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          date: true,
          orderIndex: true,
          activityId: true,
          activityType: true,
          params: true,
          dimensionsTargeted: true,
          rationaleText: true,
          evidenceGrade: true,
          evidenceTier: true,
          citationKey: true,
          confidence: true,
          soften: true,
          status: true,
          activityEvents: {
            orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
            take: MAX_HISTORY_EVENTS_PER_ITEM,
            select: { id: true, occurredAt: true, payload: true },
          },
          _count: { select: { activityEvents: true } },
        },
      },
    },
  });

  const hasNextPage = rows.length > input.limit;
  const pageRows = hasNextPage ? rows.slice(0, input.limit) : rows;
  const entries = pageRows.map((program): ProgramHistoryEntry => {
    const presentation = presentationFor(
      program.methodologyVersion,
      methodologyLoader,
    );
    const items = program.items.map((item): ProgramHistoryItem => {
      const eventMinutes = item.activityEvents.map((event) =>
        measuredMinutes(event.payload),
      );
      const actualMinutes = nullableSum(eventMinutes);
      const measuredEventCount = eventMinutes.filter(
        (minutes) => minutes != null,
      ).length;
      const eventCount = item._count.activityEvents;
      return {
        id: item.id,
        orderIndex: item.orderIndex,
        activityId: item.activityId,
        activityType: item.activityType,
        label:
          presentation.activityLabels.get(item.activityId) ?? item.activityId,
        dimensionLabels: item.dimensionsTargeted.map(
          (dimension) =>
            presentation.dimensionLabels.get(dimension) ?? dimension,
        ),
        plannedMinutes: plannedMinutes(item.params),
        actualMinutes,
        status: item.status,
        eventCount,
        measuredEventCount,
        measurementTruncated: eventCount > item.activityEvents.length,
        lastActivityAt: item.activityEvents[0]?.occurredAt ?? null,
        rationale: {
          text: item.rationaleText,
          evidenceGrade: item.evidenceGrade,
          evidenceTier: item.evidenceTier,
          citationKey: item.citationKey,
          citationSource:
            presentation.citationSources.get(item.citationKey) ?? null,
          confidence: item.confidence,
          soften: item.soften,
        },
      };
    });

    return {
      id: program.id,
      status: program.status,
      scheduledDate: program.items[0]?.date ?? null,
      createdAt: program.createdAt,
      methodologyVersion: program.methodologyVersion,
      plannedMinutes: completeSum(items.map((item) => item.plannedMinutes)),
      actualMinutes: nullableSum(items.map((item) => item.actualMinutes)),
      eventCount: items.reduce((total, item) => total + item.eventCount, 0),
      measuredEventCount: items.reduce(
        (total, item) => total + item.measuredEventCount,
        0,
      ),
      measurementTruncated: items.some((item) => item.measurementTruncated),
      lastActivityAt:
        items
          .map((item) => item.lastActivityAt)
          .filter((date): date is Date => date != null)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      items,
    };
  });

  const last = entries.at(-1);
  return {
    entries,
    nextCursor:
      hasNextPage && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}
