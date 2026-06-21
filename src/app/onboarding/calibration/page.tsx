import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { Calibration } from "@/app/onboarding/calibration/calibration";

// Tactical calibration step (BUILD.md §8 step 5 · Seam 2). Adaptive ladder; the item
// difficulty comes from the methodology (nextCalibrationItem), the estimate from
// scoreCalibration — both graded. Self-report is never used for skill (Seam 2).
export default async function CalibrationPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Tactical calibration
        </h1>
        <p className="text-muted-foreground text-sm">
          We don&apos;t ask you to rate yourself — self-assessment is unreliable
          (Dunning-Kruger). This short check estimates your tactical level from
          how you actually solve.
        </p>
      </header>
      <Calibration />
    </main>
  );
}
