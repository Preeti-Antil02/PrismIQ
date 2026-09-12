import { BriefView } from "@/components/brief/BriefView";

export default async function HistoricalBriefPage({
  params,
}: {
  params: Promise<{ briefId: string }>;
}) {
  const { briefId } = await params;
  return <BriefView initialBriefId={briefId} />;
}
