import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { navGroups } from "./nav-config";

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const { isMaster } = useWorkspace();
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

      {isMaster && !path.startsWith("/app/personal-finance") && <div className="px-3 pt-3"><WorkspaceSwitcher /></div>}

      <nav className="flex-1 px-2 pt-3 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
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
        {isMaster && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-primary/70 px-3 mb-1.5">Master</div>
            <Link
              to="/app/admin-accounts"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                path.startsWith("/app/admin-accounts")
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <ShieldCheck className={`h-4 w-4 flex-shrink-0 ${path.startsWith("/app/admin-accounts") ? "text-primary" : ""}`} />
              <span>Controle de contas</span>
            </Link>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
            {user?.name?.[0] ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate text-foreground">{user?.name}</div>
            <div className="text-[10px] truncate capitalize">
              {isMaster ? <span className="text-primary font-semibold">MASTER</span> : <span className="text-muted-foreground">{user?.role}</span>}
            </div>
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

// Keep LayoutDashboard import to satisfy potential type re-exports
void LayoutDashboard;
