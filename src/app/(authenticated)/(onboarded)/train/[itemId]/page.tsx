import { TrainItem } from "@/app/train/[itemId]/train-item";

interface TrainItemPageProps {
  params: Promise<{ itemId: string }>;
}

export default async function TrainItemPage({ params }: TrainItemPageProps) {
  const { itemId } = await params;

  return <TrainItem programItemId={itemId} />;
}
