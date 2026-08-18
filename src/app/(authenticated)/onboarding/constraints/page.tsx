import { PageShell } from "@/components/app-shell";
import { OnboardingConstraintsForm } from "@/app/onboarding/constraints/onboarding-constraints-form";

// Constraints step (BUILD.md §8 step 6 · §5.4). Captures core user constraints:
// time budget, primary game format, and screen vs physical board modality.
// Advanced settings (book libraries, if-then plans, interleaving) live in Settings.
export default function ConstraintsPage() {
  return (
    <PageShell
      eyebrow="Step 1 of setup"
      title="Your training constraints"
      lede="Three simple choices to shape your daily training. You can customize books, interleaving, and habit cues in Settings at any time."
    >
      <OnboardingConstraintsForm
        continueHref="/connections"
        continueLabel="Continue setup →"
      />
    </PageShell>
  );
}
