import { PageShell } from "@/components/app-shell";
import { TrainItem } from "@/app/train/[itemId]/train-item";

interface TrainItemPageProps {
  params: Promise<{ itemId: string }>;
}

export default async function TrainItemPage({ params }: TrainItemPageProps) {
  const { itemId } = await params;

  return (
    <PageShell width="wide">
      <TrainItem programItemId={itemId} />
    </PageShell>
  );
}
