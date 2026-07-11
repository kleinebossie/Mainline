import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PageShell } from "@/components/app-shell";
import { ConnectionsManager } from "@/app/connections/connections-manager";

// Connection management (BUILD.md M1). Auth-gated. Platform usernames and the
// connection list are handled by the client manager via tRPC.
export default async function ConnectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PageShell
      eyebrow="Game sources"
      title="Connections"
      lede="Link your chess accounts so Mainline can analyse your games."
    >
      <ConnectionsManager />
    </PageShell>
  );
}
