import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, MoreHorizontal, CheckSquare } from "lucide-react";
import {
  INITIAL_CARDS, KANBAN_COLUMNS, type KanbanCard, type KanbanColumn,
} from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { PriorityBadge } from "@/components/PriorityBadge";

export const Route = createFileRoute("/app/kanban")({
  component: KanbanPage,
});

function KanbanPage() {
  const [cards, setCards] = useState<KanbanCard[]>(INITIAL_CARDS);
  const [dragId, setDragId] = useState<string | null>(null);

  const onDrop = (col: KanbanColumn) => {
    if (!dragId) return;
    setCards((cs) => cs.map((c) => (c.id === dragId ? { ...c, column: col } : c)));
    setDragId(null);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fluxo operacional</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Kanban</h1>
          <p className="text-muted-foreground mt-1">Arraste cards entre colunas · {cards.length} tarefas no quadro</p>
        </div>
        <button className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo card
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {KANBAN_COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.column === col);
          return (
            <div
              key={col}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(col)}
              className="rounded-xl border border-border bg-surface/40 p-3 min-h-[400px]"
            >
              <div className="flex items-center justify-between px-1 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    col === "Concluído" ? "bg-success" :
                    col === "Em andamento" ? "bg-warning" :
                    col === "Revisão" ? "bg-info" :
                    col === "Hoje" ? "bg-primary" : "bg-muted-foreground"
                  }`} />
                  <h3 className="font-semibold text-sm uppercase tracking-wider">{col}</h3>
                  <span className="text-xs text-muted-foreground font-mono">{colCards.length}</span>
                </div>
                <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
              </div>

              <div className="space-y-2.5">
                {colCards.map((c) => {
                  const done = c.checklist.filter((i) => i.done).length;
                  return (
                    <article
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      className="group rounded-lg border border-border bg-card p-3 shadow-card cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-glow transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm leading-snug">{c.title}</h4>
                        <PriorityBadge priority={c.priority} />
                      </div>
                      <div className="mt-2.5"><CompanyTag company={c.company} /></div>
                      {c.checklist.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckSquare className="h-3.5 w-3.5" />
                          <span className="font-mono">{done}/{c.checklist.length}</span>
                          <div className="flex-1 h-1 rounded-full bg-surface overflow-hidden">
                            <div className="h-full bg-gradient-primary" style={{ width: `${(done / c.checklist.length) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">{c.assignee}</span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                          {c.assignee.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                        </div>
                      </div>
                    </article>
                  );
                })}
                <button className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition flex items-center justify-center gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
