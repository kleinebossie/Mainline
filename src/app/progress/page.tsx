import { redirect } from "next/navigation";

import { PageShell } from "@/components/app-shell";
import { auth } from "@/server/auth";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PageShell
      eyebrow="Training signals"
      title="Progress"
      lede="This surface is reserved for process progress and rating-noise caveats. Today stays focused on the session."
    >
      <div className="rounded-lg border bg-card p-5 shadow-sheet">
        <p className="text-graphite text-sm leading-relaxed">
          Progress reporting is being shaped around consistency, completed work,
          review health, and honest uncertainty before it returns here.
        </p>
      </div>
    </PageShell>
  );
}
