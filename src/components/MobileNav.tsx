import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, KanbanSquare, Calendar, StickyNote, Wallet, Boxes,
  Users2, Calculator, Settings, LogOut, FolderOpen, TrendingUp, PiggyBank, Sparkles,
} from "lucide-react";


import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type Tab = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const TABS: Tab[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/operacao", label: "Operação", icon: KanbanSquare },
  { to: "/app/completion-reports", label: "Relatórios", icon: Sparkles },
  { to: "/app/notes", label: "Notas", icon: StickyNote },
  { to: "/app/finance", label: "Finanças", icon: Wallet },
  { to: "/app/personal-finance", label: "Pessoal", icon: PiggyBank },
  { to: "/app/stock", label: "Estoque", icon: Boxes },
  { to: "/app/calendar", label: "Agenda", icon: Calendar },
  { to: "/app/crm", label: "CRM", icon: Users2 },
  { to: "/app/files", label: "Arquivos", icon: FolderOpen },
  { to: "/app/trends", label: "Tendências", icon: TrendingUp },
  { to: "/app/calculator", label: "Custos", icon: Calculator },


  { to: "/app/settings", label: "Config.", icon: Settings },
];

export function MobileNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const { isMaster } = useWorkspace();
  const nav = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  const isActive = (t: Tab) => (t.exact ? path === t.to : path.startsWith(t.to));

  // Scroll active tab into view smoothly when route changes
  useEffect(() => {
    const el = activeRef.current;
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    const elRect = el.getBoundingClientRect();
    const scRect = scroller.getBoundingClientRect();
    const target = el.offsetLeft - (scRect.width - elRect.width) / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [path]);

  const handleLogout = async () => {
    await logout();
    nav({ to: "/login" });
  };

  return (
    <>
      {/* Top bar mobile */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-sidebar-border bg-background/85 backdrop-blur-md">
        <Link to="/app" className="flex items-center gap-2 min-w-0">
          <img src="/favicon.ico" alt="PUB" className="h-7 w-auto flex-shrink-0" />
          <div className="font-display font-semibold tracking-tight text-foreground text-sm truncate">
            PUB <span className="text-primary">CORE</span>
          </div>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          {isMaster && !path.startsWith("/app/personal-finance") && (
            <div className="max-w-[40vw]"><WorkspaceSwitcher /></div>
          )}
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground hover:text-foreground transition flex-shrink-0"
            aria-label="Sair"
            title={user?.name ?? "Sair"}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Bottom navigation: horizontal scrollable strip with all tabs */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-sidebar-border bg-background/95 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação principal"
      >
        <div
          ref={scrollerRef}
          className="flex items-stretch gap-1 overflow-x-auto overscroll-x-contain px-2 py-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-proximity"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {TABS.map((t) => {
            const active = isActive(t);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                ref={active ? activeRef : undefined}
                className={`snap-start flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 min-w-[64px] h-12 rounded-xl transition-all duration-200 active:scale-95 ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={`text-[10px] font-medium leading-none ${
                    active ? "text-foreground" : "text-muted-foreground/80"
                  }`}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
