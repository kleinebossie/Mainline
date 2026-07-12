import { redirect } from "next/navigation";

import { PageShell } from "@/components/app-shell";
import { loadMethodology, rationaleFor } from "@/methodology";
import { auth } from "@/server/auth";
import { prisma } from "@/db/client";
import { ProgressDashboard } from "@/app/progress/progress-dashboard";
import { requireOnboardingComplete } from "@/server/onboarding";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  await requireOnboardingComplete(prisma, session.user.id);
  const cfg = loadMethodology();
  const progressCopy = rationaleFor("progress_surface", cfg);

  return (
    <PageShell title="Progress" lede={progressCopy.value} width="wide">
      <ProgressDashboard />
    </PageShell>
  );
}
