import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PageShell } from "@/components/app-shell";
import { OnboardingSteps } from "@/app/onboarding/onboarding-steps";

// Onboarding overview (BUILD.md §8). A linear, resumable flow: connect → import →
// calibrate → constraints → reveal → first program. M4 builds the calibration +
// constraints + reveal steps; the first program lands with the engine (M6).
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PageShell
      eyebrow="Onboarding"
      title="Set up your training"
      lede="A few quick steps. You can stop and come back at any time — your progress is saved."
    >
      <OnboardingSteps />
    </PageShell>
  );
}
