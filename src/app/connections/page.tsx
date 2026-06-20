import { redirect } from "next/navigation";

import { auth, signIn, signOut } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { ConnectionsManager } from "@/app/connections/connections-manager";

// Connection management (BUILD.md M1). Auth-gated. Lichess is linked through the
// OAuth flow (server action below); Chess.com (username) + the connection list and
// disconnect are handled by the client manager via tRPC.
export default async function ConnectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground text-sm">
            Link your chess accounts so the app can analyse your games.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Lichess</h2>
          <p className="text-muted-foreground text-sm">
            Connects via Lichess OAuth (read-only). Imports games and puzzle
            history.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("lichess", { redirectTo: "/connections" });
          }}
        >
          <Button type="submit" variant="outline">
            Connect Lichess
          </Button>
        </form>
      </section>

      <ConnectionsManager />
    </main>
  );
}
