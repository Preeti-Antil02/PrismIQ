import { SignalsWorkspace } from "@/components/signals/SignalsWorkspace";

export const metadata = {
  title: "Signals | PrismIQ — Evidence Exploration Workspace",
  description: "Individual evidence detected across monitored channels.",
};

export default function SignalsPage() {
  return <SignalsWorkspace />;
}
