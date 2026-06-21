import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { Reveal } from "@/app/onboarding/reveal/reveal";

// The "reveal" (BUILD.md §8 step 7). A data-driven dashboard that contrasts objective
// signals with common self-bias (gracefully defuses Dunning-Kruger). M4 ships the
// scaffold: it surfaces the behavioural calibration estimate honestly; game-feature
// interpretation (Seam 3) lands with analysis (M5) and the program engine (M6).
export default async function RevealPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Where you stand</h1>
        <p className="text-muted-foreground text-sm">
          Built from what you do, not what you say. We&apos;ll never overstate
          how strong the evidence is.
        </p>
      </header>
      <Reveal />
    </main>
  );
}
