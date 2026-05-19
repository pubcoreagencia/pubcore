import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Trash2, Pencil, X, GripVertical, CalendarDays, User, FileText, ListChecks, Layers, Paperclip } from "lucide-react";
import { COMPANIES, type Company } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { getActivePontoSession } from "@/lib/ponto";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity-log";
import { KanbanAttachments } from "@/components/KanbanAttachments";
import { SaveIndicator } from "@/components/SaveIndicator";
import type { SaveStatus } from "@/hooks/use-autosave";

export const Route = createFileRoute("/app/kanban")({ component: KanbanPage });

type Priority = "Baixa" | "Média" | "Alta" | "Crítica";
const PRIORITIES: Priority[] = ["Baixa", "Média", "Alta", "Crítica"];

interface ChecklistItem { id: string; text: string; done: boolean; }

interface Funnel {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  position: number;
}

interface Column {
  id: string;
  name: string;
  position: number;
  color: string | null;
  funnel_id: string | null;
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
  funnel_id: string | null;
}

const DEFAULT_COLUMNS = [
  { name: "Backlog", color: "oklch(0.65 0.04 260)" },
  { name: "Hoje", color: "oklch(0.72 0.16 220)" },
  { name: "Em andamento", color: "oklch(0.75 0.16 80)" },
  { name: "Revisão", color: "oklch(0.72 0.18 320)" },
  { name: "Concluído", color: "oklch(0.7 0.15 145)" },
];

const FUNNEL_COLORS = [
  "oklch(0.72 0.16 220)",
  "oklch(0.75 0.16 80)",
  "oklch(0.72 0.18 320)",
  "oklch(0.7 0.15 145)",
  "oklch(0.72 0.18 30)",
  "oklch(0.65 0.18 280)",
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
  const { activeWorkspaceId } = useWorkspace();
  const userId = user?.id;

  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Horizontal wheel scrolling (Trello/Linear-like)
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Let trackpads handling horizontal scroll natively
      if (e.deltaX !== 0) return;
      if (e.deltaY === 0) return;
      // Don't hijack when the user is scrolling inside a vertical scroller (e.g. card list)
      let node = e.target as HTMLElement | null;
      while (node && node !== el) {
        const style = window.getComputedStyle(node);
        const oy = style.overflowY;
        if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) return;
        node = node.parentElement;
      }
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: "auto" });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [loaded, activeFunnelId]);

  // dnd
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [draggingCol, setDraggingCol] = useState<string | null>(null);
  const [draggingFunnel, setDraggingFunnel] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // editing
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [colDraft, setColDraft] = useState("");
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");

  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", company: COMPANIES[0] as Company });
  const [openCard, setOpenCard] = useState<Card | null>(null);

  // funnel UI
  const [newFunnelName, setNewFunnelName] = useState("");
  const [addingFunnel, setAddingFunnel] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<string | null>(null);
  const [funnelDraft, setFunnelDraft] = useState("");

  // ----- LOAD -----
  useEffect(() => {
    if (!userId || !activeWorkspaceId) return;
    let cancelled = false;
    const load = async () => {
      const [{ data: fs }, { data: cols }, { data: cs }] = await Promise.all([
        supabase.from("kanban_funnels").select("*").eq("workspace_id", activeWorkspaceId).order("position"),
        supabase.from("kanban_columns").select("*").eq("workspace_id", activeWorkspaceId).order("position"),
        supabase.from("kanban_cards").select("*").eq("workspace_id", activeWorkspaceId).order("position"),
      ]);
      if (cancelled) return;

      let funnelList = (fs ?? []) as Funnel[];
      // seed default funnel
      if (funnelList.length === 0) {
        const { data: inserted } = await supabase.from("kanban_funnels").insert({
          workspace_id: activeWorkspaceId, user_id: userId,
          name: "Geral", position: 0, icon: "Layers", color: FUNNEL_COLORS[0],
        } as never).select();
        funnelList = (inserted ?? []) as Funnel[];
      }
      setFunnels(funnelList);
      const firstFunnelId = funnelList[0]?.id ?? null;
      setActiveFunnelId((prev) => prev && funnelList.some(f => f.id === prev) ? prev : firstFunnelId);

      let columnList = ((cols ?? []) as Column[]);
      // backfill: any column missing funnel_id → assign to first funnel
      const orphanCols = columnList.filter(c => !c.funnel_id);
      if (orphanCols.length > 0 && firstFunnelId) {
        await Promise.all(orphanCols.map(c =>
          supabase.from("kanban_columns").update({ funnel_id: firstFunnelId }).eq("id", c.id)
        ));
        columnList = columnList.map(c => c.funnel_id ? c : { ...c, funnel_id: firstFunnelId });
      }

      // seed default columns for the active funnel if it has none
      const activeFid = firstFunnelId;
      const hasColsForActive = activeFid && columnList.some(c => c.funnel_id === activeFid);
      if (activeFid && !hasColsForActive) {
        const seed = DEFAULT_COLUMNS.map((c, i) => ({
          workspace_id: activeWorkspaceId, user_id: userId,
          name: c.name, color: c.color, position: i, funnel_id: activeFid,
        }));
        const { data: inserted } = await supabase.from("kanban_columns").insert(seed as never).select();
        columnList = [...columnList, ...((inserted ?? []) as Column[])];
      }
      setColumns(columnList);

      const cardList = ((cs ?? []) as unknown[]).map(normalizeCard);
      // backfill cards without funnel_id
      const orphanCards = cardList.filter(c => !c.funnel_id);
      if (orphanCards.length > 0 && firstFunnelId) {
        await Promise.all(orphanCards.map(c =>
          supabase.from("kanban_cards").update({ funnel_id: firstFunnelId }).eq("id", c.id)
        ));
        cardList.forEach(c => { if (!c.funnel_id) c.funnel_id = firstFunnelId; });
      }
      setCards(cardList);
      setLoaded(true);
    };
    load();

    const sfx = Math.random().toString(36).slice(2, 8);
    const ch = supabase.channel(`kanban:${activeWorkspaceId}:${sfx}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_funnels", filter: `workspace_id=eq.${activeWorkspaceId}` }, async () => {
        const { data } = await supabase.from("kanban_funnels").select("*").eq("workspace_id", activeWorkspaceId).order("position");
        setFunnels((data ?? []) as Funnel[]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_columns", filter: `workspace_id=eq.${activeWorkspaceId}` }, async () => {
        const { data } = await supabase.from("kanban_columns").select("*").eq("workspace_id", activeWorkspaceId).order("position");
        setColumns((data ?? []) as Column[]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards", filter: `workspace_id=eq.${activeWorkspaceId}` }, async () => {
        const { data } = await supabase.from("kanban_cards").select("*").eq("workspace_id", activeWorkspaceId).order("position");
        setCards(((data ?? []) as unknown[]).map(normalizeCard));
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [userId, activeWorkspaceId]);

  function normalizeCard(c: any): Card {
    return {
      ...c,
      checklist: Array.isArray(c.checklist) ? c.checklist : [],
      priority: (PRIORITIES as string[]).includes(c.priority) ? c.priority : "Média",
    };
  }

  // ----- FUNNEL OPS -----
  const createFunnel = async () => {
    if (!newFunnelName.trim() || !userId || !activeWorkspaceId) return;
    const position = funnels.length;
    const { data, error } = await supabase.from("kanban_funnels").insert({
      workspace_id: activeWorkspaceId, user_id: userId,
      name: newFunnelName.trim(), position,
      icon: "Layers",
      color: FUNNEL_COLORS[position % FUNNEL_COLORS.length],
    } as never).select().single();
    if (error) { toast.error(error.message); return; }
    setNewFunnelName(""); setAddingFunnel(false);
    if (data) setActiveFunnelId((data as Funnel).id);
  };

  const renameFunnel = async (id: string, name: string) => {
    if (!name.trim()) { setEditingFunnel(null); return; }
    setFunnels(fs => fs.map(f => f.id === id ? { ...f, name: name.trim() } : f));
    await supabase.from("kanban_funnels").update({ name: name.trim() }).eq("id", id);
    setEditingFunnel(null);
  };

  const deleteFunnel = async (id: string) => {
    if (funnels.length <= 1) { toast.error("Mantenha ao menos um funil"); return; }
    const f = funnels.find(x => x.id === id);
    const colsIn = columns.filter(c => c.funnel_id === id);
    const cardsIn = cards.filter(c => c.funnel_id === id);
    if (!confirm(`Excluir funil "${f?.name}" com ${colsIn.length} coluna(s) e ${cardsIn.length} card(s)?`)) return;
    await supabase.from("kanban_cards").delete().eq("funnel_id", id);
    await supabase.from("kanban_columns").delete().eq("funnel_id", id);
    await supabase.from("kanban_funnels").delete().eq("id", id);
    if (activeFunnelId === id) {
      const next = funnels.find(x => x.id !== id);
      setActiveFunnelId(next?.id ?? null);
    }
  };

  const reorderFunnels = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ordered = [...funnels].sort((a, b) => a.position - b.position);
    const fromIdx = ordered.findIndex(c => c.id === fromId);
    const toIdx = ordered.findIndex(c => c.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    const updates = ordered.map((c, i) => ({ ...c, position: i }));
    setFunnels(updates);
    await Promise.all(updates.map(c => supabase.from("kanban_funnels").update({ position: c.position }).eq("id", c.id)));
  };

  // ----- COLUMN OPS -----
  const createColumn = async () => {
    if (!newColName.trim() || !userId || !activeWorkspaceId || !activeFunnelId) return;
    const colsInFunnel = columns.filter(c => c.funnel_id === activeFunnelId);
    const position = colsInFunnel.length;
    await supabase.from("kanban_columns").insert({
      workspace_id: activeWorkspaceId, user_id: userId,
      funnel_id: activeFunnelId,
      name: newColName.trim(), position,
      color: DEFAULT_COLUMNS[position % DEFAULT_COLUMNS.length].color,
    } as never);
    setNewColName(""); setAddingCol(false);
  };

  const renameColumn = async (id: string, name: string) => {
    if (!name.trim()) { setEditingCol(null); return; }
    setColumns(cs => cs.map(c => c.id === id ? { ...c, name: name.trim() } : c));
    await supabase.from("kanban_columns").update({ name: name.trim() }).eq("id", id);
    setEditingCol(null);
  };

  const deleteColumn = async (id: string) => {
    const colCards = cards.filter(c => c.column_id === id);
    const col = columns.find(c => c.id === id);
    if (colCards.length > 0 && !confirm(`Excluir coluna com ${colCards.length} card(s)? Os cards também serão removidos.`)) return;
    await supabase.from("kanban_cards").delete().eq("column_id", id);
    await supabase.from("kanban_columns").delete().eq("id", id);
    if (col) await logActivity({
      entity_type: "kanban_column", entity_id: id, action: "deleted",
      title: col.name, payload: { card_count: colCards.length },
    });
  };

  const reorderColumns = async (fromId: string, toId: string) => {
    if (fromId === toId || !activeFunnelId) return;
    const ordered = columns.filter(c => c.funnel_id === activeFunnelId).sort((a, b) => a.position - b.position);
    const fromIdx = ordered.findIndex(c => c.id === fromId);
    const toIdx = ordered.findIndex(c => c.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    const updates = ordered.map((c, i) => ({ ...c, position: i }));
    setColumns(cs => cs.map(c => {
      const u = updates.find(x => x.id === c.id);
      return u ? { ...c, position: u.position } : c;
    }));
    await Promise.all(updates.map(c => supabase.from("kanban_columns").update({ position: c.position }).eq("id", c.id)));
  };

  // ----- CARD OPS -----
  const createCard = async (colId: string) => {
    if (!draft.title.trim() || !userId || !activeWorkspaceId || !activeFunnelId) return;
    const colCards = cards.filter(c => c.column_id === colId);
    const col = columns.find(c => c.id === colId);
    const { error } = await supabase.from("kanban_cards").insert({
      workspace_id: activeWorkspaceId, user_id: userId,
      funnel_id: activeFunnelId,
      title: draft.title.trim(), company: draft.company,
      priority: "Média", column_id: colId, column_name: col?.name ?? "Backlog",
      position: colCards.length, status: "open", checklist: [],
    } as never);
    if (error) toast.error(error.message);
    setDraft({ title: "", company: COMPANIES[0] }); setAdding(null);
  };

  const deleteCard = async (id: string) => {
    const card = cards.find(c => c.id === id);
    // delete attachments first
    const { data: atts } = await supabase.from("kanban_attachments").select("storage_path").eq("card_id", id);
    if (atts && atts.length > 0) {
      await supabase.storage.from("kanban-attachments").remove(atts.map(a => a.storage_path));
      await supabase.from("kanban_attachments").delete().eq("card_id", id);
    }
    await supabase.from("kanban_cards").delete().eq("id", id);
    if (card) await logActivity({
      entity_type: "kanban_card", entity_id: id, action: "deleted",
      title: card.title, company: card.company,
      payload: { priority: card.priority, status: card.status, column_id: card.column_id },
    });
  };

  const updateCard = async (id: string, patch: Partial<Card>) => {
    const dbPatch: Record<string, unknown> = { ...patch };
    if (patch.checklist) dbPatch.checklist = patch.checklist as unknown;
    setCards(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
    setOpenCard(c => c && c.id === id ? { ...c, ...patch } : c);
    await supabase.from("kanban_cards").update(dbPatch as never).eq("id", id);
  };

  const moveCard = async (cardId: string, targetColId: string, targetIdx?: number) => {
    const card = cards.find(c => c.id === cardId);
    const col = columns.find(c => c.id === targetColId);
    if (!card || !col) return;
    const fromColId = card.column_id;
    const targetCards = cards.filter(c => c.column_id === targetColId && c.id !== cardId).sort((a, b) => a.position - b.position);
    const insertAt = typeof targetIdx === "number" ? targetIdx : targetCards.length;
    targetCards.splice(insertAt, 0, { ...card, column_id: targetColId, column_name: col.name });
    const reposTarget = targetCards.map((c, i) => ({ id: c.id, position: i, column_id: targetColId, column_name: col.name }));

    let reposSource: { id: string; position: number }[] = [];
    if (fromColId && fromColId !== targetColId) {
      reposSource = cards
        .filter(c => c.column_id === fromColId && c.id !== cardId)
        .sort((a, b) => a.position - b.position)
        .map((c, i) => ({ id: c.id, position: i }));
    }

    setCards(cs => cs.map(c => {
      const t = reposTarget.find(x => x.id === c.id);
      if (t) return { ...c, position: t.position, column_id: t.column_id, column_name: t.column_name };
      const s = reposSource.find(x => x.id === c.id);
      if (s) return { ...c, position: s.position };
      return c;
    }));

    await Promise.all([
      ...reposTarget.map(p => supabase.from("kanban_cards").update({ position: p.position, column_id: p.column_id, column_name: p.column_name }).eq("id", p.id)),
      ...reposSource.map(p => supabase.from("kanban_cards").update({ position: p.position }).eq("id", p.id)),
    ]);

    if (isDoneColumnName(col.name) && card.status !== "done") {
      await supabase.from("kanban_cards").update({ status: "done" }).eq("id", cardId);
      const active = getActivePontoSession();
      if (active.sessionId && userId && activeWorkspaceId) {
        await supabase.from("ponto_session_tasks").insert({
          workspace_id: activeWorkspaceId,
          user_id: userId, session_id: active.sessionId,
          owner_email: active.ownerEmail ?? user?.email ?? "guest@pubcore.local",
          user_name: active.userName ?? user?.email ?? null,
          company: card.company, title: `[Kanban] ${card.title}`,
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

  const sortedFunnels = [...funnels].sort((a, b) => a.position - b.position);
  const funnelCols = columns.filter(c => c.funnel_id === activeFunnelId).sort((a, b) => a.position - b.position);
  const funnelCards = cards.filter(c => c.funnel_id === activeFunnelId);
  const totalCards = funnelCards.length;
  const doneCards = funnelCards.filter(c => c.status === "done").length;

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-[1800px] mx-auto">
      <header className="mb-4 flex items-start sm:items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Fluxo operacional</div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mt-1">Kanban</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm truncate">
            <span className="hidden sm:inline">{sortedFunnels.length} funis · {funnelCols.length} colunas · {totalCards} cards · {doneCards} concluídos</span>
            <span className="sm:hidden">{funnelCols.length} col · {totalCards} cards · {doneCards} feitos</span>
          </p>
        </div>
        <button
          onClick={() => setAddingCol(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs sm:text-sm font-medium hover:border-primary/40 hover:shadow-glow transition flex-shrink-0"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova coluna</span><span className="sm:hidden">Coluna</span>
        </button>
      </header>

      {/* FUNNEL TABS */}
      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
        {sortedFunnels.map((f) => {
          const isActive = f.id === activeFunnelId;
          const count = cards.filter(c => c.funnel_id === f.id).length;
          return (
            <div
              key={f.id}
              draggable={editingFunnel !== f.id}
              onDragStart={(e) => { setDraggingFunnel(f.id); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => setDraggingFunnel(null)}
              onDragOver={(e) => { if (draggingFunnel) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingFunnel && draggingFunnel !== f.id) {
                  reorderFunnels(draggingFunnel, f.id);
                  setDraggingFunnel(null);
                }
              }}
              className={`group flex-shrink-0 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 transition cursor-pointer ${
                isActive
                  ? "border-primary/60 bg-primary/10 shadow-glow"
                  : "border-border bg-card/40 hover:border-primary/30"
              }`}
              onClick={() => { if (editingFunnel !== f.id) setActiveFunnelId(f.id); }}
            >
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
              <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              {editingFunnel === f.id ? (
                <input
                  autoFocus
                  value={funnelDraft}
                  onChange={(e) => setFunnelDraft(e.target.value)}
                  onBlur={() => renameFunnel(f.id, funnelDraft)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameFunnel(f.id, funnelDraft);
                    if (e.key === "Escape") setEditingFunnel(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-surface rounded px-2 py-0.5 text-sm outline-none ring-1 ring-primary/40 w-32"
                />
              ) : (
                <span
                  className="text-sm font-semibold"
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingFunnel(f.id); setFunnelDraft(f.name); }}
                >
                  {f.name}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground font-mono">{count}</span>
              {isActive && (
                <div className="flex items-center gap-0.5 ml-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingFunnel(f.id); setFunnelDraft(f.name); }}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFunnel(f.id); }}
                    className="text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {addingFunnel ? (
          <div className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-card px-2 py-1">
            <input
              autoFocus
              value={newFunnelName}
              onChange={(e) => setNewFunnelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFunnel();
                if (e.key === "Escape") { setAddingFunnel(false); setNewFunnelName(""); }
              }}
              placeholder="Nome do funil"
              className="bg-surface rounded px-2 py-0.5 text-sm outline-none w-36"
            />
            <button onClick={createFunnel} className="text-xs rounded bg-gradient-primary px-2 py-0.5 font-bold text-primary-foreground">OK</button>
            <button onClick={() => { setAddingFunnel(false); setNewFunnelName(""); }} className="text-xs text-muted-foreground px-1">×</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingFunnel(true)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Novo funil
          </button>
        )}
      </div>

      {/* BOARD */}
      <div
        ref={boardRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden pb-4 scroll-smooth snap-x snap-mandatory md:snap-proximity [scrollbar-width:thin] overscroll-x-contain -mx-3 sm:mx-0 px-3 sm:px-0"
        style={{ scrollBehavior: "smooth" }}
      >
        {funnelCols.map((col) => {
          const list = funnelCards.filter(c => c.column_id === col.id).sort((a, b) => a.position - b.position);
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
              onDragOver={(e) => { e.preventDefault(); if (draggingCard) setOverCol(col.id); }}
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
              className={`snap-start flex-shrink-0 w-[85vw] max-w-[320px] md:w-[300px] rounded-xl border bg-surface/40 p-3 min-h-[420px] md:min-h-[500px] transition ${
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
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/col:opacity-100 transition">
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
                  const checklistDone = c.checklist.filter(i => i.done).length;
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
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition flex-shrink-0 p-1 -m-1"
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
          <div className="flex-shrink-0 w-[280px] md:w-[300px] rounded-xl border border-primary/40 bg-card p-3 h-fit space-y-2">
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
            className="flex-shrink-0 w-[280px] md:w-[300px] rounded-xl border border-dashed border-border h-[120px] text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition flex items-center justify-center gap-1"
          >
            <Plus className="h-4 w-4" /> Nova coluna
          </button>
        )}
      </div>

      {openCard && (
        <CardDialog
          card={openCard}
          columns={funnelCols}
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setNotes(card.notes ?? "");
  }, [card.id]);

  // Debounced autosave per field (700ms). Flushes on unmount/card switch.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingRef = useRef<Partial<Card>>({});
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    const patch = pendingRef.current;
    if (!patch || Object.keys(patch).length === 0) return;
    pendingRef.current = {};
    setSaveStatus("saving");
    try {
      await onUpdate(patch);
      setSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 1500);
    } catch {
      setSaveStatus("error");
    }
  }, [onUpdate]);

  const queueField = useCallback((field: keyof Card, value: unknown) => {
    pendingRef.current = { ...pendingRef.current, [field]: value };
    setSaveStatus("saving");
    const prev = timersRef.current.get(field as string);
    if (prev) clearTimeout(prev);
    timersRef.current.set(field as string, setTimeout(() => { void flush(); }, 700));
  }, [flush]);

  useEffect(() => () => { void flush(); }, [flush]);

  const addChecklistItem = () => {
    if (!newItem.trim()) return;
    const item: ChecklistItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: newItem.trim(), done: false };
    onUpdate({ checklist: [...card.checklist, item] });
    setNewItem("");
  };
  const toggleItem = (id: string) => onUpdate({ checklist: card.checklist.map((i) => i.id === id ? { ...i, done: !i.done } : i) });
  const removeItem = (id: string) => onUpdate({ checklist: card.checklist.filter((i) => i.id !== id) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 md:p-4" onClick={() => { void flush(); onClose(); }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10 gap-3">
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); queueField("title", e.target.value.trim() || card.title); }}
            onBlur={() => void flush()}
            className="flex-1 min-w-0 bg-transparent text-xl font-display font-bold outline-none"
          />
          <SaveIndicator status={saveStatus} />
          <button onClick={() => { void flush(); onClose(); }} className="text-muted-foreground hover:text-foreground p-1">
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
              onChange={(e) => { setDescription(e.target.value); queueField("description", e.target.value || null); }}
              onBlur={() => void flush()}
              rows={3}
              placeholder="Detalhes do card…"
              className="w-full bg-surface rounded px-2 py-2 text-sm resize-y"
            />
          </Field>

          <Field label="Anexos" icon={<Paperclip className="h-3.5 w-3.5" />}>
            <KanbanAttachments cardId={card.id} />
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
              onChange={(e) => { setNotes(e.target.value); queueField("notes", e.target.value || null); }}
              onBlur={() => void flush()}
              rows={2}
              placeholder="Notas, links, contexto…"
              className="w-full bg-surface rounded px-2 py-2 text-sm resize-y"
            />
          </Field>
        </div>

        <div className="flex justify-between items-center p-4 border-t border-border sticky bottom-0 bg-card">
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
