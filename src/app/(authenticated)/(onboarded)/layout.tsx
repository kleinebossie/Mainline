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
  if (!session?.user) {
    // Guest mode: visitors can explore Today and training drills
    return children;
  }

  await requireOnboardingComplete(prisma, session.user.id);
  return children;
}
