"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, RotateCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IntelligenceDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-4">
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-rose-950 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-900">
              Unable to Load Intelligence Profile
            </h3>
            <p className="text-xs text-rose-700 mt-0.5">
              {error?.message || "An unexpected error occurred while loading this competitor profile."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reset()}
            className="bg-white border-rose-300 text-rose-900 hover:bg-rose-50"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            Retry Connection
          </Button>
          <Link
            href="/app/overview"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-900 hover:text-rose-950 underline px-2 py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
