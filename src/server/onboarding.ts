// Onboarding guard (BUILD.md §8). The onboarding flow is mandatory: a user must
// connect a chess account, complete the tactical calibration, and save constraints
// with at least one format before they can reach the training surfaces. This module
// centralises the completion check so every protected page calls the same logic.
//
// No graded decision here (L1): this is orchestration that reads DB state and
// redirects. The definition of "complete" is structural, not a methodology value.

import { redirect } from "next/navigation";

import type { PrismaClient } from "@prisma/client";

import { formatPrefsSchema } from "@/lib/constraints";

type Db = Pick<
  PrismaClient,
  "platformConnection" | "assessment" | "constraintSet"
>;

export interface OnboardingStep {
  readonly href: string;
  readonly label: string;
  readonly done: boolean;
}

export interface OnboardingStatus {
  /** True once every required step is complete. */
  readonly complete: boolean;
  /** The first incomplete step, or null when all are done. */
  readonly nextStep: OnboardingStep | null;
  readonly steps: readonly OnboardingStep[];
}

/**
 * Check whether the user has completed all mandatory onboarding steps.
 * The three required steps are: connect a chess account, complete the tactical
 * calibration, and save constraints with at least one playing format.
 */
export async function getOnboardingStatus(
  db: Db,
  userId: string,
): Promise<OnboardingStatus> {
  const [connectionCount, assessment, constraintRow] = await Promise.all([
    db.platformConnection.count({ where: { userId, status: "active" } }),
    db.assessment.findUnique({
      where: { userId },
      select: { completedAt: true },
    }),
    db.constraintSet.findFirst({
      where: { userId, isCurrent: true },
      orderBy: { version: "desc" },
      select: { formatPrefs: true },
    }),
  ]);

  const hasConnection = connectionCount > 0;
  const hasCalibration = assessment?.completedAt != null;
  const parsed = formatPrefsSchema.safeParse(constraintRow?.formatPrefs);
  const hasConstraints = parsed.success && parsed.data.formats.length > 0;

  const steps: OnboardingStep[] = [
    {
      href: "/connections",
      label: "Connect a chess account",
      done: hasConnection,
    },
    {
      href: "/onboarding/calibration",
      label: "Tactical calibration",
      done: hasCalibration,
    },
    {
      href: "/onboarding/constraints",
      label: "Your time, goals & formats",
      done: hasConstraints,
    },
  ];

  const nextStep = steps.find((s) => !s.done) ?? null;

  return {
    complete: nextStep === null,
    nextStep,
    steps,
  };
}

/**
 * Redirect to /onboarding if the user has not completed all required steps.
 * Call this in protected page server components (after the auth check).
 */
export async function requireOnboardingComplete(
  db: Db,
  userId: string,
): Promise<void> {
  const status = await getOnboardingStatus(db, userId);
  if (!status.complete) redirect("/onboarding");
}
