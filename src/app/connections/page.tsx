import { redirect } from "next/navigation";

import { auth, signIn, signOut } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/app-shell";
import { ConnectionsManager } from "@/app/connections/connections-manager";

// Connection management (BUILD.md M1). Auth-gated. Lichess is linked through the
// OAuth flow (server action below); Chess.com (username) + the connection list and
// disconnect are handled by the client manager via tRPC.
export default async function ConnectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PageShell
      eyebrow="Game sources"
      title="Connections"
      lede={
        <span className="flex flex-wrap items-center justify-between gap-4">
          <span>Link your chess accounts so Mainline can analyse your games.</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            className="shrink-0"
          >
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </span>
      }
    >
      <div className="flex flex-col gap-12">
        <section className="flex flex-col gap-4">
          <h2 className="eyebrow border-b border-line/80 pb-3">Lichess</h2>
          <p className="text-graphite text-sm leading-relaxed font-serif">
            Connects via Lichess OAuth (read-only). Imports games and puzzle
            history.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("lichess", { redirectTo: "/connections" });
            }}
          >
            <Button type="submit">
              Connect Lichess
            </Button>
          </form>
        </section>

        <ConnectionsManager />
      </div>
    </PageShell>
  );
}
