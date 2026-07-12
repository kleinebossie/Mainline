import { PageShell } from "@/components/app-shell";
import { loadMethodology, rationaleFor } from "@/methodology";
import { ProgressDashboard } from "@/app/progress/progress-dashboard";

export default function ProgressPage() {
  const cfg = loadMethodology();
  const progressCopy = rationaleFor("progress_surface", cfg);

  return (
    <PageShell title="Progress" lede={progressCopy.value} width="wide">
      <ProgressDashboard />
    </PageShell>
  );
}
