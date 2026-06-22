import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PageShell } from "@/components/app-shell";
import { TrainItem } from "./train-item";

interface TrainItemPageProps {
  params: Promise<{ itemId: string }>;
}

export default async function TrainItemPage({ params }: TrainItemPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { itemId } = await params;

  return (
    <PageShell width="default">
      <TrainItem programItemId={itemId} />
    </PageShell>
  );
}
