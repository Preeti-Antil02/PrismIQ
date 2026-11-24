"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { CompetitorIntelligenceDetailView } from "@/components/app/intelligence/CompetitorIntelligenceDetailView";

export default function IntelligenceDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "overview";
  return <CompetitorIntelligenceDetailView detailId={id} />;
}
