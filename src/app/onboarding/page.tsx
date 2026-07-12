import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { prisma } from "@/db/client";
import { PageShell } from "@/components/app-shell";
import { OnboardingSteps } from "@/app/onboarding/onboarding-steps";
import { getOnboardingStatus } from "@/server/onboarding";

// Onboarding overview (BUILD.md §8). A linear, resumable flow: connect →
// calibrate → constraints → reveal → first program. M4 builds the calibration +
// constraints + reveal steps; the first program lands with the engine (M6).
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const status = await getOnboardingStatus(prisma, session.user.id);

  return (
    <PageShell
      eyebrow="Onboarding"
      title="Set up your training"
      lede="A few quick steps to personalise your training. Complete all steps to unlock your daily sessions. You can change anything later in Settings."
    >
      <OnboardingSteps status={status} />
    </PageShell>
  );
}
