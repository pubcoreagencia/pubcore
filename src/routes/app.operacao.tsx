import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Maximize2, Minimize2, KanbanSquare, ListChecks, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { KanbanBoardView } from "./app.kanban";
import { ChecklistsPage } from "./app.checklists";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { DailyReportDialog } from "@/components/DailyReportDialog";

export const Route = createFileRoute("/app/operacao")({
  component: OperacaoPage,
});

const STORAGE_KEY = "pubcore:operacao:mode";
const LAST_FUNNEL_KEY = "pubcore:operacao:lastFunnel";
type Mode = "normal" | "expanded" | "minimized";

function OperacaoPage() {
  const { activeWorkspaceId } = useWorkspace();
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "normal";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "normal" || stored === "expanded" || stored === "minimized") return stored;
    // Migrate legacy values
    if (stored === "kanban") return "expanded";
    if (stored === "full") return "normal";
    return "normal";
  });
  const [stats, setStats] = useState<{ funnels: number; cards: number; lastFunnel: string | null }>({
    funnels: 0, cards: 0, lastFunnel: null,
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* noop */ }
  }, [mode]);

  // Fetch lightweight stats when minimized
  useEffect(() => {
    if (mode !== "minimized" || !activeWorkspaceId) return;
    let cancelled = false;
    (async () => {
      const [funnelsRes, cardsRes] = await Promise.all([
        supabase.from("kanban_funnels").select("id,name").eq("workspace_id", activeWorkspaceId).order("position"),
        supabase.from("kanban_cards").select("id", { count: "exact", head: true }).eq("workspace_id", activeWorkspaceId),
      ]);
      if (cancelled) return;
      const funnels = funnelsRes.data ?? [];
      const lastId = (typeof window !== "undefined" && localStorage.getItem(LAST_FUNNEL_KEY)) || null;
      const last = funnels.find((f) => f.id === lastId) ?? funnels[0];
      setStats({
        funnels: funnels.length,
        cards: cardsRes.count ?? 0,
        lastFunnel: last?.name ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [mode, activeWorkspaceId]);

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-1">
            Centro Operacional
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Kanban e Checklists juntos. Expanda, minimize ou mantenha em modo normal conforme seu foco.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
          {mode !== "minimized" && (
            <button
              onClick={() => setMode("minimized")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs sm:text-sm font-medium hover:border-primary/40 hover:shadow-glow transition"
              title="Minimizar Kanban"
            >
              <ChevronUp className="h-4 w-4" />
              <span>Minimizar Kanban</span>
            </button>
          )}
          {mode !== "expanded" && (
            <button
              onClick={() => setMode("expanded")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs sm:text-sm font-medium hover:border-primary/40 hover:shadow-glow transition"
              title="Expandir Kanban"
            >
              <Maximize2 className="h-4 w-4" />
              <span>Expandir Kanban</span>
            </button>
          )}
          {mode !== "normal" && (
            <button
              onClick={() => setMode("normal")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs sm:text-sm font-medium hover:border-primary/40 hover:shadow-glow transition"
              title="Modo Normal"
            >
              <Minimize2 className="h-4 w-4" />
              <span>Normal</span>
            </button>
          )}
        </div>
      </header>

      {mode === "minimized" ? (
        <section
          aria-label="Kanban minimizado"
          className="rounded-2xl border border-border bg-card/40 shadow-card overflow-hidden"
        >
          <button
            onClick={() => setMode("normal")}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface/50 transition text-left"
            title="Expandir Kanban"
          >
            <div className="flex items-center gap-3 min-w-0">
              <KanbanSquare className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">Kanban</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {stats.funnels} {stats.funnels === 1 ? "funil" : "funis"} · {stats.cards} {stats.cards === 1 ? "card" : "cards"}
                  {stats.lastFunnel ? ` · Último: ${stats.lastFunnel}` : ""}
                </div>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        </section>
      ) : (
        <section
          aria-label="Kanban"
          className="rounded-2xl border border-border bg-card/40 shadow-card overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border bg-surface/50">
            <KanbanSquare className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kanban</span>
          </div>
          <div className="py-3">
            <KanbanBoardView embedded />
          </div>
        </section>
      )}

      {mode !== "expanded" && (
        <section aria-label="Checklists" className="mt-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Checklists &amp; Operação Diária
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 shadow-card overflow-hidden">
            <ChecklistsPage />
          </div>
        </section>
      )}
    </div>
  );
}
