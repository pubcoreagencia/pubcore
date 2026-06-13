import { useState, useEffect, useRef, useCallback } from "react";
import { StickyNote, X, Minus, Plus, Trash2, GripVertical } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

const POS_KEY = "pubcore:sticky:widget:pos";
const OPEN_KEY = "pubcore:sticky:widget:open";

type Pos = { x: number; y: number };

interface StickyNoteRow {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  content: string;
  color: string;
  category: string;
  favorite: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

const COLORS: Record<string, { bg: string; border: string; chip: string; label: string }> = {
  yellow: { bg: "bg-amber-300/15", border: "border-amber-300/40", chip: "bg-amber-300", label: "Amarelo" },
  pink:   { bg: "bg-pink-400/15",  border: "border-pink-400/40",  chip: "bg-pink-400",  label: "Rosa" },
  blue:   { bg: "bg-sky-400/15",   border: "border-sky-400/40",   chip: "bg-sky-400",   label: "Azul" },
  green:  { bg: "bg-emerald-400/15",border: "border-emerald-400/40",chip: "bg-emerald-400",label: "Verde" },
  purple: { bg: "bg-violet-400/15",border: "border-violet-400/40",chip: "bg-violet-400",label: "Roxo" },
};
const COLOR_KEYS = Object.keys(COLORS);

function loadPos(): Pos | null {
  if (typeof window === "undefined") return null;
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
    if (p && typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {}
  return null;
}

const MOBILE_BREAKPOINT = 768;
const BOTTOM_NAV_RESERVE = 80;
const TOP_RESERVE = 12;

function isMobile() {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}

function defaultPos(): Pos {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  const margin = isMobile() ? 12 : 24;
  const bottomReserve = isMobile() ? BOTTOM_NAV_RESERVE : margin;
  // Stack acima da calculadora (que fica no canto direito por padrão)
  return {
    x: margin,
    y: window.innerHeight - 48 - bottomReserve,
  };
}

export function StickyNotesWidget() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [pos, setPos] = useState<Pos>(() => loadPos() ?? defaultPos());
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<StickyNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0, dragging: false, moved: false });
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    try { setOpen(sessionStorage.getItem(OPEN_KEY) === "1"); } catch {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch {}
  }, [open]);

  useEffect(() => {
    const clamp = () => {
      setPos((p) => {
        const w = containerRef.current?.offsetWidth ?? 48;
        const h = containerRef.current?.offsetHeight ?? 48;
        const mobile = isMobile();
        const bottomReserve = mobile ? BOTTOM_NAV_RESERVE : 8;
        const sideMargin = 8;
        return {
          x: Math.max(sideMargin, Math.min(p.x, window.innerWidth - w - sideMargin)),
          y: Math.max(TOP_RESERVE, Math.min(p.y, window.innerHeight - h - bottomReserve)),
        };
      });
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [open]);

  useEffect(() => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
  }, [pos]);

  // Fetch + realtime
  useEffect(() => {
    if (!activeWorkspaceId) { setNotes([]); return; }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("sticky_notes")
        .select("*")
        .eq("workspace_id", activeWorkspaceId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (active && data) setNotes(data as StickyNoteRow[]);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`sticky_notes:${activeWorkspaceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "sticky_notes", filter: `workspace_id=eq.${activeWorkspaceId}` },
        (payload) => {
          setNotes((prev) => {
            if (payload.eventType === "INSERT") {
              const n = payload.new as StickyNoteRow;
              if (prev.some((x) => x.id === n.id)) return prev;
              return [...prev, n].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const n = payload.new as StickyNoteRow;
              return prev.map((x) => (x.id === n.id ? { ...x, ...n } : x));
            }
            if (payload.eventType === "DELETE") {
              const n = payload.old as StickyNoteRow;
              return prev.filter((x) => x.id !== n.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, [activeWorkspaceId]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, dragging: true, moved: false };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    const w = containerRef.current?.offsetWidth ?? 48;
    const h = containerRef.current?.offsetHeight ?? 48;
    const mobile = isMobile();
    const bottomReserve = mobile ? BOTTOM_NAV_RESERVE : 8;
    setPos({
      x: Math.max(8, Math.min(d.origX + dx, window.innerWidth - w - 8)),
      y: Math.max(TOP_RESERVE, Math.min(d.origY + dy, window.innerHeight - h - bottomReserve)),
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent, onClick?: () => void) => {
    const d = dragRef.current;
    const moved = d.moved;
    d.dragging = false;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
    if (!moved && onClick) onClick();
  }, []);

  const createNote = useCallback(async () => {
    if (!activeWorkspaceId || !user) return;
    const maxPos = notes.reduce((m, n) => Math.max(m, n.position), 0);
    const { data } = await supabase
      .from("sticky_notes")
      .insert({
        workspace_id: activeWorkspaceId,
        user_id: user.id,
        owner_email: user.email ?? "",
        title: "",
        content: "",
        color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
        position: maxPos + 1,
      })
      .select()
      .single();
    if (data) setNotes((prev) => [...prev, data as StickyNoteRow]);
  }, [activeWorkspaceId, user, notes]);

  const updateNoteLocal = useCallback((id: string, patch: Partial<StickyNoteRow>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      await supabase.from("sticky_notes").update(patch).eq("id", id);
    }, 500);
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("sticky_notes").delete().eq("id", id);
  }, []);

  const cycleColor = useCallback((n: StickyNoteRow) => {
    const idx = COLOR_KEYS.indexOf(n.color);
    const next = COLOR_KEYS[(idx + 1) % COLOR_KEYS.length];
    updateNoteLocal(n.id, { color: next });
  }, [updateNoteLocal]);

  if (!path.startsWith("/app")) return null;

  return (
    <div
      ref={containerRef}
      style={{ left: pos.x, top: pos.y, width: "max-content", maxWidth: "calc(100dvw - 16px)" }}
      className="fixed z-50 select-none"
    >
      {open ? (
        <div className="w-[340px] max-w-[calc(100dvw-16px)] rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden animate-scale-in">
          <div
            className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-background/40 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => onPointerUp(e)}
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-amber-300/20 grid place-items-center">
                <StickyNote className="h-3.5 w-3.5 text-amber-300" />
              </div>
              <span className="text-xs font-medium text-foreground">Sticky Notes</span>
              <span className="text-[10px] text-muted-foreground">({notes.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={createNote}
                className="h-6 w-6 grid place-items-center rounded hover:bg-primary/20 text-muted-foreground hover:text-primary"
                aria-label="Nova nota"
                title="Nova nota"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 grid place-items-center rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                aria-label="Minimizar"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                aria-label="Fechar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="p-3 max-h-[60dvh] overflow-y-auto overscroll-contain">
            {loading && notes.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8">Carregando…</div>
            ) : notes.length === 0 ? (
              <button
                onClick={createNote}
                className="w-full py-10 rounded-xl border-2 border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition flex flex-col items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Criar primeira nota
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {notes.map((n) => {
                  const c = COLORS[n.color] ?? COLORS.yellow;
                  return (
                    <div
                      key={n.id}
                      className={`group relative rounded-lg border ${c.border} ${c.bg} p-2 flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow min-h-[120px]`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <button
                          onClick={() => cycleColor(n)}
                          className={`h-3 w-3 rounded-full ${c.chip} ring-1 ring-background/40 shrink-0`}
                          title={`Cor: ${c.label} (clique para trocar)`}
                        />
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="opacity-0 group-hover:opacity-100 h-5 w-5 grid place-items-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <input
                        value={n.title}
                        onChange={(e) => updateNoteLocal(n.id, { title: e.target.value })}
                        placeholder="Título"
                        className="bg-transparent outline-none text-[11px] font-semibold text-foreground placeholder:text-muted-foreground/60"
                      />
                      <textarea
                        value={n.content}
                        onChange={(e) => updateNoteLocal(n.id, { content: e.target.value })}
                        placeholder="Anotação…"
                        rows={4}
                        className="flex-1 bg-transparent outline-none text-[11px] text-foreground/90 placeholder:text-muted-foreground/50 resize-none"
                      />
                      <div className="text-[9px] text-muted-foreground/60">
                        {new Date(n.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => onPointerUp(e, () => setOpen(true))}
          className="relative h-12 w-12 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-xl shadow-amber-500/30 grid place-items-center hover:scale-110 transition-transform touch-none animate-fade-in"
          aria-label="Abrir sticky notes"
        >
          <StickyNote className="h-5 w-5" />
          {notes.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center">
              {notes.length}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
