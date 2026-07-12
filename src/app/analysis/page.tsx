import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { prisma } from "@/db/client";
import { AnalysisDashboard } from "@/app/analysis/analysis-dashboard";
import { requireOnboardingComplete } from "@/server/onboarding";

// The Game Analysis suggestions page (BUILD.md M10). Auth-gated.
// Shows suggested wins/losses for analysis with the success-bias rationale.
export default async function AnalysisPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  await requireOnboardingComplete(prisma, session.user.id);

  return <AnalysisDashboard />;
}
