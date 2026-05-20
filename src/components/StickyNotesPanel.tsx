import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

interface StickyNoteRow {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  content: string;
  color: string;
  tag: string | null;
  position: number;
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

export function useStickyNotes() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [notes, setNotes] = useState<StickyNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  return { notes, loading, createNote, updateNoteLocal, deleteNote, cycleColor };
}

interface PanelProps {
  variant?: "compact" | "full";
  className?: string;
}

export function StickyNotesPanel({ variant = "compact", className = "" }: PanelProps) {
  const { notes, loading, createNote, updateNoteLocal, deleteNote, cycleColor } = useStickyNotes();
  const isFull = variant === "full";
  const gridCols = isFull ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" : "grid-cols-2";
  const minH = isFull ? "min-h-[160px]" : "min-h-[120px]";
  const titleSize = isFull ? "text-sm" : "text-[11px]";
  const bodySize = isFull ? "text-sm" : "text-[11px]";

  return (
    <div className={className}>
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
        <div className={`grid ${gridCols} gap-2`}>
          {notes.map((n) => {
            const c = COLORS[n.color] ?? COLORS.yellow;
            return (
              <div
                key={n.id}
                className={`group relative rounded-lg border ${c.border} ${c.bg} p-2 flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow ${minH}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <button
                    onClick={() => cycleColor(n)}
                    className={`h-3 w-3 rounded-full ${c.chip} ring-1 ring-background/40 shrink-0`}
                    title={`Cor: ${c.label} (clique para trocar)`}
                  />
                  <button
                    onClick={() => deleteNote(n.id)}
                    className="opacity-60 group-hover:opacity-100 h-5 w-5 grid place-items-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <input
                  value={n.title}
                  onChange={(e) => updateNoteLocal(n.id, { title: e.target.value })}
                  placeholder="Título"
                  className={`bg-transparent outline-none ${titleSize} font-semibold text-foreground placeholder:text-muted-foreground/60`}
                />
                <textarea
                  value={n.content}
                  onChange={(e) => updateNoteLocal(n.id, { content: e.target.value })}
                  placeholder="Anotação…"
                  rows={isFull ? 6 : 4}
                  className={`flex-1 bg-transparent outline-none ${bodySize} text-foreground/90 placeholder:text-muted-foreground/50 resize-none`}
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
  );
}
