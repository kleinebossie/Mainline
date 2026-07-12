import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getSession } from "@/server/session";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/signin");

  return children;
}
