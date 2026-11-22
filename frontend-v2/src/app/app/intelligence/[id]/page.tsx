import { CompetitorIntelligenceDetailView } from "@/components/app/intelligence/CompetitorIntelligenceDetailView";

export default async function IntelligenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompetitorIntelligenceDetailView detailId={id} />;
}
