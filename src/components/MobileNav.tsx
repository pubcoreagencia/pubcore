import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, KanbanSquare, ListChecks, Calendar, StickyNote, Wallet, Boxes,
  Users2, Calculator, Settings, LogOut, MoreHorizontal, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type Tab = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const PRIMARY: Tab[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/checklists", label: "Tarefas", icon: ListChecks },
  { to: "/app/kanban", label: "Kanban", icon: KanbanSquare },
  { to: "/app/notes", label: "Notas", icon: StickyNote },
  { to: "/app/finance", label: "Finanças", icon: Wallet },
  { to: "/app/stock", label: "Estoque", icon: Boxes },
  { to: "/app/calendar", label: "Agenda", icon: Calendar },
];

const SECONDARY: Tab[] = [
  { to: "/app/crm", label: "CRM", icon: Users2 },
  { to: "/app/calculator", label: "Calculadora", icon: Calculator },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];

export function MobileNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const { isMaster } = useWorkspace();
  const nav = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setMoreOpen(false); }, [path]);

  useEffect(() => {
    if (moreOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [moreOpen]);

  const isActive = (t: Tab) => (t.exact ? path === t.to : path.startsWith(t.to));
  const moreActive = SECONDARY.some(isActive);

  const handleLogout = async () => {
    setMoreOpen(false);
    await logout();
    nav({ to: "/login" });
  };

  return (
    <>
      {/* Top bar mobile (compacto) */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-sidebar-border bg-background/85 backdrop-blur-md">
        <Link to="/app" className="flex items-center gap-2">
          <img src="/favicon.ico" alt="PUB" className="h-7 w-auto" />
          <div className="font-display font-semibold tracking-tight text-foreground text-sm">
            PUB <span className="text-primary">CORE</span>
          </div>
        </Link>
        {isMaster ? (
          <div className="max-w-[55%]"><WorkspaceSwitcher /></div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
            {user?.name?.[0] ?? "U"}
          </div>
        )}
      </header>

      {/* Bottom navigation bar (estilo app nativo) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-sidebar-border bg-background/90 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação principal"
      >
        <div className="grid grid-cols-8 h-14">
          {PRIMARY.map((t) => {
            const active = isActive(t);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="relative flex flex-col items-center justify-center gap-0.5 px-0.5 transition-colors active:bg-secondary/40"
              >
                <span
                  className={`absolute top-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300 ${
                    active ? "w-8 bg-primary opacity-100" : "w-0 bg-transparent opacity-0"
                  }`}
                />
                <Icon
                  className={`h-[18px] w-[18px] transition-all duration-200 ${
                    active ? "text-primary scale-110" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-[9px] font-medium leading-none truncate max-w-full transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground/80"
                  }`}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 px-0.5 transition-colors active:bg-secondary/40"
            aria-label="Mais opções"
          >
            <span
              className={`absolute top-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300 ${
                moreActive || moreOpen ? "w-8 bg-primary" : "w-0 bg-transparent"
              }`}
            />
            <MoreHorizontal
              className={`h-[18px] w-[18px] transition-all duration-200 ${
                moreActive || moreOpen ? "text-primary scale-110" : "text-muted-foreground"
              }`}
            />
            <span
              className={`text-[9px] font-medium leading-none ${
                moreActive || moreOpen ? "text-foreground" : "text-muted-foreground/80"
              }`}
            >
              Mais
            </span>
          </button>
        </div>
      </nav>

      {/* Sheet "Mais" — abre de baixo */}
      <div
        onClick={() => setMoreOpen(false)}
        className={`md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          moreOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-300 ease-out ${
          moreOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <div>
            <div className="text-base font-display font-semibold tracking-tight text-foreground">Mais opções</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Atalhos e conta</div>
          </div>
          <button
            onClick={() => setMoreOpen(false)}
            className="p-2 -mr-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {SECONDARY.map((t) => {
            const active = isActive(t);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 border transition-colors ${
                  active
                    ? "bg-secondary border-primary/40 text-foreground"
                    : "bg-secondary/30 border-sidebar-border text-muted-foreground hover:text-foreground active:bg-secondary"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
                <span className="text-xs font-medium text-center leading-tight">{t.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="px-4 pb-5 pt-2 border-t border-sidebar-border">
          <div className="flex items-center gap-3 pt-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
              {user?.name?.[0] ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-foreground">{user?.name}</div>
              <div className="text-[10px] truncate capitalize">
                {isMaster ? <span className="text-primary font-semibold">MASTER</span> : <span className="text-muted-foreground">{user?.role}</span>}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-secondary/60"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
