import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { PontoHeader } from "@/components/PontoHeader";
import { useAuth } from "@/lib/auth";
import { PontoProvider } from "@/lib/ponto";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (user === null) {
      const raw = typeof window !== "undefined" ? localStorage.getItem("pubcore_user") : null;
      if (!raw) nav({ to: "/login" });
    }
  }, [user, nav]);

  return (
    <PontoProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <main className="flex-1 min-w-0 bg-glow relative">
          <PontoHeader />
          <Outlet />
        </main>
      </div>
    </PontoProvider>
  );
}
