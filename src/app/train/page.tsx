import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { prisma } from "@/db/client";
import { requireOnboardingComplete } from "@/server/onboarding";
import { TrainDemo } from "@/app/train/train-demo";

// The standalone training demo (BUILD.md M13). Auth-gated and onboarding-gated.
export default async function TrainPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  await requireOnboardingComplete(prisma, session.user.id);

  return <TrainDemo />;
}
