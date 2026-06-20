import Link from "next/link";

import { auth } from "@/server/auth";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Mainline</h1>
      <p className="text-muted-foreground max-w-md text-center">
        Personalized, science-based, no-BS chess training. Connect a chess
        account to get started — the program engine and methodology land in
        later milestones.
      </p>
      <Link
        href={session?.user ? "/dashboard" : "/signin"}
        className={buttonVariants()}
      >
        {session?.user ? "Open dashboard" : "Get started"}
      </Link>
    </main>
  );
}
