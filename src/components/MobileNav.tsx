import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { navGroups } from "./nav-config";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

export function MobileNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const { isMaster } = useWorkspace();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  // Auto-close on route change
  useEffect(() => { setOpen(false); }, [path]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    nav({ to: "/login" });
  };

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-sidebar-border bg-background/85 backdrop-blur-md">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-lg text-foreground hover:bg-secondary/60 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/favicon.ico" alt="PUB" className="h-7 w-auto" />
          <div className="font-display font-semibold tracking-tight text-foreground text-sm">
            PUB <span className="text-primary">CORE</span>
          </div>
        </div>
        <div className="w-9" />
      </header>

      {/* Overlay */}
      <div
        onClick={() => setOpen(false)}
        className={`md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[320px] flex flex-col bg-sidebar border-r border-sidebar-border shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <img src="/favicon.ico" alt="PUB" className="h-9 w-auto" />
            <div className="leading-tight">
              <div className="font-display font-semibold tracking-tight text-sidebar-foreground text-sm">
                PUB <span className="text-primary">CORE</span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Operational OS</div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 -mr-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pt-3"><WorkspaceSwitcher /></div>

        <nav className="flex-1 px-2 pt-3 pb-4 space-y-5 overflow-y-auto overscroll-contain">
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
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] transition-colors ${
                        active
                          ? "bg-secondary text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:bg-secondary"
                      }`}
                    >
                      <it.icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? "text-primary" : ""}`} />
                      <span>{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
              {user?.name?.[0] ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-foreground">{user?.name}</div>
              <div className="text-[10px] text-muted-foreground truncate capitalize">{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground transition-colors p-2"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
