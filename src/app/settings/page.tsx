import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PageShell } from "@/components/app-shell";
import { ConstraintsForm } from "@/app/onboarding/constraints/constraints-form";
import { AnalysisRunner } from "@/app/settings/analysis-runner";
import { AccountActions } from "@/app/settings/account-actions";

// Settings (VISION §5/§7). Auth-gated. The post-onboarding home for everything you tune
// about your training and your account: edit your plan (time/goals/preferences — the same
// form onboarding uses), run game analysis, and export or erase your data.
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PageShell
      eyebrow="Tune your training & account"
      title="Settings"
      lede="Change anything, anytime. Your constraints feed the next session the moment you save."
    >
      <div className="flex flex-col gap-14">
        <section className="flex flex-col gap-4">
          <h2 className="eyebrow border-b border-line/80 pb-3">Your plan</h2>
          <p className="text-graphite text-sm leading-relaxed font-serif">
            Time, goals, formats and your if-then plan. Saving updates the
            program. Regenerate Today to see it reflected.
          </p>
          <ConstraintsForm
            continueHref="/today"
            continueLabel="Go to Today →"
          />
        </section>

        <AnalysisRunner />

        <AccountActions />
      </div>
    </PageShell>
  );
}
