import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PageShell } from "@/components/app-shell";
import { Dashboard } from "@/app/progress/dashboard";
import { TransparencyDashboard } from "@/app/progress/transparency-dashboard";
import { EngagementPanel } from "@/app/progress/engagement-panel";

// Progress (BUILD.md M2 + M8 + M9). Auth-gated. The honest read-out: current ratings + recent
// games, the transparency dashboard (skill estimates, due reviews, the engine's adaptation log,
// realistic expectations), and the engagement panel (forgiving consistency, recognition). This
// is a read-only story — the maintenance action (client-side analysis) lives in Settings.
export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PageShell
      eyebrow="Where you stand & why"
      title="Progress"
      lede="The picture Mainline builds from — your ratings, your games, the measurements, and every adjustment the engine has made, each with its evidence shown."
      width="wide"
    >
      <div className="flex flex-col gap-14">
        <Dashboard />
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
