import { AppLayout } from "@/components/layout/AppLayout";
import { NotAvailableState } from "@/components/states";

export default function TrendsPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <NotAvailableState
          featureName="Trend Evolution Timeline"
          reason="Requires accumulating at least 4 consecutive weekly monitoring cycles. This route is reserved to prevent fabricated projections."
          type="history"
        />
      </div>
    </AppLayout>
  );
}
