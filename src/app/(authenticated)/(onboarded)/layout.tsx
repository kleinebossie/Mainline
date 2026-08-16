import type { ReactNode } from "react";

import { prisma } from "@/db/client";
import { requireOnboardingComplete } from "@/server/onboarding";
import { getSession } from "@/server/session";

export default async function OnboardedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) return null;

  if (session.user.onboarded === true) {
    return children;
  }

  await requireOnboardingComplete(prisma, session.user.id);
  return children;
}
