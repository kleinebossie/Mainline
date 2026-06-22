import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PageShell } from "@/components/app-shell";
import { Dashboard } from "@/app/dashboard/dashboard";
import { AnalysisRunner } from "@/app/dashboard/analysis-runner";
import { TransparencyDashboard } from "@/app/dashboard/transparency-dashboard";
import { EngagementPanel } from "@/app/dashboard/engagement-panel";

// Imported-data dashboard (BUILD.md M2 + M8 + M9). Auth-gated. Lists imported games + current
// ratings, on-demand "Sync now" and client-side analysis, the transparency dashboard (skill
// estimates, due reviews, the engine's adaptation log, honest expectations), then the
// engagement panel (forgiving consistency streak, grid, recognition, capped reminders).
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PageShell
      eyebrow="Your data & the engine's reasoning"
      title="Dashboard"
      lede="The raw picture Mainline builds from: your ratings, your games, the measurements, and every adjustment the engine has made — with its evidence shown."
      width="wide"
    >
      <div className="flex flex-col gap-14">
        <Dashboard />
        <AnalysisRunner />
        <TransparencyDashboard />
        <section className="flex flex-col gap-4">
          <h2 className="eyebrow border-b border-line/80 pb-3">
            Consistency & motivation
          </h2>
          <EngagementPanel />
        </section>
      </div>
    </PageShell>
  );
}
