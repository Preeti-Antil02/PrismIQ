"use client";

import * as React from "react";
import { DeliveryPage } from "@/components/app/DeliveryPage";

export default function Page() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-[#70717a]">Loading delivery operations...</div>}>
      <DeliveryPage />
    </React.Suspense>
  );
}
