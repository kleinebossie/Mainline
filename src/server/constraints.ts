// ConstraintSet orchestration (BUILD.md M4 · §5.4). Saving supersedes the previous
// current row and bumps the version, so the latest `isCurrent` row always feeds the
// generator (M6) while history is preserved. No graded decision here (L1) — the only
// methodology touch is assembling the Seam-9 if-then plan via the provider fn.

import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { buildImplementationIntention } from "@/methodology";
import {
  constraintsInputSchema,
  formatPrefsSchema,
  goalSchema,
  ifThenPlanSchema,
  ownedResourceSchema,
  sessionStyleSchema,
  DEFAULT_SESSION_STYLE,
  type ConstraintsInput,
  type TargetFocus,
} from "@/lib/constraints";

type Db = Pick<PrismaClient, "constraintSet" | "$transaction">;

/** Re-parse the stored JSON columns into typed values (defensive; falls back to empty).
 *  Tolerant of rows written before sessionStyle/structured ownedResources existed. */
export function decodeConstraintSet(row: {
  id: string;
  minutesPerDay: number;
  daysPerWeek: number;
  goals: unknown;
  ownedResources: unknown;
  formatPrefs: unknown;
  sessionStyle: unknown;
  ifThenPlan: unknown;
  version: number;
}): ConstraintsInput & { id: string; version: number } {
  const goals = z.array(goalSchema).safeParse(row.goals);
  const ownedResources = z
    .array(ownedResourceSchema)
    .safeParse(row.ownedResources);
  const formatPrefs = formatPrefsSchema.safeParse(row.formatPrefs);
  const sessionStyle = sessionStyleSchema.safeParse(row.sessionStyle);
  const ifThenPlan = ifThenPlanSchema.safeParse(row.ifThenPlan);
  return {
    id: row.id,
    version: row.version,
    minutesPerDay: row.minutesPerDay,
    daysPerWeek: row.daysPerWeek,
    goals: goals.success ? goals.data : [],
    ownedResources: ownedResources.success ? ownedResources.data : [],
    formatPrefs: formatPrefs.success
      ? formatPrefs.data
      : { formats: [], preferredVariety: false, targetFocus: "online" },
    sessionStyle: sessionStyle.success
      ? sessionStyle.data
      : DEFAULT_SESSION_STYLE,
    ifThenPlan: ifThenPlan.success ? ifThenPlan.data : null,
  };
}

/** The current ConstraintSet for a user, decoded, or null if none saved yet. */
export async function getCurrentConstraints(
  db: Db,
  userId: string,
): Promise<(ConstraintsInput & { id: string; version: number }) | null> {
  const row = await db.constraintSet.findFirst({
    where: { userId, isCurrent: true },
    orderBy: { version: "desc" },
  });
  return row ? decodeConstraintSet(row) : null;
}

/** The user's stored play medium (M14), defaulting to "online" when unset. Drives the Seam-4
 *  modality/OTB and board interface-restriction recommendations. Read-only — needs only the
 *  ConstraintSet table. */
export async function getTargetFocus(
  db: Pick<PrismaClient, "constraintSet">,
  userId: string,
): Promise<TargetFocus> {
  const row = await db.constraintSet.findFirst({
    where: { userId, isCurrent: true },
    orderBy: { version: "desc" },
  });
  return row ? decodeConstraintSet(row).formatPrefs.targetFocus : "online";
}

/**
 * Save a new current ConstraintSet: validate, supersede any existing current row, bump
 * the version, and persist atomically. The if-then plan is normalised through the
 * Seam-9 provider fn (buildImplementationIntention) — onboarding step 6.
 */
export async function saveConstraints(
  db: Db,
  userId: string,
  rawInput: ConstraintsInput,
): Promise<ConstraintsInput & { id: string; version: number }> {
  const input = constraintsInputSchema.parse(rawInput);
  // Require at least one playing format so the generator has a format signal.
  // This is a UX/input-sanity rule (not a methodology value), enforced on save
  // so existing rows with empty formats still load and render.
  if (input.formatPrefs.formats.length === 0) {
    throw new Error(
      "Select at least one format you play (bullet, blitz, rapid, or classical).",
    );
  }
  const ifThenPlan = input.ifThenPlan
    ? buildImplementationIntention(input.ifThenPlan.cue, input.ifThenPlan.plan)
    : null;

  const created = await db.$transaction(async (tx) => {
    const latest = await tx.constraintSet.findFirst({
      where: { userId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await tx.constraintSet.updateMany({
      where: { userId, isCurrent: true },
      data: { isCurrent: false },
    });
    return tx.constraintSet.create({
      data: {
        userId,
        minutesPerDay: input.minutesPerDay,
        daysPerWeek: input.daysPerWeek,
        goals: input.goals as unknown as Prisma.InputJsonValue,
        ownedResources:
          input.ownedResources as unknown as Prisma.InputJsonValue,
        formatPrefs: input.formatPrefs as unknown as Prisma.InputJsonValue,
        sessionStyle: input.sessionStyle as unknown as Prisma.InputJsonValue,
        ifThenPlan: ifThenPlan
          ? (ifThenPlan as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        isCurrent: true,
        version: (latest?.version ?? 0) + 1,
      },
    });
  });

  return decodeConstraintSet(created);
}
