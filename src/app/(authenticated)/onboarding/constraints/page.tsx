import { PageShell } from "@/components/app-shell";
import { ConstraintsForm } from "@/app/onboarding/constraints/constraints-form";
import { loadMethodology, rationaleFor } from "@/methodology";

// Constraints step (BUILD.md §8 step 6 · §5.4). Captures the user's reality — time,
// cadence, goals, format preferences, and a Seam-9 if-then plan. Everything here is
// constraints/goals self-report (allowed); skill is never self-reported (Seam 2).
export default function ConstraintsPage() {
  const ifThenRationale = rationaleFor("if_then_plan", loadMethodology());

  return (
    <PageShell
      eyebrow="Step 3 of onboarding"
      title="Your time & goals"
      lede="This shapes how much Mainline plans each day and what we prioritise. You can change these constraints at any time."
    >
      <ConstraintsForm ifThenRationale={ifThenRationale} />
    </PageShell>
  );
}
