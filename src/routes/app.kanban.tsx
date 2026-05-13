import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Plus, Trash2, Pencil, Check, X, GripVertical, MoreVertical, CalendarDays, User, FileText, ListChecks } from "lucide-react";
import { COMPANIES, type Company } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getActivePontoSession } from "@/lib/ponto";
import { toast } from "sonner";

export const Route = createFileRoute("/app/kanban")({ component: KanbanPage });

type Priority = "Baixa" | "Média" | "Alta" | "Crítica";
const PRIORITIES: Priority[] = ["Baixa", "Média", "Alta", "Crítica"];

interface ChecklistItem { id: string; text: string; done: boolean; }

interface Column {
  id: string;
  name: string;
  position: number;
  color: string | null;
}

interface Card {
  id: string;
  title: string;
  description: string | null;
  company: Company;
  priority: Priority;
  assignee: string | null;
  column_id: string | null;
  column_name: string | null;
  position: number;
  status: string;
  due_date: string | null;
  notes: string | null;
  checklist: ChecklistItem[];
}

const DEFAULT_COLUMNS = [
  { name: "Backlog", color: "oklch(0.65 0.04 260)" },
  { name: "Hoje", color: "oklch(0.72 0.16 220)" },
  { name: "Em andamento", color: "oklch(0.75 0.16 80)" },
  { name: "Revisão", color: "oklch(0.72 0.18 320)" },
  { name: "Concluído", color: "oklch(0.7 0.15 145)" },
];

const PRIO_STYLE: Record<Priority, string> = {
  "Baixa": "bg-muted text-muted-foreground",
  "Média": "bg-primary/15 text-primary",
  "Alta": "bg-amber-500/15 text-amber-400",
  "Crítica": "bg-rose-500/20 text-rose-300",
};

function isDoneColumnName(name: string) {
  return /conclu/i.test(name) || /done/i.test(name);
}

function KanbanPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);

  // dnd state
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [draggingCol, setDraggingCol] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // editing
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [colDraft, setColDraft] = useState("");
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");

  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", company: COMPANIES[0] as Company });

  const [openCard, setOpenCard] = useState<Card | null>(null);

  // ----- LOAD -----
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const [{ data: cols }, { data: cs }] = await Promise.all([
        supabase.from("kanban_columns").select("*").eq("user_id", userId).order("position"),
        supabase.from("kanban_cards").select("*").eq("user_id", userId).order("position"),
      ]);
      if (cancelled) return;
      let columnList = (cols ?? []) as Column[];
      // Seed defaults
      if (columnList.length === 0) {
        const seed = DEFAULT_COLUMNS.map((c, i) => ({ user_id: userId, name: c.name, color: c.color, position: i }));
        const { data: inserted } = await supabase.from("kanban_columns").insert(seed as never).select();
        columnList = ((inserted ?? []) as Column[]).sort((a, b) => a.position - b.position);
      }
      setColumns(columnList);

      // Migrate legacy cards: column_id null but column_name set
      const cardList = ((cs ?? []) as unknown[]).map(normalizeCard);
      const legacy = cardList.filter((c) => !c.column_id && c.column_name);
      if (legacy.length > 0) {
        const byName = new Map(columnList.map((c) => [c.name, c.id]));
        await Promise.all(legacy.map((c) => {
          const colId = byName.get(c.column_name ?? "") ?? columnList[0]?.id;
          if (!colId) return Promise.resolve();
          return supabase.from("kanban_cards").update({ column_id: colId }).eq("id", c.id);
        }));
        const { data: refreshed } = await supabase.from("kanban_cards").select("*").eq("user_id", userId).order("position");
        setCards(((refreshed ?? []) as unknown[]).map(normalizeCard));
      } else {
        setCards(cardList);
      }
      setLoaded(true);
    };
    load();

    const sfx = Math.random().toString(36).slice(2, 8);
    const ch = supabase.channel(`kanban:${userId}:${sfx}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_columns", filter: `user_id=eq.${userId}` }, async () => {
        const { data } = await supabase.from("kanban_columns").select("*").eq("user_id", userId).order("position");
        setColumns((data ?? []) as Column[]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards", filter: `user_id=eq.${userId}` }, async () => {
        const { data } = await supabase.from("kanban_cards").select("*").eq("user_id", userId).order("position");
        setCards(((data ?? []) as Card[]).map(normalizeCard));
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [userId]);

  function normalizeCard(c: any): Card {
    return {
      ...c,
      checklist: Array.isArray(c.checklist) ? c.checklist : [],
      priority: (PRIORITIES as string[]).includes(c.priority) ? c.priority : "Média",
    };
  }

  // ----- COLUMN OPS -----
  const createColumn = async () => {
    if (!newColName.trim() || !userId) return;
    const position = columns.length;
    await supabase.from("kanban_columns").insert({
      user_id: userId, name: newColName.trim(), position,
      color: DEFAULT_COLUMNS[position % DEFAULT_COLUMNS.length].color,
    } as never);
    setNewColName(""); setAddingCol(false);
  };

  const renameColumn = async (id: string, name: string) => {
    if (!name.trim()) { setEditingCol(null); return; }
    setColumns((cs) => cs.map((c) => c.id === id ? { ...c, name: name.trim() } : c));
    await supabase.from("kanban_columns").update({ name: name.trim() }).eq("id", id);
    setEditingCol(null);
  };

  const deleteColumn = async (id: string) => {
    const colCards = cards.filter((c) => c.column_id === id);
    if (colCards.length > 0 && !confirm(`Excluir coluna com ${colCards.length} card(s)? Os cards também serão removidos.`)) return;
    await supabase.from("kanban_cards").delete().eq("column_id", id);
    await supabase.from("kanban_columns").delete().eq("id", id);
  };

  const reorderColumns = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ordered = [...columns].sort((a, b) => a.position - b.position);
    const fromIdx = ordered.findIndex((c) => c.id === fromId);
    const toIdx = ordered.findIndex((c) => c.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    const updates = ordered.map((c, i) => ({ ...c, position: i }));
    setColumns(updates);
    await Promise.all(updates.map((c) => supabase.from("kanban_columns").update({ position: c.position }).eq("id", c.id)));
  };

  // ----- CARD OPS -----
  const createCard = async (colId: string) => {
    if (!draft.title.trim() || !userId) return;
    const colCards = cards.filter((c) => c.column_id === colId);
    const col = columns.find((c) => c.id === colId);
    const { error } = await supabase.from("kanban_cards").insert({
      user_id: userId, title: draft.title.trim(), company: draft.company,
      priority: "Média", column_id: colId, column_name: col?.name ?? "Backlog",
      position: colCards.length, status: "open", checklist: [],
    } as never);
    if (error) toast.error(error.message);
    setDraft({ title: "", company: COMPANIES[0] }); setAdding(null);
  };

  const deleteCard = async (id: string) => {
    await supabase.from("kanban_cards").delete().eq("id", id);
  };

  const updateCard = async (id: string, patch: Partial<Card>) => {
    const dbPatch: Record<string, unknown> = { ...patch };
    if (patch.checklist) dbPatch.checklist = patch.checklist as unknown;
    setCards((cs) => cs.map((c) => c.id === id ? { ...c, ...patch } : c));
    setOpenCard((c) => c && c.id === id ? { ...c, ...patch } : c);
    await supabase.from("kanban_cards").update(dbPatch).eq("id", id);
  };

  const moveCard = async (cardId: string, targetColId: string, targetIdx?: number) => {
    const card = cards.find((c) => c.id === cardId);
    const col = columns.find((c) => c.id === targetColId);
    if (!card || !col) return;
    const fromColId = card.column_id;
    const targetCards = cards.filter((c) => c.column_id === targetColId && c.id !== cardId).sort((a, b) => a.position - b.position);
    const insertAt = typeof targetIdx === "number" ? targetIdx : targetCards.length;
    targetCards.splice(insertAt, 0, { ...card, column_id: targetColId, column_name: col.name });
    const reposTarget = targetCards.map((c, i) => ({ id: c.id, position: i, column_id: targetColId, column_name: col.name }));

    let reposSource: { id: string; position: number }[] = [];
    if (fromColId && fromColId !== targetColId) {
      reposSource = cards
        .filter((c) => c.column_id === fromColId && c.id !== cardId)
        .sort((a, b) => a.position - b.position)
        .map((c, i) => ({ id: c.id, position: i }));
    }

    setCards((cs) => cs.map((c) => {
      const t = reposTarget.find((x) => x.id === c.id);
      if (t) return { ...c, position: t.position, column_id: t.column_id, column_name: t.column_name };
      const s = reposSource.find((x) => x.id === c.id);
      if (s) return { ...c, position: s.position };
      return c;
    }));

    await Promise.all([
      ...reposTarget.map((p) => supabase.from("kanban_cards").update({ position: p.position, column_id: p.column_id, column_name: p.column_name }).eq("id", p.id)),
      ...reposSource.map((p) => supabase.from("kanban_cards").update({ position: p.position }).eq("id", p.id)),
    ]);

    // Auto status + sync com Bater Ponto se entrou em coluna "Concluído"
    if (isDoneColumnName(col.name) && card.status !== "done") {
      await supabase.from("kanban_cards").update({ status: "done" }).eq("id", cardId);
      const active = getActivePontoSession();
      if (active.sessionId && userId) {
        await supabase.from("ponto_session_tasks").insert({
          user_id: userId,
          session_id: active.sessionId,
          owner_email: active.ownerEmail ?? user?.email ?? "guest@pubcore.local",
          user_name: active.userName ?? user?.email ?? null,
          company: card.company,
          title: `[Kanban] ${card.title}`,
        } as never);
        toast.success("Card concluído e registrado no ponto");
      }
    } else if (!isDoneColumnName(col.name) && card.status === "done") {
      await supabase.from("kanban_cards").update({ status: "open" }).eq("id", cardId);
    }
  };

  // ----- RENDER -----
  if (!loaded) {
    return <div className="p-10 text-muted-foreground">Carregando Kanban…</div>;
  }

  const sortedCols = [...columns].sort((a, b) => a.position - b.position);
  const totalCards = cards.length;
  const doneCards = cards.filter((c) => c.status === "done").length;

  return (
    <div className="p-6 lg:p-10 max-w-[1800px] mx-auto">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fluxo operacional</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Kanban</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {sortedCols.length} colunas · {totalCards} cards · {doneCards} concluídos · sincronia em tempo real
          </p>
        </div>
        <button
          onClick={() => setAddingCol(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:border-primary/40 hover:shadow-glow transition"
        >
          <Plus className="h-4 w-4" /> Nova coluna
        </button>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {sortedCols.map((col) => {
          const list = cards.filter((c) => c.column_id === col.id).sort((a, b) => a.position - b.position);
          const isOver = overCol === col.id;
          return (
            <div
              key={col.id}
              draggable={editingCol !== col.id}
              onDragStart={(e) => {
                if (draggingCard) return;
                setDraggingCol(col.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDraggingCol(null)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingCard) setOverCol(col.id);
              }}
              onDragLeave={() => { if (overCol === col.id) setOverCol(null); }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingCol && draggingCol !== col.id) {
                  reorderColumns(draggingCol, col.id);
                  setDraggingCol(null);
                } else if (draggingCard) {
                  moveCard(draggingCard, col.id);
                  setDraggingCard(null);
                }
                setOverCol(null);
              }}
              className={`flex-shrink-0 w-[300px] rounded-xl border bg-surface/40 p-3 min-h-[500px] transition ${
                isOver ? "border-primary/60 bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-1 py-2 mb-2 group/col">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 cursor-grab" />
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: col.color ?? "var(--primary)" }} />
                  {editingCol === col.id ? (
                    <input
                      autoFocus
                      value={colDraft}
                      onChange={(e) => setColDraft(e.target.value)}
                      onBlur={() => renameColumn(col.id, colDraft)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameColumn(col.id, colDraft);
                        if (e.key === "Escape") setEditingCol(null);
                      }}
                      className="bg-surface rounded px-2 py-1 text-sm outline-none ring-1 ring-primary/40 flex-1 min-w-0"
                    />
                  ) : (
                    <button
                      onDoubleClick={() => { setEditingCol(col.id); setColDraft(col.name); }}
                      className="font-semibold text-sm uppercase tracking-wider truncate"
                    >
                      {col.name}
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground font-mono">{list.length}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition">
                  <button onClick={() => { setEditingCol(col.id); setColDraft(col.name); }} className="text-muted-foreground hover:text-foreground p-1">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => deleteColumn(col.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {list.map((c) => {
                  const checklistDone = c.checklist.filter((i) => i.done).length;
                  return (
                    <article
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggingCard(c.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDraggingCard(null)}
                      onClick={() => setOpenCard(c)}
                      className="group rounded-lg border border-border bg-card p-3 shadow-card cursor-pointer hover:border-primary/40 hover:shadow-glow transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium text-sm leading-snug flex-1 ${c.status === "done" ? "line-through text-muted-foreground" : ""}`}>{c.title}</h4>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCard(c.id); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition flex-shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {c.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <CompanyTag company={c.company} />
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${PRIO_STYLE[c.priority]}`}>{c.priority}</span>
                        {c.due_date && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground inline-flex items-center gap-1">
                            <CalendarDays className="h-2.5 w-2.5" />
                            {new Date(c.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        )}
                        {c.checklist.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground inline-flex items-center gap-1">
                            <ListChecks className="h-2.5 w-2.5" />
                            {checklistDone}/{c.checklist.length}
                          </span>
                        )}
                        {c.assignee && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground inline-flex items-center gap-1">
                            <User className="h-2.5 w-2.5" />
                            {c.assignee}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}

                {adding === col.id ? (
                  <div className="rounded-lg border border-primary/40 bg-card p-2 space-y-2">
                    <input
                      autoFocus
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") createCard(col.id); if (e.key === "Escape") setAdding(null); }}
                      placeholder="Título do card"
                      className="w-full bg-surface rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                    <select
                      value={draft.company}
                      onChange={(e) => setDraft({ ...draft, company: e.target.value as Company })}
                      className="w-full bg-surface rounded px-2 py-1.5 text-xs"
                    >
                      {COMPANIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => createCard(col.id)} className="flex-1 rounded bg-gradient-primary py-1.5 text-xs font-bold text-primary-foreground">Criar</button>
                      <button onClick={() => setAdding(null)} className="rounded border border-border px-2 text-xs">×</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAdding(col.id)}
                    className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition flex items-center justify-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Adicionar card
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {addingCol ? (
          <div className="flex-shrink-0 w-[300px] rounded-xl border border-primary/40 bg-card p-3 h-fit space-y-2">
            <input
              autoFocus
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createColumn(); if (e.key === "Escape") { setAddingCol(false); setNewColName(""); } }}
              placeholder="Nome da coluna"
              className="w-full bg-surface rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button onClick={createColumn} className="flex-1 rounded bg-gradient-primary py-1.5 text-xs font-bold text-primary-foreground">Criar coluna</button>
              <button onClick={() => { setAddingCol(false); setNewColName(""); }} className="rounded border border-border px-2 text-xs">×</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCol(true)}
            className="flex-shrink-0 w-[300px] rounded-xl border border-dashed border-border h-[120px] text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition flex items-center justify-center gap-1"
          >
            <Plus className="h-4 w-4" /> Nova coluna
          </button>
        )}
      </div>

      {openCard && (
        <CardDialog
          card={openCard}
          columns={sortedCols}
          onClose={() => setOpenCard(null)}
          onUpdate={(patch) => updateCard(openCard.id, patch)}
          onMove={(colId) => { moveCard(openCard.id, colId); setOpenCard(null); }}
          onDelete={() => { deleteCard(openCard.id); setOpenCard(null); }}
        />
      )}
    </div>
  );
}

function CardDialog({
  card, columns, onClose, onUpdate, onMove, onDelete,
}: {
  card: Card;
  columns: Column[];
  onClose: () => void;
  onUpdate: (patch: Partial<Card>) => void;
  onMove: (colId: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [notes, setNotes] = useState(card.notes ?? "");
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setNotes(card.notes ?? "");
  }, [card.id]);

  const addChecklistItem = () => {
    if (!newItem.trim()) return;
    const item: ChecklistItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: newItem.trim(), done: false };
    onUpdate({ checklist: [...card.checklist, item] });
    setNewItem("");
  };
  const toggleItem = (id: string) => onUpdate({ checklist: card.checklist.map((i) => i.id === id ? { ...i, done: !i.done } : i) });
  const removeItem = (id: string) => onUpdate({ checklist: card.checklist.filter((i) => i.id !== id) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== card.title && onUpdate({ title: title.trim() })}
            className="flex-1 bg-transparent text-xl font-display font-bold outline-none"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Coluna">
              <select
                value={card.column_id ?? ""}
                onChange={(e) => onMove(e.target.value)}
                className="w-full bg-surface rounded px-2 py-1.5 text-sm"
              >
                {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={card.status}
                onChange={(e) => onUpdate({ status: e.target.value })}
                className="w-full bg-surface rounded px-2 py-1.5 text-sm"
              >
                <option value="open">Aberto</option>
                <option value="in_progress">Em progresso</option>
                <option value="blocked">Bloqueado</option>
                <option value="done">Concluído</option>
              </select>
            </Field>
            <Field label="Empresa">
              <select
                value={card.company}
                onChange={(e) => onUpdate({ company: e.target.value as Company })}
                className="w-full bg-surface rounded px-2 py-1.5 text-sm"
              >
                {COMPANIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select
                value={card.priority}
                onChange={(e) => onUpdate({ priority: e.target.value as Priority })}
                className="w-full bg-surface rounded px-2 py-1.5 text-sm"
              >
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Responsável">
              <input
                value={card.assignee ?? ""}
                onChange={(e) => onUpdate({ assignee: e.target.value || null })}
                placeholder="Nome do responsável"
                className="w-full bg-surface rounded px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                value={card.due_date ?? ""}
                onChange={(e) => onUpdate({ due_date: e.target.value || null })}
                className="w-full bg-surface rounded px-2 py-1.5 text-sm"
              />
            </Field>
          </div>

          <Field label="Descrição" icon={<FileText className="h-3.5 w-3.5" />}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (card.description ?? "") && onUpdate({ description: description || null })}
              rows={3}
              placeholder="Detalhes do card…"
              className="w-full bg-surface rounded px-2 py-2 text-sm resize-y"
            />
          </Field>

          <Field label="Checklist interno" icon={<ListChecks className="h-3.5 w-3.5" />}>
            <div className="space-y-1.5">
              {card.checklist.map((i) => (
                <div key={i.id} className="flex items-center gap-2 group">
                  <input type="checkbox" checked={i.done} onChange={() => toggleItem(i.id)} className="h-4 w-4 rounded accent-primary" />
                  <span className={`flex-1 text-sm ${i.done ? "line-through text-muted-foreground" : ""}`}>{i.text}</span>
                  <button onClick={() => removeItem(i.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addChecklistItem(); }}
                  placeholder="Novo item…"
                  className="flex-1 bg-surface rounded px-2 py-1.5 text-sm"
                />
                <button onClick={addChecklistItem} className="rounded bg-primary/15 text-primary px-3 text-xs font-bold">Add</button>
              </div>
            </div>
          </Field>

          <Field label="Observações">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (card.notes ?? "") && onUpdate({ notes: notes || null })}
              rows={2}
              placeholder="Notas, links, contexto…"
              className="w-full bg-surface rounded px-2 py-2 text-sm resize-y"
            />
          </Field>
        </div>

        <div className="flex justify-between items-center p-4 border-t border-border">
          <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-sm text-destructive hover:underline">
            <Trash2 className="h-3.5 w-3.5" /> Excluir card
          </button>
          <button onClick={onClose} className="rounded-lg bg-gradient-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
        {icon} {label}
      </label>
      {children}
    </div>
  );
}
