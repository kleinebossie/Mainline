import { PageShell } from "@/components/app-shell";
import { ConstraintsForm } from "@/app/onboarding/constraints/constraints-form";
import { AnalysisRunner } from "@/app/settings/analysis-runner";
import { AccountActions } from "@/app/settings/account-actions";
import { OperationsPanel } from "@/app/settings/operations-panel";
import { FeedbackPanel } from "@/app/settings/feedback-panel";
import { prisma } from "@/db/client";
import { getSession } from "@/server/session";
import { loadMethodology, rationaleFor } from "@/methodology";

// Settings (VISION §5/§7). Auth-gated. The post-onboarding home for constraints,
// assessment, delivery-fit feedback, analysis, and account controls.
export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user) return null;
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  const ifThenRationale = rationaleFor("if_then_plan", loadMethodology());

  return (
    <PageShell
      eyebrow="Training and account controls"
      title="Settings"
      lede="Set real constraints, review assessment inputs, and tell Mainline where delivery can improve."
    >
      <div className="flex flex-col gap-14">
        <section className="flex flex-col gap-4">
          <h2 className="eyebrow border-b border-line/80 pb-3">Your plan</h2>
          <p className="text-graphite text-sm leading-relaxed font-serif">
            Time, goals, formats and your if-then plan. Saving updates the
            program. Regenerate Today to see it reflected.
          </p>
          <ConstraintsForm
            ifThenRationale={ifThenRationale}
            continueHref="/today"
            continueLabel="Go to Today →"
          />
        </section>

        <section id="feedback" className="scroll-mt-24 flex flex-col gap-4">
          <h2 className="eyebrow border-b border-line/80 pb-3">Feedback</h2>
          <FeedbackPanel />
        </section>

        <AnalysisRunner />

        <AccountActions />

        {account?.role === "admin" && <OperationsPanel />}
      </div>
    </PageShell>
  );
}
