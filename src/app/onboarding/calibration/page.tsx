import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PageShell } from "@/components/app-shell";
import { Calibration } from "@/app/onboarding/calibration/calibration";

// Tactical calibration step (BUILD.md §8 step 5 · Seam 2). Adaptive ladder; the item
// difficulty comes from the methodology (nextCalibrationItem), the estimate from
// scoreCalibration — both graded. Self-report is never used for skill (Seam 2).
export default async function CalibrationPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PageShell
      width="wide"
      eyebrow="Step 2 of onboarding"
      title="Tactical calibration"
      lede="We don't ask you to rate yourself. Self-assessment is unreliable (Dunning-Kruger). This short check estimates your tactical level from how you actually solve."
    >
      <Calibration />
    </PageShell>
  );
}
