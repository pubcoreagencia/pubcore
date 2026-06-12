import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import {
  Plus, Trash2, X, ZoomIn, ZoomOut, Maximize2, Link2, Paperclip, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { CompanyTag } from "@/components/CompanyTag";
import { KanbanAttachments } from "@/components/KanbanAttachments";
import { COMPANIES, type Company } from "@/lib/mock-data";
import { autoLayout, bottomAnchor, topAnchor, curvePath, NODE_W, NODE_H } from "@/lib/kanban-flow";
import { toast } from "sonner";

type Priority = "Baixa" | "Média" | "Alta" | "Crítica";
const PRIORITIES: Priority[] = ["Baixa", "Média", "Alta", "Crítica"];

interface FlowCard {
  id: string;
  title: string;
  description: string | null;
  company: Company;
  priority: Priority;
  assignee: string | null;
  status: string;
  due_date: string | null;
  notes: string | null;
  parent_card_id: string | null;
  flow_x: number | null;
  flow_y: number | null;
  funnel_id: string | null;
  column_id: string | null;
  position: number;
}

interface FlowLink {
  id: string;
  from_card_id: string;
  to_card_id: string;
  label: string | null;
}

const PRIO_STYLE: Record<Priority, string> = {
  Baixa: "bg-muted text-muted-foreground",
  Média: "bg-primary/15 text-primary",
  Alta: "bg-amber-500/15 text-amber-400",
  Crítica: "bg-rose-500/20 text-rose-300",
};

export function FlowCanvas({ funnelId }: { funnelId: string }) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const userId = user?.id;

  const [cards, setCards] = useState<FlowCard[]>([]);
  const [links, setLinks] = useState<FlowLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  // Viewport transform
  const [view, setView] = useState({ x: 80, y: 80, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Drag refs
  const panRef = useRef<{ active: boolean; pointerId: number; startX: number; startY: number; startVx: number; startVy: number }>({
    active: false, pointerId: -1, startX: 0, startY: 0, startVx: 0, startVy: 0,
  });
  const nodeDragRef = useRef<{ id: string | null; pointerId: number; startClientX: number; startClientY: number; origX: number; origY: number; moved: boolean }>({
    id: null, pointerId: -1, startClientX: 0, startClientY: 0, origX: 0, origY: 0, moved: false,
  });
  const pinchRef = useRef<{ active: boolean; startDist: number; startK: number; cx: number; cy: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Local position overrides during drag (avoid re-render storm)
  const [dragPos, setDragPos] = useState<Record<string, { x: number; y: number }>>({});

  // ---- Load ----
  useEffect(() => {
    if (!activeWorkspaceId || !funnelId) return;
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const [{ data: cs }, { data: ls }] = await Promise.all([
        supabase.from("kanban_cards").select("*").eq("workspace_id", activeWorkspaceId).eq("funnel_id", funnelId),
        supabase.from("kanban_card_links").select("*").eq("workspace_id", activeWorkspaceId).eq("funnel_id", funnelId),
      ]);
      if (cancelled) return;
      setCards(((cs ?? []) as unknown[]).map(normalize));
      setLinks(((ls ?? []) as FlowLink[]));
      setLoaded(true);
    })();

    const sfx = Math.random().toString(36).slice(2, 8);
    const ch = supabase.channel(`flow:${funnelId}:${sfx}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_cards", filter: `workspace_id=eq.${activeWorkspaceId}` }, async () => {
        const { data } = await supabase.from("kanban_cards").select("*").eq("workspace_id", activeWorkspaceId).eq("funnel_id", funnelId);
        setCards(((data ?? []) as unknown[]).map(normalize));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_card_links", filter: `workspace_id=eq.${activeWorkspaceId}` }, async () => {
        const { data } = await supabase.from("kanban_card_links").select("*").eq("workspace_id", activeWorkspaceId).eq("funnel_id", funnelId);
        setLinks(((data ?? []) as FlowLink[]));
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeWorkspaceId, funnelId]);

  // ---- Layout: merge persisted positions with auto-layout fallback ----
  const positions = useMemo(() => {
    const auto = autoLayout(cards.map(c => ({ id: c.id, parent_card_id: c.parent_card_id, flow_x: c.flow_x, flow_y: c.flow_y })));
    const out = new Map<string, { x: number; y: number }>();
    for (const c of cards) {
      if (c.flow_x != null && c.flow_y != null) out.set(c.id, { x: c.flow_x, y: c.flow_y });
      else if (auto.has(c.id)) out.set(c.id, auto.get(c.id)!);
      else out.set(c.id, { x: 0, y: 0 });
    }
    return out;
  }, [cards]);

  const effectivePos = useCallback((id: string) => dragPos[id] ?? positions.get(id) ?? { x: 0, y: 0 }, [dragPos, positions]);

  // ---- Viewport pan/zoom ----
  const onContainerWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const v = viewRef.current;
    const newK = Math.min(2.5, Math.max(0.2, v.k * factor));
    const ratio = newK / v.k;
    setView({ k: newK, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio });
  };

  const onBgPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (nodeDragRef.current.id) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = containerRef.current!.getBoundingClientRect();
      pinchRef.current = { active: true, startDist: dist, startK: viewRef.current.k, cx: (a.x + b.x) / 2 - rect.left, cy: (a.y + b.y) / 2 - rect.top };
      panRef.current.active = false;
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    panRef.current = { active: true, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startVx: viewRef.current.x, startVy: viewRef.current.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onBgPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchRef.current?.active && pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const { startDist, startK, cx, cy } = pinchRef.current;
      const newK = Math.min(2.5, Math.max(0.2, startK * (dist / startDist)));
      const v = viewRef.current;
      const ratio = newK / v.k;
      setView({ k: newK, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio });
      return;
    }
    if (!panRef.current.active || panRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setView(v => ({ ...v, x: panRef.current.startVx + dx, y: panRef.current.startVy + dy }));
  };
  const onBgPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (panRef.current.pointerId === e.pointerId) panRef.current.active = false;
  };

  // ---- Node drag ----
  const onNodePointerDown = (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation();
    const p = effectivePos(id);
    nodeDragRef.current = { id, pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, origX: p.x, origY: p.y, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onNodePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = nodeDragRef.current;
    if (!s.id || s.pointerId !== e.pointerId) return;
    const dx = (e.clientX - s.startClientX) / viewRef.current.k;
    const dy = (e.clientY - s.startClientY) / viewRef.current.k;
    if (!s.moved && Math.hypot(dx, dy) < 4) return;
    s.moved = true;
    setDragPos(p => ({ ...p, [s.id!]: { x: s.origX + dx, y: s.origY + dy } }));
  };
  const onNodePointerUp = async (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = nodeDragRef.current;
    if (!s.id || s.pointerId !== e.pointerId) return;
    const id = s.id;
    const moved = s.moved;
    nodeDragRef.current = { id: null, pointerId: -1, startClientX: 0, startClientY: 0, origX: 0, origY: 0, moved: false };
    if (moved) {
      const pos = dragPos[id];
      if (pos) {
        setCards(cs => cs.map(c => c.id === id ? { ...c, flow_x: pos.x, flow_y: pos.y } : c));
        setDragPos(p => { const n = { ...p }; delete n[id]; return n; });
        await supabase.from("kanban_cards").update({ flow_x: pos.x, flow_y: pos.y }).eq("id", id);
      }
    }
  };

  // ---- Card ops ----
  const createChild = async (parentId: string | null) => {
    if (!userId || !activeWorkspaceId) return;
    const parent = parentId ? cards.find(c => c.id === parentId) : null;
    const parentPos = parent ? effectivePos(parent.id) : { x: 100, y: 100 };
    const flow_x = parent ? parentPos.x + (Math.random() - 0.5) * 40 : parentPos.x;
    const flow_y = parent ? parentPos.y + NODE_H + 80 : parentPos.y;
    const { data, error } = await supabase.from("kanban_cards").insert({
      workspace_id: activeWorkspaceId,
      user_id: userId,
      owner_email: user?.email ?? "guest@pubcore.local",
      funnel_id: funnelId,
      title: parent ? "Novo nó" : "Novo fluxo",
      company: parent?.company ?? ((COMPANIES[0] ?? "") as Company),
      priority: "Média",
      status: "pending",
      position: 0,
      parent_card_id: parentId,
      flow_x, flow_y,
      legacy_checklist: [],
    } as never).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) setCards(cs => [...cs, normalize(data)]);
  };

  const deleteCard = async (id: string) => {
    if (!confirm("Excluir nó e seus filhos diretos?")) return;
    // Promote children to grandparent (preserve the rest of the tree).
    const c = cards.find(x => x.id === id);
    const newParent = c?.parent_card_id ?? null;
    await supabase.from("kanban_cards").update({ parent_card_id: newParent }).eq("parent_card_id", id);
    const { data: atts } = await supabase.from("kanban_attachments").select("storage_path").eq("card_id", id);
    if (atts && atts.length > 0) {
      await supabase.storage.from("kanban-attachments").remove(atts.map(a => a.storage_path));
      await supabase.from("kanban_attachments").delete().eq("card_id", id);
    }
    await supabase.from("kanban_cards").delete().eq("id", id);
    setCards(cs => cs.filter(x => x.id !== id).map(x => x.parent_card_id === id ? { ...x, parent_card_id: newParent } : x));
  };

  const updateCard = async (id: string, patch: Partial<FlowCard>) => {
    setCards(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
    await supabase.from("kanban_cards").update(patch as never).eq("id", id);
  };

  const connectNodes = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    if (!activeWorkspaceId) return;
    const { data, error } = await supabase.from("kanban_card_links").insert({
      workspace_id: activeWorkspaceId, funnel_id: funnelId,
      from_card_id: fromId, to_card_id: toId, label: null,
    } as never).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) setLinks(ls => [...ls, data as FlowLink]);
  };

  const deleteLink = async (id: string) => {
    setLinks(ls => ls.filter(l => l.id !== id));
    await supabase.from("kanban_card_links").delete().eq("id", id);
  };

  // ---- Fit / reset ----
  const fitToContent = useCallback(() => {
    if (cards.length === 0) { setView({ x: 80, y: 80, k: 1 }); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cards) {
      const p = effectivePos(c.id);
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_W); maxY = Math.max(maxY, p.y + NODE_H);
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pad = 80;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const k = Math.min(1.2, Math.min(rect.width / w, rect.height / h));
    setView({ k, x: pad * k - minX * k + (rect.width - w * k) / 2, y: pad * k - minY * k + (rect.height - h * k) / 2 });
  }, [cards, effectivePos]);

  // Auto-fit on first load
  const didFitRef = useRef(false);
  useEffect(() => {
    if (loaded && !didFitRef.current && cards.length > 0) {
      didFitRef.current = true;
      requestAnimationFrame(fitToContent);
    }
  }, [loaded, cards.length, fitToContent]);

  // ---- Render ----
  const openCard = openCardId ? cards.find(c => c.id === openCardId) ?? null : null;

  return (
    <div className="relative w-full h-[calc(100dvh-260px)] min-h-[480px] rounded-xl border border-border bg-surface/40 overflow-hidden select-none">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur px-2 py-1.5 shadow-card">
        <button onClick={() => createChild(null)} className="inline-flex items-center gap-1.5 rounded bg-gradient-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Novo nó raiz
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button onClick={() => setView(v => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setView(v => ({ ...v, k: Math.max(0.2, v.k / 1.2) }))} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button onClick={fitToContent} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Ajustar à tela">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground font-mono ml-1">{Math.round(view.k * 100)}%</span>
      </div>

      {connectFrom && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-primary/40 bg-card/90 backdrop-blur px-3 py-1.5 text-xs">
          <Link2 className="h-3.5 w-3.5 text-primary" />
          <span>Clique no nó de destino…</span>
          <button onClick={() => setConnectFrom(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Carregando fluxo…</div>
      )}

      {loaded && cards.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>Nenhum nó ainda neste funil.</p>
          <button onClick={() => createChild(null)} className="inline-flex items-center gap-2 rounded bg-gradient-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Criar primeiro nó
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        onWheel={onContainerWheel}
        onPointerDown={onBgPointerDown}
        onPointerMove={(e) => { onBgPointerMove(e); onNodePointerMove(e); }}
        onPointerUp={(e) => { onBgPointerUp(e); void onNodePointerUp(e); }}
        onPointerCancel={(e) => { onBgPointerUp(e); void onNodePointerUp(e); }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none", background: "radial-gradient(circle, oklch(0.3 0 0 / 0.15) 1px, transparent 1px) 0 0 / 24px 24px" }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, willChange: "transform" }}
        >
          {/* SVG edges */}
          <svg width="8000" height="8000" className="absolute top-0 left-0 pointer-events-none overflow-visible">
            {cards.map(c => {
              if (!c.parent_card_id) return null;
              const parent = cards.find(p => p.id === c.parent_card_id);
              if (!parent) return null;
              const a = bottomAnchor(effectivePos(parent.id));
              const b = topAnchor(effectivePos(c.id));
              return <path key={`p-${c.id}`} d={curvePath(a, b)} fill="none" stroke="oklch(0.6 0.02 260)" strokeWidth={2} opacity={0.55} />;
            })}
            {links.map(l => {
              const from = cards.find(c => c.id === l.from_card_id);
              const to = cards.find(c => c.id === l.to_card_id);
              if (!from || !to) return null;
              const a = bottomAnchor(effectivePos(from.id));
              const b = topAnchor(effectivePos(to.id));
              return (
                <g key={l.id} className="pointer-events-auto">
                  <path d={curvePath(a, b)} fill="none" stroke="oklch(0.72 0.16 220)" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} />
                  <circle
                    cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={8}
                    fill="oklch(0.2 0 0)" stroke="oklch(0.72 0.16 220)"
                    onClick={(e) => { e.stopPropagation(); if (confirm("Remover esta conexão?")) deleteLink(l.id); }}
                    style={{ cursor: "pointer" }}
                  />
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 3} textAnchor="middle" fontSize={10} fill="oklch(0.72 0.16 220)" style={{ pointerEvents: "none" }}>×</text>
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {cards.map(c => {
            const p = effectivePos(c.id);
            const isConnectingSrc = connectFrom === c.id;
            return (
              <div
                key={c.id}
                onPointerDown={onNodePointerDown(c.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (nodeDragRef.current.moved) return;
                  if (connectFrom) {
                    if (connectFrom !== c.id) { connectNodes(connectFrom, c.id); setConnectFrom(null); }
                    return;
                  }
                  setOpenCardId(c.id);
                }}
                className={`absolute rounded-xl border bg-card shadow-card hover:shadow-glow transition cursor-grab active:cursor-grabbing ${
                  isConnectingSrc ? "border-primary ring-2 ring-primary/40" : c.status === "done" ? "border-emerald-500/40" : "border-border hover:border-primary/40"
                }`}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, touchAction: "none" }}
              >
                <div className="p-2.5 h-full flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className={`font-medium text-sm leading-snug line-clamp-2 flex-1 ${c.status === "done" ? "line-through text-muted-foreground" : ""}`}>{c.title}</h4>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); deleteCard(c.id); }}
                      className="text-muted-foreground hover:text-destructive flex-shrink-0 p-0.5"
                    ><Trash2 className="h-3 w-3" /></button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                    <CompanyTag company={c.company} />
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${PRIO_STYLE[c.priority]}`}>{c.priority}</span>
                  </div>
                </div>
                {/* Add-child + connect handles */}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); createChild(c.id); }}
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center opacity-70 hover:opacity-100"
                  title="Adicionar filho"
                ><Plus className="h-3.5 w-3.5" /></button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setConnectFrom(connectFrom === c.id ? null : c.id); }}
                  className={`absolute -top-2 -right-2 h-5 w-5 rounded-full border ${isConnectingSrc ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-primary hover:border-primary/60"} flex items-center justify-center`}
                  title="Conectar a outro nó"
                ><Link2 className="h-3 w-3" /></button>
              </div>
            );
          })}
        </div>
      </div>

      {openCard && (
        <NodeDialog
          card={openCard}
          onClose={() => setOpenCardId(null)}
          onUpdate={(patch) => updateCard(openCard.id, patch)}
          onDelete={() => { void deleteCard(openCard.id); setOpenCardId(null); }}
        />
      )}
    </div>
  );
}

function normalize(c: unknown): FlowCard {
  const r = c as Record<string, unknown>;
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    company: r.company as Company,
    priority: (PRIORITIES as string[]).includes(r.priority as string) ? (r.priority as Priority) : "Média",
    assignee: (r.assignee as string | null) ?? null,
    status: (r.status as string) ?? "pending",
    due_date: (r.due_date as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    parent_card_id: (r.parent_card_id as string | null) ?? null,
    flow_x: (r.flow_x as number | null) ?? null,
    flow_y: (r.flow_y as number | null) ?? null,
    funnel_id: (r.funnel_id as string | null) ?? null,
    column_id: (r.column_id as string | null) ?? null,
    position: (r.position as number) ?? 0,
  };
}

function NodeDialog({
  card, onClose, onUpdate, onDelete,
}: {
  card: FlowCard;
  onClose: () => void;
  onUpdate: (patch: Partial<FlowCard>) => Promise<void>;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [notes, setNotes] = useState(card.notes ?? "");

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setNotes(card.notes ?? "");
  }, [card.id]);

  const commitTitle = () => { const v = title.trim() || card.title; if (v !== card.title) void onUpdate({ title: v }); };
  const commitDescription = () => { if ((description || null) !== card.description) void onUpdate({ description: description || null }); };
  const commitNotes = () => { if ((notes || null) !== card.notes) void onUpdate({ notes: notes || null }); };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl h-[100dvh] md:h-auto md:max-h-[90vh] overflow-y-auto md:rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border sticky top-0 bg-card z-10 gap-2" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            className="flex-1 min-w-0 bg-transparent text-lg sm:text-xl font-display font-bold outline-none"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-3 sm:p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Status">
              <select value={card.status} onChange={(e) => void onUpdate({ status: e.target.value })} className="w-full bg-surface rounded px-2 py-1.5 text-sm">
                <option value="pending">Aberto</option>
                <option value="in_progress">Em progresso</option>
                <option value="blocked">Bloqueado</option>
                <option value="done">Concluído</option>
              </select>
            </Field>
            <Field label="Empresa">
              <select value={card.company} onChange={(e) => void onUpdate({ company: e.target.value as Company })} className="w-full bg-surface rounded px-2 py-1.5 text-sm">
                {COMPANIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select value={card.priority} onChange={(e) => void onUpdate({ priority: e.target.value as Priority })} className="w-full bg-surface rounded px-2 py-1.5 text-sm">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Responsável">
              <input value={card.assignee ?? ""} onChange={(e) => void onUpdate({ assignee: e.target.value || null })} placeholder="Nome do responsável" className="w-full bg-surface rounded px-2 py-1.5 text-sm" />
            </Field>
            <Field label="Data">
              <input type="date" value={card.due_date ?? ""} onChange={(e) => void onUpdate({ due_date: e.target.value || null })} className="w-full bg-surface rounded px-2 py-1.5 text-sm" />
            </Field>
          </div>

          <Field label="Descrição" icon={<FileText className="h-3.5 w-3.5" />}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={commitDescription} rows={3} placeholder="Detalhes do nó…" className="w-full bg-surface rounded px-2 py-2 text-sm resize-y" />
          </Field>

          <Field label="Anexos" icon={<Paperclip className="h-3.5 w-3.5" />}>
            <KanbanAttachments cardId={card.id} />
          </Field>

          <Field label="Observações">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={commitNotes} rows={2} placeholder="Notas, links, contexto…" className="w-full bg-surface rounded px-2 py-2 text-sm resize-y" />
          </Field>

          <div className="flex justify-end pt-2 border-t border-border">
            <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Excluir nó
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {icon}{label}
      </div>
      {children}
    </div>
  );
}
