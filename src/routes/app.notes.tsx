import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus, Search, Star, Trash2, FileText, Sparkles, Pin, Tag as TagIcon,
  Clock, Grid2x2, List as ListIcon, Loader2, X, Settings2, Pencil,
  ArrowUp, ArrowDown, Lightbulb, Target, Megaphone, Hammer, Compass,
  Brain, Cog, Folder, Rocket, Heart, Flag, Bookmark, Zap, Palette, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { COMPANIES, type Company } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { logActivity } from "@/lib/activity-log";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notes")({ component: NotesPage });

// ----- Icons registry -----
const ICONS = {
  Sparkles, Lightbulb, Target, Megaphone, Hammer, Compass, Brain, Cog,
  Folder, Rocket, Heart, Flag, Bookmark, Zap, FileText,
} as const;
type IconName = keyof typeof ICONS;
const ICON_NAMES = Object.keys(ICONS) as IconName[];

const DEFAULT_PALETTE = [
  "oklch(0.78 0.15 75)",
  "oklch(0.72 0.16 220)",
  "oklch(0.72 0.18 25)",
  "oklch(0.7 0.18 280)",
  "oklch(0.74 0.16 195)",
  "oklch(0.74 0.16 340)",
  "oklch(0.7 0.14 145)",
  "oklch(0.78 0.16 50)",
  "oklch(0.7 0.18 310)",
  "oklch(0.74 0.16 260)",
];

const DEFAULT_CATEGORIES: { name: string; color: string; icon: IconName }[] = [
  { name: "Ideias", color: "oklch(0.78 0.15 75)", icon: "Lightbulb" },
  { name: "Planejamento", color: "oklch(0.72 0.16 220)", icon: "Target" },
  { name: "Marketing", color: "oklch(0.72 0.18 25)", icon: "Megaphone" },
  { name: "Produção", color: "oklch(0.7 0.18 280)", icon: "Hammer" },
  { name: "Estratégia", color: "oklch(0.74 0.16 195)", icon: "Compass" },
  { name: "Brainstorming", color: "oklch(0.74 0.16 340)", icon: "Brain" },
  { name: "Operacional", color: "oklch(0.7 0.14 145)", icon: "Cog" },
];

interface NoteCategory {
  id: string;
  name: string;
  color: string;
  icon: IconName;
  position: number;
}

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  company: Company | null;
  tags: string[];
  favorite: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

type View = "grid" | "list";
type Filter = { kind: "all" } | { kind: "favorites" } | { kind: "recent" } | { kind: "category"; name: string };

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function NotesPage() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const userId = user?.id;
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [view, setView] = useState<View>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const catByName = useMemo(() => {
    const m = new Map<string, NoteCategory>();
    categories.forEach((c) => m.set(c.name, c));
    return m;
  }, [categories]);

  const colorOf = (name: string) => catByName.get(name)?.color ?? "oklch(0.7 0 0)";
  const iconOf = (name: string): IconName => catByName.get(name)?.icon ?? "FileText";

  // ---- Load + realtime ----
  useEffect(() => {
    if (!userId || !activeWorkspaceId) return;
    let cancelled = false;
    const loadNotes = async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("workspace_id", activeWorkspaceId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) toast.error(error.message);
      setNotes((data ?? []) as Note[]);
    };
    const loadCats = async () => {
      const { data, error } = await supabase
        .from("note_categories" as never)
        .select("*")
        .eq("workspace_id", activeWorkspaceId)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (error) { toast.error(error.message); return; }
      let cats = (data ?? []) as NoteCategory[];
      // Seed defaults if empty
      if (cats.length === 0) {
        const seeds = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, workspace_id: activeWorkspaceId, user_id: userId, position: i }));
        const { data: inserted } = await supabase.from("note_categories" as never).insert(seeds as never).select();
        cats = ((inserted ?? []) as NoteCategory[]).sort((a, b) => a.position - b.position);
      }
      setCategories(cats);
    };
    Promise.all([loadNotes(), loadCats()]).finally(() => { if (!cancelled) setLoading(false); });

    const ch = supabase
      .channel(`notes-mod:${activeWorkspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `workspace_id=eq.${activeWorkspaceId}` }, loadNotes)
      .on("postgres_changes", { event: "*", schema: "public", table: "note_categories", filter: `workspace_id=eq.${activeWorkspaceId}` }, loadCats)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [userId, activeWorkspaceId]);

  // ---- Filtering ----
  const filtered = useMemo(() => {
    let list = notes;
    if (filter.kind === "favorites") list = list.filter((n) => n.favorite);
    else if (filter.kind === "recent") list = list.slice(0, 12);
    else if (filter.kind === "category") list = list.filter((n) => n.category === filter.name);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [notes, filter, search]);

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  // ---- Counts ----
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      __all: notes.length,
      __fav: notes.filter((n) => n.favorite).length,
    };
    for (const c of categories) map[c.name] = 0;
    for (const n of notes) map[n.category] = (map[n.category] ?? 0) + 1;
    return map;
  }, [notes, categories]);

  // ---- Notes CRUD ----
  const createNote = async () => {
    if (!userId || !activeWorkspaceId) return;
    const cat = filter.kind === "category" ? filter.name : (categories[0]?.name ?? "Ideias");
    const { data, error } = await supabase
      .from("notes")
      .insert({
        workspace_id: activeWorkspaceId,
        user_id: userId,
        owner_email: user?.email ?? "unknown",
        user_name: user?.name ?? null,
        title: "Nova nota",
        content: "",
        category: cat,
      } as never)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    if (data) setSelectedId((data as Note).id);
  };

  const removeNote = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (selectedId === id) setSelectedId(null);
    if (n) {
      await logActivity({
        entity_type: "note",
        entity_id: id,
        action: "deleted",
        title: n.title,
        company: n.company,
        payload: { category: n.category, tags: n.tags },
      });
    }
  };

  const toggleFav = async (id: string, v: boolean) => {
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, favorite: v } : n)));
    await supabase.from("notes").update({ favorite: v }).eq("id", id);
  };

  const togglePin = async (id: string, v: boolean) => {
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, pinned: v } : n)));
    await supabase.from("notes").update({ pinned: v }).eq("id", id);
  };

  // ---- Category CRUD ----
  const createCategory = async (name: string, color: string, icon: IconName) => {
    if (!userId || !activeWorkspaceId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Já existe uma categoria com esse nome");
      return;
    }
    const position = (categories[categories.length - 1]?.position ?? -1) + 1;
    const { error } = await supabase
      .from("note_categories" as never)
      .insert({ workspace_id: activeWorkspaceId, user_id: userId, name: trimmed, color, icon, position } as never);
    if (error) toast.error(error.message);
  };

  const updateCategory = async (id: string, patch: Partial<NoteCategory>) => {
    const original = categories.find((c) => c.id === id);
    if (!original) return;
    if (patch.name && patch.name !== original.name) {
      const newName = patch.name.trim();
      if (!newName) return;
      if (categories.some((c) => c.id !== id && c.name.toLowerCase() === newName.toLowerCase())) {
        toast.error("Já existe uma categoria com esse nome");
        return;
      }
      // Cascade rename on notes
      await supabase.from("notes").update({ category: newName }).eq("user_id", userId!).eq("category", original.name);
      patch = { ...patch, name: newName };
      // Update local filter if needed
      if (filter.kind === "category" && filter.name === original.name) {
        setFilter({ kind: "category", name: newName });
      }
    }
    const { error } = await supabase.from("note_categories" as never).update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteCategory = async (id: string) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return;
    const used = notes.filter((n) => n.category === c.name).length;
    const fallback = categories.find((x) => x.id !== id)?.name;
    if (used > 0 && !fallback) {
      toast.error("Crie outra categoria antes de excluir esta");
      return;
    }
    if (!confirm(`Excluir categoria "${c.name}"?${used > 0 ? `\n${used} nota(s) serão movidas para "${fallback}".` : ""}`)) return;
    if (used > 0 && fallback) {
      await supabase.from("notes").update({ category: fallback }).eq("user_id", userId!).eq("category", c.name);
    }
    const { error } = await supabase.from("note_categories" as never).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (filter.kind === "category" && filter.name === c.name) setFilter({ kind: "all" });
  };

  const moveCategory = async (id: string, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= categories.length) return;
    const a = categories[idx];
    const b = categories[swapIdx];
    setCategories((cs) => {
      const next = [...cs];
      next[idx] = { ...b, position: a.position };
      next[swapIdx] = { ...a, position: b.position };
      return next.sort((x, y) => x.position - y.position);
    });
    await Promise.all([
      supabase.from("note_categories" as never).update({ position: b.position } as never).eq("id", a.id),
      supabase.from("note_categories" as never).update({ position: a.position } as never).eq("id", b.id),
    ]);
  };

  // ---- Autosave editor (per-id debounced, flushes on switch/unmount) ----
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingRef = useRef<Map<string, Partial<Note>>>(new Map());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushNote = useCallback(async (id: string) => {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
    const patch = pendingRef.current.get(id);
    if (!patch) return;
    pendingRef.current.delete(id);
    setSaveStatus("saving");
    const { error } = await supabase.from("notes").update(patch as never).eq("id", id);
    if (error) { setSaveStatus("error"); toast.error(error.message); return; }
    setSaveStatus("saved");
    setSaving(false);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 1500);
  }, []);

  const queueSave = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)));
    const merged = { ...(pendingRef.current.get(id) ?? {}), ...patch };
    pendingRef.current.set(id, merged);
    setSaving(true);
    setSaveStatus("saving");
    const prev = timersRef.current.get(id);
    if (prev) clearTimeout(prev);
    timersRef.current.set(id, setTimeout(() => { void flushNote(id); }, 600));
  }, [flushNote]);

  // Flush all pending writes on unmount
  useEffect(() => () => {
    const ids = Array.from(pendingRef.current.keys());
    ids.forEach((id) => { void flushNote(id); });
  }, [flushNote]);

  // Flush previous note when selection changes
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSelectedRef.current;
    if (prev && prev !== selectedId && pendingRef.current.has(prev)) {
      void flushNote(prev);
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, flushNote]);

  const filterLabel =
    filter.kind === "all" ? "Todas as notas"
    : filter.kind === "favorites" ? "Favoritas"
    : filter.kind === "recent" ? "Recentes"
    : filter.name;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      {/* ============ Notes Sidebar ============ */}
      <aside className="w-64 shrink-0 border-r border-border/60 bg-card/30 backdrop-blur-sm flex flex-col">
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-semibold tracking-tight">Notas</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">Central criativa da holding</p>
        </div>

        <div className="px-3">
          <Button onClick={createNote} className="w-full gap-2 h-9" size="sm">
            <Plus className="h-4 w-4" /> Nova nota
          </Button>
        </div>

        <div className="px-3 pt-4 space-y-0.5 overflow-y-auto flex-1">
          <SidebarItem
            icon={FileText} label="Todas" count={counts.__all}
            active={filter.kind === "all"} onClick={() => setFilter({ kind: "all" })}
          />
          <SidebarItem
            icon={Star} label="Favoritas" count={counts.__fav}
            active={filter.kind === "favorites"} onClick={() => setFilter({ kind: "favorites" })}
          />
          <SidebarItem
            icon={Clock} label="Recentes" count={Math.min(notes.length, 12)}
            active={filter.kind === "recent"} onClick={() => setFilter({ kind: "recent" })}
          />

          <div className="flex items-center justify-between px-3 pt-5 pb-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">Categorias</span>
            <button
              onClick={() => setManageOpen(true)}
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
              title="Gerenciar categorias"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {categories.map((c) => {
            const Icon = ICONS[c.icon] ?? Sparkles;
            return (
              <SidebarItem
                key={c.id}
                customIcon={<Icon className="h-3.5 w-3.5" style={{ color: c.color }} />}
                label={c.name}
                count={counts[c.name] ?? 0}
                active={filter.kind === "category" && filter.name === c.name}
                onClick={() => setFilter({ kind: "category", name: c.name })}
              />
            );
          })}
          <button
            onClick={() => setManageOpen(true)}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground/70 hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="flex-1 text-left">Nova categoria</span>
          </button>
        </div>
      </aside>

      {/* ============ List Pane ============ */}
      <section className="w-[360px] shrink-0 border-r border-border/60 flex flex-col bg-background">
        <div className="px-4 pt-5 pb-3 space-y-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm tracking-tight capitalize">{filterLabel}</h3>
            <div className="flex items-center gap-0.5 rounded-md bg-secondary/60 p-0.5">
              <button
                onClick={() => setView("grid")}
                className={`p-1.5 rounded transition-colors ${view === "grid" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Grid"
              >
                <Grid2x2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-1.5 rounded transition-colors ${view === "list" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Lista"
              >
                <ListIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar notas, tags…"
              className="pl-8 h-9 text-sm bg-secondary/40 border-border/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma nota encontrada</p>
              <Button variant="ghost" size="sm" onClick={createNote} className="mt-3 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Criar primeira nota
              </Button>
            </div>
          ) : view === "grid" ? (
            <div className="p-3 grid grid-cols-1 gap-2">
              {filtered.map((n) => (
                <NoteCard
                  key={n.id} note={n}
                  color={colorOf(n.category)}
                  active={selectedId === n.id}
                  onClick={() => setSelectedId(n.id)}
                  onFav={(v) => toggleFav(n.id, v)}
                  onPin={(v) => togglePin(n.id, v)}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filtered.map((n) => (
                <NoteRow
                  key={n.id} note={n}
                  color={colorOf(n.category)}
                  active={selectedId === n.id}
                  onClick={() => setSelectedId(n.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ Editor ============ */}
      <main className="flex-1 min-w-0 flex flex-col bg-background">
        {selected ? (
          <Editor
            key={selected.id}
            note={selected}
            categories={categories}
            color={colorOf(selected.category)}
            iconName={iconOf(selected.category)}
            saving={saving}
            onChange={(patch) => queueSave(selected.id, patch)}
            onDelete={() => removeNote(selected.id)}
            onClose={() => setSelectedId(null)}
            onFav={(v) => toggleFav(selected.id, v)}
            onPin={(v) => togglePin(selected.id, v)}
          />
        ) : (
          <EmptyEditor onCreate={createNote} />
        )}
      </main>

      <ManageCategoriesDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        categories={categories}
        counts={counts}
        onCreate={createCategory}
        onUpdate={updateCategory}
        onDelete={deleteCategory}
        onMove={moveCategory}
      />
    </div>
  );
}

// ============= Sub-components =============

function SidebarItem({
  icon: Icon, label, count, active, onClick, customIcon,
}: {
  icon?: typeof FileText;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  customIcon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors group ${
        active ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      }`}
    >
      {customIcon ? customIcon : Icon ? (
        <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
      ) : null}
      <span className="flex-1 text-left truncate">{label}</span>
      {count > 0 && (
        <span className={`text-[10px] tabular-nums ${active ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function NoteCard({
  note, color, active, onClick, onFav, onPin,
}: {
  note: Note; color: string; active: boolean; onClick: () => void;
  onFav: (v: boolean) => void; onPin: (v: boolean) => void;
}) {
  const preview = note.content.replace(/\s+/g, " ").trim().slice(0, 90);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`group relative text-left rounded-xl border p-3 transition-all cursor-pointer ${
        active
          ? "border-primary/50 bg-secondary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
          : "border-border/40 bg-card/40 hover:border-border hover:bg-card/70"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {note.pinned && <Pin className="h-3 w-3 text-primary fill-primary flex-shrink-0" />}
          <span className="text-[10px] uppercase tracking-wider font-semibold truncate" style={{ color }}>
            {note.category}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onPin(!note.pinned); }}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <Pin className={`h-3 w-3 ${note.pinned ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFav(!note.favorite); }}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <Star className={`h-3 w-3 ${note.favorite ? "fill-warning text-warning" : ""}`} />
          </button>
        </div>
      </div>
      <h4 className="font-medium text-sm text-foreground line-clamp-1 mb-1">{note.title || "Sem título"}</h4>
      {preview && <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">{preview}</p>}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/30">
        <div className="flex items-center gap-1.5 min-w-0">
          {note.company && <CompanyTag company={note.company} />}
          {note.tags.slice(0, 2).map((t) => (
            <span key={t} className="text-[9px] text-muted-foreground bg-secondary/60 rounded px-1.5 py-0.5">
              #{t}
            </span>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
          {formatRelative(note.updated_at)}
        </span>
      </div>
    </div>
  );
}

function NoteRow({ note, color, active, onClick }: { note: Note; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-colors ${
        active ? "bg-secondary/70" : "hover:bg-secondary/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{note.title || "Sem título"}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{formatRelative(note.updated_at)}</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] uppercase tracking-wider truncate" style={{ color }}>{note.category}</span>
        {note.favorite && <Star className="h-3 w-3 fill-warning text-warning" />}
      </div>
    </button>
  );
}

function EmptyEditor({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-4">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold mb-2">Selecione ou crie uma nota</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Capture ideias, planejamentos e brainstormings da holding em um espaço fluido e organizado.
        </p>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Criar nova nota
        </Button>
      </div>
    </div>
  );
}

function Editor({
  note, categories, color, iconName, saving, onChange, onDelete, onClose, onFav, onPin,
}: {
  note: Note;
  categories: NoteCategory[];
  color: string;
  iconName: IconName;
  saving: boolean;
  onChange: (patch: Partial<Note>) => void;
  onDelete: () => void;
  onClose: () => void;
  onFav: (v: boolean) => void;
  onPin: (v: boolean) => void;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const Icon = ICONS[iconName] ?? FileText;
  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t || note.tags.includes(t)) { setTagDraft(""); return; }
    onChange({ tags: [...note.tags, t] });
    setTagDraft("");
  };
  const removeTag = (t: string) => onChange({ tags: note.tags.filter((x) => x !== t) });

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 px-6 border-b border-border/60 flex items-center justify-between gap-3 bg-card/20">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          <span className="text-[10px] uppercase tracking-wider font-semibold truncate" style={{ color }}>
            {note.category}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[11px] text-muted-foreground">Editado {formatRelative(note.updated_at)}</span>
          {saving && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onPin(!note.pinned)} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Fixar">
            <Pin className={`h-4 w-4 ${note.pinned ? "fill-current text-primary" : ""}`} />
          </button>
          <button onClick={() => onFav(!note.favorite)} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Favoritar">
            <Star className={`h-4 w-4 ${note.favorite ? "fill-warning text-warning" : ""}`} />
          </button>
          <button onClick={onDelete} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <input
            value={note.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Sem título"
            className="w-full bg-transparent text-3xl font-display font-bold tracking-tight text-foreground placeholder:text-muted-foreground/40 outline-none mb-4"
          />

          <div className="flex flex-wrap items-center gap-2 mb-5">
            <select
              value={note.category}
              onChange={(e) => onChange({ category: e.target.value })}
              className="text-[11px] uppercase tracking-wider font-semibold bg-secondary/60 border border-border/40 rounded-md px-2.5 py-1.5 outline-none cursor-pointer hover:bg-secondary"
              style={{ color }}
            >
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              {!categories.some((c) => c.name === note.category) && (
                <option value={note.category}>{note.category}</option>
              )}
            </select>

            <select
              value={note.company ?? ""}
              onChange={(e) => onChange({ company: (e.target.value || null) as Company | null })}
              className="text-[11px] bg-secondary/60 border border-border/40 rounded-md px-2.5 py-1.5 outline-none cursor-pointer hover:bg-secondary text-muted-foreground"
            >
              <option value="">Sem empresa</option>
              {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <div className="flex items-center gap-1 flex-wrap">
              {note.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[11px] bg-secondary/60 border border-border/40 rounded-md px-2 py-1 text-muted-foreground">
                  <TagIcon className="h-2.5 w-2.5" />#{t}
                  <button onClick={() => removeTag(t)} className="hover:text-foreground ml-0.5">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="+ tag"
                className="text-[11px] bg-transparent border border-dashed border-border/60 rounded-md px-2 py-1 outline-none w-20 placeholder:text-muted-foreground/50 focus:border-primary/40"
              />
            </div>
          </div>

          <Textarea
            value={note.content}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder="Comece a escrever sua ideia, planejamento ou insight…"
            className="w-full min-h-[60vh] bg-transparent border-0 px-0 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 resize-none focus-visible:ring-0 shadow-none"
          />
        </div>
      </div>
    </div>
  );
}

// ============= Manage Categories Dialog =============

function ManageCategoriesDialog({
  open, onClose, categories, counts, onCreate, onUpdate, onDelete, onMove,
}: {
  open: boolean;
  onClose: () => void;
  categories: NoteCategory[];
  counts: Record<string, number>;
  onCreate: (name: string, color: string, icon: IconName) => Promise<void>;
  onUpdate: (id: string, patch: Partial<NoteCategory>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, dir: -1 | 1) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_PALETTE[0]);
  const [newIcon, setNewIcon] = useState<IconName>("Sparkles");
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreate(newName, newColor, newIcon);
    setNewName("");
    setNewColor(DEFAULT_PALETTE[0]);
    setNewIcon("Sparkles");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Gerenciar categorias
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
          {/* Create */}
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-3 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Nova categoria</div>
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                placeholder="Nome da categoria"
                className="h-9"
              />
              <Button onClick={handleCreate} disabled={!newName.trim()} className="gap-1.5 h-9">
                <Plus className="h-4 w-4" /> Criar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorPicker value={newColor} onChange={setNewColor} />
              <IconPicker value={newIcon} onChange={setNewIcon} />
            </div>
          </div>

          {/* List */}
          <div className="space-y-1.5">
            {categories.map((c, i) => {
              const Icon = ICONS[c.icon] ?? Sparkles;
              const isEditing = editingId === c.id;
              const used = counts[c.name] ?? 0;
              return (
                <div key={c.id} className="rounded-lg border border-border/40 bg-card/40">
                  <div className="flex items-center gap-2 p-2.5">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => onMove(c.id, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground hover:text-foreground">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => onMove(c.id, 1)} disabled={i === categories.length - 1} className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground hover:text-foreground">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `color-mix(in oklab, ${c.color} 18%, transparent)` }}>
                      <Icon className="h-4 w-4" style={{ color: c.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{used} nota(s)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingId(isEditing ? null : c.id)}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(c.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {isEditing && (
                    <CategoryEditor
                      category={c}
                      onSave={async (patch) => { await onUpdate(c.id, patch); setEditingId(null); }}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </div>
              );
            })}
            {categories.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">Nenhuma categoria ainda.</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryEditor({
  category, onSave, onCancel,
}: {
  category: NoteCategory;
  onSave: (patch: Partial<NoteCategory>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [icon, setIcon] = useState<IconName>(category.icon);
  return (
    <div className="border-t border-border/40 p-3 space-y-3 bg-secondary/20">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" placeholder="Nome" />
      <div className="grid grid-cols-2 gap-3">
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSave({ name, color, icon })} className="gap-1.5">
          <Check className="h-3.5 w-3.5" /> Salvar
        </Button>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1.5 flex items-center gap-1">
        <Palette className="h-3 w-3" /> Cor
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`h-6 w-6 rounded-md border-2 transition-all ${value === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: IconName; onChange: (v: IconName) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1.5">Ícone</div>
      <div className="flex flex-wrap gap-1">
        {ICON_NAMES.map((n) => {
          const I = ICONS[n];
          const active = n === value;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`h-7 w-7 rounded-md flex items-center justify-center border transition-colors ${
                active ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title={n}
            >
              <I className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
