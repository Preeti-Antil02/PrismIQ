"use client";

import * as React from "react";
import { ComparePage } from "@/components/app/ComparePage";
import { PrismLoadingSkeleton } from "@/components/app/PrismPrimitives";

export default function Page() {
  return (
    <React.Suspense fallback={<PrismLoadingSkeleton count={3} />}>
      <ComparePage />
    </React.Suspense>
  );
}
