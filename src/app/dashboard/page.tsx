import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { buttonVariants } from "@/components/ui/button";
import { Dashboard } from "@/app/dashboard/dashboard";

// Imported-data dashboard (BUILD.md M2). Auth-gated. Lists imported games + current
// ratings and offers an on-demand "Sync now". Display only — no chess/learning
// judgement (that arrives with the program engine, M6).
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Your imported games and ratings. Training plans arrive in a later
            milestone.
          </p>
        </div>
        <Link href="/connections" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Connections
        </Link>
      </header>

      <Dashboard />
    </main>
  );
}
