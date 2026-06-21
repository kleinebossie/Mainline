import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { ConstraintsForm } from "@/app/onboarding/constraints/constraints-form";

// Constraints step (BUILD.md §8 step 6 · §5.4). Captures the user's reality — time,
// cadence, goals, format preferences, and a Seam-9 if-then plan. Everything here is
// constraints/goals self-report (allowed); skill is never self-reported (Seam 2).
export default async function ConstraintsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Your time & goals</h1>
        <p className="text-muted-foreground text-sm">
          This shapes how much we plan each day and what we prioritise. You can
          change it anytime.
        </p>
      </header>
      <ConstraintsForm />
    </main>
  );
}
