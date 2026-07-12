import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { prisma } from "@/db/client";
import { PageShell } from "@/components/app-shell";
import { TrainItem } from "./train-item";
import { requireOnboardingComplete } from "@/server/onboarding";

interface TrainItemPageProps {
  params: Promise<{ itemId: string }>;
}

export default async function TrainItemPage({ params }: TrainItemPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  await requireOnboardingComplete(prisma, session.user.id);

  const { itemId } = await params;

  return (
    <PageShell width="wide">
      <TrainItem programItemId={itemId} />
    </PageShell>
  );
}
