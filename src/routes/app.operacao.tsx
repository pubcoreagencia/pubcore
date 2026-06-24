import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Maximize2, Minimize2, KanbanSquare, ListChecks } from "lucide-react";
import { KanbanBoardView } from "./app.kanban";
import { ChecklistsPage } from "./app.checklists";

export const Route = createFileRoute("/app/operacao")({
  component: OperacaoPage,
});

const STORAGE_KEY = "pubcore:operacao:mode";
type Mode = "full" | "kanban";

function OperacaoPage() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "full";
    return (localStorage.getItem(STORAGE_KEY) as Mode) || "full";
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* noop */ }
  }, [mode]);

  const expanded = mode === "kanban";

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-1">
            Checklist &amp; Kanban
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Kanban no topo, checklists logo abaixo. Expanda o Kanban quando precisar de foco total.
          </p>
        </div>
        <button
          onClick={() => setMode(expanded ? "full" : "kanban")}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg border border-border bg-card px-3 py-2 text-xs sm:text-sm font-medium hover:border-primary/40 hover:shadow-glow transition flex-shrink-0"
          title={expanded ? "Mostrar Checklists" : "Expandir Kanban"}
        >
          {expanded ? (
            <>
              <Minimize2 className="h-4 w-4" />
              <span>Mostrar Checklists</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              <span>Expandir Kanban</span>
            </>
          )}
        </button>
      </header>

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

      {!expanded && (
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
