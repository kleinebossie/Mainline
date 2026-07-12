import { PageShell } from "@/components/app-shell";
import { Today } from "@/app/today/today";

// The "Today" screen (BUILD.md §7.6, M6). Auth-gated. Shows the generated daily session —
// external-resource activities with difficulty params and a graded "why this / why now"
// for each (the honesty brand, VISION §2). The session adapts as outcomes are logged (M7).
export default function TodayPage() {
  return (
    <PageShell
      eyebrow="Your daily session"
      title="Today"
      lede="Every line is here for a reason, and shows exactly how strong that reason is. Do the work, log the outcome, and tomorrow adapts."
    >
      <Today />
    </PageShell>
  );
}
