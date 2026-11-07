import { PageShell } from "@/components/app-shell";
import { ConstraintsForm } from "@/app/onboarding/constraints/constraints-form";
import { AnalysisRunner } from "@/app/settings/analysis-runner";
import { AccountActions } from "@/app/settings/account-actions";
import { OperationsPanel } from "@/app/settings/operations-panel";
import { FeedbackPanel } from "@/app/settings/feedback-panel";
import { AppearanceAndBoard } from "@/app/settings/appearance-and-board";
import { ConnectionsManager } from "@/app/connections/connections-manager";
import { Surface } from "@/components/ui/surface";
import { prisma } from "@/db/client";
import { getSession } from "@/server/session";
import { loadMethodology, rationaleFor } from "@/methodology";

// Settings (VISION §5/§7). Auth-gated with guest support.
// Manages constraints, appearance, board style, sound, accounts, and privacy.
export default async function SettingsPage() {
  const session = await getSession();
  const account = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
    : null;
  const ifThenRationale = rationaleFor("if_then_plan", loadMethodology());

  return (
    <PageShell
      eyebrow="Training and account controls"
      title="Settings"
      lede="Set real constraints, adjust board and sound, manage accounts, and export your data."
    >
      {/* Quick jump navigation */}
      <nav aria-label="Settings sections" className="mb-8 flex flex-wrap gap-2">
        <a
          href="#plan"
          className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-xs font-mono text-ink transition-colors hover:border-line-emphasis"
        >
          Plan constraints
        </a>
        <a
          href="#appearance"
          className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-xs font-mono text-ink transition-colors hover:border-line-emphasis"
        >
          Appearance & board
        </a>
        <a
          href="#accounts"
          className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-xs font-mono text-ink transition-colors hover:border-line-emphasis"
        >
          Connected accounts
        </a>
        <a
          href="#feedback"
          className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-xs font-mono text-ink transition-colors hover:border-line-emphasis"
        >
          Send feedback
        </a>
        <a
          href="#analysis"
          className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-xs font-mono text-ink transition-colors hover:border-line-emphasis"
        >
          Run analysis
        </a>
        <a
          href="#data"
          className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-xs font-mono text-ink transition-colors hover:border-line-emphasis"
        >
          Privacy & data
        </a>
        {account?.role === "admin" && (
          <a
            href="#admin"
            className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-xs font-mono text-ink transition-colors hover:border-line-emphasis"
          >
            System operations
          </a>
        )}
      </nav>

      <div className="flex flex-col gap-14">
        {/* Plan constraints */}
        <section id="plan" className="scroll-mt-24 flex flex-col gap-4">
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

        {/* Appearance & Board */}
        <section id="appearance" className="scroll-mt-24 flex flex-col gap-4">
          <h2 className="eyebrow border-b border-line/80 pb-3">Appearance & board</h2>
          <AppearanceAndBoard />
        </section>

        {/* Accounts / Connections */}
        <section id="accounts" className="scroll-mt-24 flex flex-col gap-4">
          <h2 className="eyebrow border-b border-line/80 pb-3">Accounts</h2>
          <Surface raised={false} className="p-6">
            <ConnectionsManager />
          </Surface>
        </section>

        {/* Feedback */}
        <section id="feedback" className="scroll-mt-24 flex flex-col gap-4">
          <h2 className="eyebrow border-b border-line/80 pb-3">Feedback</h2>
          <FeedbackPanel />
        </section>

        {/* Analysis */}
        <section id="analysis" className="scroll-mt-24 flex flex-col gap-4">
          <h2 className="eyebrow border-b border-line/80 pb-3">Analysis</h2>
          <AnalysisRunner />
        </section>

        {/* Privacy and data */}
        <AccountActions />

        {/* Operations for admins */}
        {account?.role === "admin" && (
          <section id="admin" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="eyebrow border-b border-line/80 pb-3">Operations</h2>
            <OperationsPanel />
          </section>
        )}
      </div>
    </PageShell>
  );
}
