import { prisma } from "@/db/client";
import { PageShell } from "@/components/app-shell";
import { OnboardingSteps } from "@/app/onboarding/onboarding-steps";
import { getOnboardingStatus } from "@/server/onboarding";
import { getSession } from "@/server/session";

// Onboarding overview (BUILD.md §8). A linear, resumable flow: connect →
// calibrate → constraints → reveal → first program. M4 builds the calibration +
// constraints + reveal steps; the first program lands with the engine (M6).
export default async function OnboardingPage() {
  const session = await getSession();
  if (!session?.user) return null;
  const status = await getOnboardingStatus(prisma, session.user.id);

  return (
    <PageShell
      eyebrow="Setup"
      title="Set up your training"
      lede="Five steps to your first training session. You can change your choices later in Settings."
    >
      <OnboardingSteps status={status} />
    </PageShell>
  );
}
