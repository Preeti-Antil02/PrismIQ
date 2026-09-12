import { AppLayout } from "@/components/layout/AppLayout";
import { NotAvailableState } from "@/components/states";

export default function ScenariosPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <NotAvailableState
          featureName="Strategic Scenario Trees"
          reason="Predictive forward-branching competitive scenario simulations are reserved pending multi-month trend corroboration models. Never displayed as an ungrounded preview."
          type="history"
        />
      </div>
    </AppLayout>
  );
}
