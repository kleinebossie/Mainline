import { PageShell } from "@/components/app-shell";
import { Calibration } from "@/app/onboarding/calibration/calibration";

// Tactical calibration step (BUILD.md §8 step 5 · Seam 2). Adaptive ladder; the item
// difficulty comes from the methodology (nextCalibrationItem), the estimate from
// scoreCalibration — both graded. Self-report is never used for skill (Seam 2).
export default function CalibrationPage() {
  return (
    <PageShell
      width="wide"
      eyebrow="Step 3 of setup"
      title="Tactical calibration"
      lede="We don't ask you to rate yourself. This short adaptive puzzle check builds a rough behavioural baseline from how you actually solve."
    >
      <Calibration />
    </PageShell>
  );
}
