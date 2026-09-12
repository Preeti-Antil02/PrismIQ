import { AppLayout } from "@/components/layout/AppLayout";
import { NotAvailableState } from "@/components/states";

export default function BattleCardsPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <NotAvailableState
          featureName="Competitor Battle Cards"
          reason="Direct head-to-head tactical positioning cards require accumulating continuous positioning and pricing history. This route is reserved — never rendered as a mock preview."
          type="history"
        />
      </div>
    </AppLayout>
  );
}
