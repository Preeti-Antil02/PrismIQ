"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/AuthContext";
import {
  EvidenceDrawer,
  type EvidenceDrawerItem,
} from "@/components/drawer/EvidenceDrawer";

interface EvidenceDrawerContextType {
  openDrawer: (item: EvidenceDrawerItem) => void;
  closeDrawer: () => void;
  isOpen: boolean;
  currentItem: EvidenceDrawerItem | null;
}

const EvidenceDrawerContext = React.createContext<EvidenceDrawerContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
  isOpen: false,
  currentItem: null,
});

export function useEvidenceDrawer() {
  const context = React.useContext(EvidenceDrawerContext);
  if (!context) {
    throw new Error("useEvidenceDrawer must be used within an AppShell");
  }
  return context;
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerData, setDrawerData] = React.useState<EvidenceDrawerItem | null>(null);

  React.useEffect(() => {
    if (!isLoading && !token && !user) {
      router.push("/login");
    }
  }, [isLoading, token, user, router]);

  const openDrawer = React.useCallback((item: EvidenceDrawerItem) => {
    setDrawerData(item);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
  }, []);

  if (isLoading || (!token && !user)) {
    return (
      <div className="min-h-screen bg-[#08090C] text-[#F3F4F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-[var(--cyan)] border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-zinc-400">Authenticating workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <EvidenceDrawerContext.Provider
      value={{
        openDrawer,
        closeDrawer,
        isOpen: drawerOpen,
        currentItem: drawerData,
      }}
    >
      <div className="min-h-screen bg-[#08090C] text-[#F3F4F6] flex flex-col md:flex-row antialiased selection:bg-blue-600/30 selection:text-white">
        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-[#0B0D12] border-b border-[rgba(255,255,255,0.06)] sticky top-0 z-40 shrink-0">
          <Link href="/app" className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-[0.14em] uppercase text-white">
              PRISMIQ
            </span>
            <span className="text-[10px] font-mono text-[#6B7280]">
              Intelligence
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 text-[#9CA3AF] hover:text-white rounded-[4px] hover:bg-[#151922] transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-[#08090C]/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Persistent Sidebar */}
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Region */}
        <main className="flex-1 min-w-0 bg-[#08090C] overflow-y-auto">
          {children}
        </main>

        {/* Evidence Drawer Inspection Slot */}
        <EvidenceDrawer
          isOpen={drawerOpen}
          onClose={closeDrawer}
          data={drawerData}
        />
      </div>
    </EvidenceDrawerContext.Provider>
  );
}
