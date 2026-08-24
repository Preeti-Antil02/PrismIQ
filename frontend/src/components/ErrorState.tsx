import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-8 text-center max-w-lg mx-auto my-12 space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-900/40 text-rose-400">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-white">
        Unable to Load Intelligence Brief
      </h3>
      <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
        {message || "The competitive intelligence service could not be reached. Ensure the backend is running at http://127.0.0.1:8000."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-all hover:bg-[#E5E5E5] active:scale-98 shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}
