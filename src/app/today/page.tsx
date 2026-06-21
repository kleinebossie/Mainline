import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { buttonVariants } from "@/components/ui/button";
import { Today } from "@/app/today/today";

// The "Today" screen (BUILD.md §7.6, M6). Auth-gated. Shows the generated daily session —
// external-resource activities with difficulty params and a graded "why this / why now"
// for each (the honesty brand, VISION §2). The session adapts as outcomes are logged (M7).
export default async function TodayPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Today</h1>
          <p className="text-muted-foreground text-sm">
            Your training session — every item explains itself and shows how
            strong the evidence is.
          </p>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Dashboard
          </Link>
          <Link
            href="/onboarding"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Onboarding
          </Link>
        </nav>
      </header>

      <Today />
    </main>
  );
}
