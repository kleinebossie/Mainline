import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { OnboardingSteps } from "@/app/onboarding/onboarding-steps";

// Onboarding overview (BUILD.md §8). A linear, resumable flow: connect → import →
// calibrate → constraints → reveal → first program. M4 builds the calibration +
// constraints + reveal steps; the first program lands with the engine (M6).
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Set up your training</h1>
        <p className="text-muted-foreground text-sm">
          A few quick steps. You can stop and come back — your progress is saved.
        </p>
      </header>
      <OnboardingSteps />
    </main>
  );
}
