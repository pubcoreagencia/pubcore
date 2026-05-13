import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, KanbanSquare, ListChecks, Calendar, Users2, Settings,
  LogOut, Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const items = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/kanban", label: "Kanban", icon: KanbanSquare },
  { to: "/app/checklists", label: "Checklists", icon: ListChecks },
  { to: "/app/calendar", label: "Calendário", icon: Calendar },
  { to: "/app/crm", label: "CRM", icon: Users2 },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    await logout();
    nav({ to: "/login" });
  };

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar relative overflow-hidden">
      <div className="absolute inset-0 bg-glow opacity-60 pointer-events-none" />
      <div className="relative flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow ring-1 ring-white/10">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <div className="font-display font-semibold tracking-tight text-sidebar-foreground text-[15px]">PUB <span className="text-gradient">CORE</span></div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Operational OS</div>
        </div>
      </div>

      <nav className="relative flex-1 p-3 space-y-1">
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                active
                  ? "bg-sidebar-accent/80 text-sidebar-accent-foreground shadow-card border border-white/5"
                  : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 border border-transparent"
              }`}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-primary shadow-glow" />}
              <it.icon className={`h-4 w-4 transition-colors ${active ? "text-primary" : "group-hover:text-primary/80"}`} />
              <span className="font-medium tracking-tight">{it.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-glow animate-pulse" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 rounded-lg p-2.5 bg-sidebar-accent/40">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-bold text-sm">
            {user?.name?.[0] ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-sidebar-foreground">{user?.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
