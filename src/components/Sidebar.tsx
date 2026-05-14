import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, KanbanSquare, ListChecks, Calendar, Users2, Settings,
  LogOut, StickyNote,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Operação",
    items: [{ to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Workflow",
    items: [
      { to: "/app/kanban", label: "Kanban", icon: KanbanSquare },
      { to: "/app/checklists", label: "Checklists", icon: ListChecks },
      { to: "/app/calendar", label: "Calendário", icon: Calendar },
      { to: "/app/notes", label: "Notas", icon: StickyNote },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/app/crm", label: "CRM", icon: Users2 },
      { to: "/app/settings", label: "Configurações", icon: Settings },
    ],
  },
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
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-3 px-5 h-20 border-b border-sidebar-border">
        <img src="/favicon.ico" alt="PUB" className="h-12 w-auto" />
        <div className="leading-tight">
          <div className="font-display font-semibold tracking-tight text-sidebar-foreground text-[15px]">
            PUB <span className="text-primary">CORE</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Operational OS</div>
        </div>
      </div>

      <nav className="flex-1 px-2 pt-4 space-y-5 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 px-3 mb-1.5">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((it) => {
                const active = it.exact ? path === it.to : path.startsWith(it.to);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-secondary text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <it.icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
            {user?.name?.[0] ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate text-foreground">{user?.name}</div>
            <div className="text-[10px] text-muted-foreground truncate capitalize">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
