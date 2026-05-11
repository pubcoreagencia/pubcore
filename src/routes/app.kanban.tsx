import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { COMPANIES, type Company } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/kanban")({ component: KanbanPage });

const COLUMNS = ["Backlog", "Hoje", "Em andamento", "Revisão", "Concluído"] as const;
type Col = typeof COLUMNS[number];

interface Card {
  id: string;
  title: string;
  company: Company;
  priority: string;
  column_name: Col;
  position: number;
}

function KanbanPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [cards, setCards] = useState<Card[]>([]);
  const [drag, setDrag] = useState<string | null>(null);
  const [adding, setAdding] = useState<Col | null>(null);
  const [draft, setDraft] = useState({ title: "", company: COMPANIES[0] as Company });

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase.from("kanban_cards").select("*").eq("user_id", userId).order("position");
      setCards((data ?? []) as Card[]);
    };
    load();
    const ch = supabase.channel(`kanban:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const onDrop = useCallback(async (col: Col) => {
    if (!drag) return;
    setCards((cs) => cs.map((c) => c.id === drag ? { ...c, column_name: col } : c));
    await supabase.from("kanban_cards").update({ column_name: col }).eq("id", drag);
    setDrag(null);
  }, [drag]);

  const create = async (col: Col) => {
    if (!draft.title.trim() || !userId) return;
    const { error } = await supabase.from("kanban_cards").insert({
      user_id: userId, title: draft.title.trim(), company: draft.company,
      priority: "Média", column_name: col, position: cards.length,
    } as never);
    if (error) toast.error(error.message);
    setDraft({ title: "", company: COMPANIES[0] }); setAdding(null);
  };

  const remove = async (id: string) => { await supabase.from("kanban_cards").delete().eq("id", id); };

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fluxo operacional</div>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Kanban</h1>
        <p className="text-muted-foreground mt-1">{cards.length} cards · arraste entre colunas · sincronia em tempo real</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const list = cards.filter((c) => c.column_name === col);
          return (
            <div key={col} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(col)}
              className="rounded-xl border border-border bg-surface/40 p-3 min-h-[400px]">
              <div className="flex items-center justify-between px-1 py-2 mb-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider">{col}</h3>
                <span className="text-xs text-muted-foreground font-mono">{list.length}</span>
              </div>
              <div className="space-y-2.5">
                {list.map((c) => (
                  <article key={c.id} draggable onDragStart={() => setDrag(c.id)}
                    className="group rounded-lg border border-border bg-card p-3 shadow-card cursor-grab hover:border-primary/40 hover:shadow-glow transition">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm leading-snug">{c.title}</h4>
                      <button onClick={() => remove(c.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2.5"><CompanyTag company={c.company} /></div>
                  </article>
                ))}
                {adding === col ? (
                  <div className="rounded-lg border border-primary/40 bg-card p-2 space-y-2">
                    <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") create(col); if (e.key === "Escape") setAdding(null); }}
                      placeholder="Título do card" className="w-full bg-surface rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
                    <select value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value as Company })}
                      className="w-full bg-surface rounded px-2 py-1.5 text-xs">
                      {COMPANIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => create(col)} className="flex-1 rounded bg-gradient-primary py-1.5 text-xs font-bold text-primary-foreground">Criar</button>
                      <button onClick={() => setAdding(null)} className="rounded border border-border px-2 text-xs">×</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAdding(col)} className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition flex items-center justify-center gap-1">
                    <Plus className="h-3 w-3" /> Adicionar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
