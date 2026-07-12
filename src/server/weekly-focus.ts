import type { Prisma, PrismaClient } from "@prisma/client";
import {
  loadMethodology,
  selectWeeklyFocus,
  shouldReviseWeeklyFocus,
  type MethodologyConfig,
  type WeeklyFocusInput,
} from "@/methodology";
import {
  type ProgramDecisionInput,
  programDecisionInputSchema,
} from "@/lib/decision-input";
import { weeklyFocusSchema, type WeeklyFocus } from "@/lib/weekly-focus";
import { findActiveWeeklyFocus, replaceWeeklyFocus } from "@/db/weekly-focus";

type Db = Pick<PrismaClient, "weeklyFocus" | "$transaction">;
const DAY_MS = 86_400_000;

function weekStart(epoch: number): Date {
  const date = new Date(epoch);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + offset,
    ),
  );
}

function providerInput(s: ProgramDecisionInput): WeeklyFocusInput {
  return {
    latestSkillState: s.latestSkillState,
    weaknessSignals: s.weaknessSignals,
    dueWork: s.dueWork,
    goals: s.goals,
    constraints: {
      minutesPerDay: s.constraints.minutesPerDay,
      daysPerWeek: s.constraints.daysPerWeek,
    },
    ownedResources: s.ownedResources,
    activityRecency: s.activityRecency,
    trainingPreferences: s.trainingPreferences,
  };
}

export function recommendationForPersistedFocus(
  focus: WeeklyFocus,
  cfg: MethodologyConfig,
) {
  return selectWeeklyFocus(providerInput(focus.inputSnapshot), cfg);
}

function decode(row: {
  id: string;
  weekStart: Date;
  focusAreas: string[];
  supportingSignals: unknown;
  confidence: string;
  methodologyVersion: string;
  inputSnapshot: unknown;
  status: string;
  rationaleSnapshots: unknown;
  alternatives: unknown;
  selectedAlternative: string | null;
  revisionTrigger: string | null;
  createdAt: Date;
}): WeeklyFocus {
  return weeklyFocusSchema.parse({
    ...row,
    weekStart: row.weekStart.getTime(),
    createdAt: row.createdAt.getTime(),
  });
}

export async function ensureWeeklyFocus(
  db: Db,
  userId: string,
  snapshot: ProgramDecisionInput,
  cfg: MethodologyConfig,
): Promise<WeeklyFocus> {
  const active = await findActiveWeeklyFocus(db, userId);
  let trigger: string | null = active ? null : "initial";
  let revisionRationale = null;
  if (active) {
    if (active.methodologyVersion !== cfg.version) {
      trigger = "methodology";
    } else {
      const previous = programDecisionInputSchema.parse(active.inputSnapshot);
      const revision = shouldReviseWeeklyFocus(
        {
          ageDays: Math.floor(
            (snapshot.assembledAt - active.createdAt.getTime()) / DAY_MS,
          ),
          previousConstraints: {
            minutesPerDay: previous.constraints.minutesPerDay,
            daysPerWeek: previous.constraints.daysPerWeek,
          },
          nextConstraints: {
            minutesPerDay: snapshot.constraints.minutesPerDay,
            daysPerWeek: snapshot.constraints.daysPerWeek,
          },
          previousSignals: previous.weaknessSignals,
          nextSignals: snapshot.weaknessSignals,
          previousSkillState: previous.latestSkillState,
          nextSkillState: snapshot.latestSkillState,
        },
        cfg,
      );
      if (!revision.revise) return decode(active);
      trigger = revision.reason;
      revisionRationale = revision.rationale;
    }
  }
  const selected = selectWeeklyFocus(providerInput(snapshot), cfg);
  const row = await replaceWeeklyFocus(db, {
    userId,
    weekStart: weekStart(snapshot.assembledAt),
    focusAreas: selected.focusAreas,
    supportingSignals:
      selected.supportingSignals as unknown as Prisma.InputJsonValue,
    confidence: selected.confidence,
    methodologyVersion: cfg.version,
    inputSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    rationaleSnapshots: [
      selected.rationale,
      ...(revisionRationale ? [revisionRationale] : []),
    ] as unknown as Prisma.InputJsonValue,
    alternatives: selected.alternatives as unknown as Prisma.InputJsonValue,
    selectedAlternative: null,
    revisionTrigger: trigger,
    expectedActiveId: active?.id ?? null,
  });
  return decode(row);
}

export async function getWeeklyFocus(db: Db, userId: string) {
  const row = await findActiveWeeklyFocus(db, userId);
  return row ? decode(row) : null;
}

export async function selectPersistedFocusChoice(
  db: Db,
  userId: string,
  weeklyFocusId: string,
  focusAreas: string[],
) {
  const active = await getWeeklyFocus(db, userId);
  if (!active) throw new Error("No active weekly focus");
  if (active.id !== weeklyFocusId)
    throw new Error("Weekly focus changed; refresh and try again");
  if (
    active.focusAreas.length === focusAreas.length &&
    active.focusAreas.every(
      (focusArea, index) => focusArea === focusAreas[index],
    )
  ) {
    return active;
  }

  const cfg = loadMethodology(active.methodologyVersion);
  const recommendation = recommendationForPersistedFocus(active, cfg);
  const isRecommendation =
    recommendation.focusAreas.length === focusAreas.length &&
    recommendation.focusAreas.every(
      (focusArea, index) => focusArea === focusAreas[index],
    );
  const alternative =
    focusAreas.length === 1
      ? active.alternatives.find((item) => item.focusArea === focusAreas[0])
      : undefined;
  if (!isRecommendation && !alternative)
    throw new Error("Focus alternative is not methodology-approved");

  const selectedFocusAreas = isRecommendation
    ? recommendation.focusAreas
    : [alternative!.focusArea];
  const supportingSignals = isRecommendation
    ? recommendation.supportingSignals
    : [
        {
          focusArea: alternative!.focusArea,
          score: alternative!.score,
          sources: alternative!.supportingSources,
        },
      ];
  const row = await replaceWeeklyFocus(db, {
    userId,
    weekStart: new Date(active.weekStart),
    focusAreas: selectedFocusAreas,
    supportingSignals: supportingSignals as unknown as Prisma.InputJsonValue,
    confidence: active.confidence,
    methodologyVersion: active.methodologyVersion,
    inputSnapshot: active.inputSnapshot as unknown as Prisma.InputJsonValue,
    rationaleSnapshots: [
      recommendation.rationale,
      ...(!isRecommendation && alternative ? [alternative.tradeoff] : []),
    ] as unknown as Prisma.InputJsonValue,
    alternatives: active.alternatives as unknown as Prisma.InputJsonValue,
    selectedAlternative: isRecommendation ? null : alternative!.focusArea,
    revisionTrigger: isRecommendation
      ? "user_recommendation"
      : "user_alternative",
    expectedActiveId: active.id,
  });
  return decode(row);
}
