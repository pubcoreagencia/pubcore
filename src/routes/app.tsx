import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { PontoHeader } from "@/components/PontoHeader";
import { PontoAutoTracker } from "@/components/PontoAutoTracker";
import { CalculatorWidget } from "@/components/CalculatorWidget";
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
            <CalculatorWidget />

          <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
            <Sidebar />
            <main
              className="flex-1 min-w-0 max-w-full relative flex flex-col overflow-x-hidden pb-[calc(env(safe-area-inset-bottom)+64px)] md:pb-0"
            >
              <MobileNav />
              <PontoHeader />
              <Outlet />
            </main>
          </div>
        </ChecklistProvider>
      </PontoProvider>
    </WorkspaceProvider>
  );
}
