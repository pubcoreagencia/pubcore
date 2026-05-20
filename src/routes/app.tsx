import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { PontoHeader } from "@/components/PontoHeader";
import { PontoAutoTracker } from "@/components/PontoAutoTracker";
import { CalculatorWidget } from "@/components/CalculatorWidget";
import { StickyNotesWidget } from "@/components/StickyNotesWidget";
import { GratitudePanel } from "@/components/GratitudePanel";
import { useAuth } from "@/lib/auth";
import { PontoProvider } from "@/lib/ponto";
import { ChecklistProvider } from "@/lib/checklist-store";
import { WorkspaceProvider } from "@/lib/workspace";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando…</div>
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <PontoProvider>
        <ChecklistProvider>
          <PontoAutoTracker />
          <div className="hidden md:block">
            <CalculatorWidget />
            <StickyNotesWidget />
          </div>


          <div className="flex min-h-dvh w-full max-w-[100dvw] bg-background overflow-x-hidden">
            <Sidebar />
            <main className="relative flex w-full min-w-0 max-w-[100dvw] flex-1 flex-col overflow-x-hidden pb-[calc(env(safe-area-inset-bottom)+64px)] md:max-w-full md:pb-0">
              <MobileNav />
              <PontoHeader />
              <div className="w-full min-w-0 max-w-full overflow-x-hidden">
                <Outlet />
              </div>
            </main>
          </div>
        </ChecklistProvider>
      </PontoProvider>
    </WorkspaceProvider>
  );
}
