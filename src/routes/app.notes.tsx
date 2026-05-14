import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus, Search, Star, Trash2, FileText, Sparkles, Pin, Tag as TagIcon,
  Building2, Clock, Grid2x2, List as ListIcon, Loader2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMPANIES, type Company } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { logActivity } from "@/lib/activity-log";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notes")({ component: NotesPage });

const CATEGORIES = [
  "Ideias",
  "Planejamento",
  "Marketing",
  "Produção",
  "Estratégia",
  "Brainstorming",
  "Operacional",
] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<Category, string> = {
  "Ideias": "oklch(0.78 0.15 75)",
  "Planejamento": "oklch(0.72 0.16 220)",
  "Marketing": "oklch(0.72 0.18 25)",
  "Produção": "oklch(0.7 0.18 280)",
  "Estratégia": "oklch(0.74 0.16 195)",
  "Brainstorming": "oklch(0.74 0.16 340)",
  "Operacional": "oklch(0.7 0.14 145)",
};

interface Note {
  id: string;
  title: string;
  content: string;
  category: Category;
  company: Company | null;
  tags: string[];
  favorite: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

type View = "grid" | "list";
type Filter = "all" | "favorites" | "recent" | Category;

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
  const userId = user?.id;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ---- Load + realtime ----
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) toast.error(error.message);
      setNotes((data ?? []) as Note[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`notes:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [userId]);

  // ---- Filtering ----
  const filtered = useMemo(() => {
    let list = notes;
    if (filter === "favorites") list = list.filter((n) => n.favorite);
    else if (filter === "recent") list = list.slice(0, 12);
    else if (filter !== "all") list = list.filter((n) => n.category === filter);
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
    const map: Record<string, number> = { all: notes.length, favorites: notes.filter((n) => n.favorite).length };
    for (const c of CATEGORIES) map[c] = 0;
    for (const n of notes) map[n.category] = (map[n.category] ?? 0) + 1;
    return map;
  }, [notes]);

  // ---- CRUD ----
  const createNote = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        owner_email: user?.email ?? "unknown",
        user_name: user?.name ?? null,
        title: "Nova nota",
        content: "",
        category: filter !== "all" && filter !== "favorites" && filter !== "recent" ? filter : "Ideias",
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
        entity_type: "checklist_task" as never, // reuse generic types; not ideal but logs
        entity_id: id,
        action: "deleted",
        title: n.title,
        company: n.company,
        payload: { category: n.category, tags: n.tags, source: "notes" },
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

  // ---- Autosave editor ----
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = useCallback(async (id: string, patch: Partial<Note>) => {
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("notes").update(patch as never).eq("id", id);
      setSaving(false);
      if (error) toast.error(error.message);
    }, 500);
  }, []);

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
            icon={FileText} label="Todas" count={counts.all}
            active={filter === "all"} onClick={() => setFilter("all")}
          />
          <SidebarItem
            icon={Star} label="Favoritas" count={counts.favorites}
            active={filter === "favorites"} onClick={() => setFilter("favorites")}
          />
          <SidebarItem
            icon={Clock} label="Recentes" count={Math.min(notes.length, 12)}
            active={filter === "recent"} onClick={() => setFilter("recent")}
          />

          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 px-3 pt-5 pb-1.5">
            Categorias
          </div>
          {CATEGORIES.map((c) => (
            <SidebarItem
              key={c}
              dot={CATEGORY_COLORS[c]}
              label={c}
              count={counts[c] ?? 0}
              active={filter === c}
              onClick={() => setFilter(c)}
            />
          ))}
        </div>
      </aside>

      {/* ============ List Pane ============ */}
      <section className="w-[360px] shrink-0 border-r border-border/60 flex flex-col bg-background">
        <div className="px-4 pt-5 pb-3 space-y-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm tracking-tight capitalize">
              {filter === "all" ? "Todas as notas" : filter === "favorites" ? "Favoritas" : filter === "recent" ? "Recentes" : filter}
            </h3>
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
    </div>
  );
}

// ============= Sub-components =============

function SidebarItem({
  icon: Icon, label, count, active, onClick, dot,
}: {
  icon?: typeof FileText;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors group ${
        active ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      }`}
    >
      {Icon ? (
        <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
      ) : (
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
      )}
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
  note, active, onClick, onFav, onPin,
}: {
  note: Note; active: boolean; onClick: () => void;
  onFav: (v: boolean) => void; onPin: (v: boolean) => void;
}) {
  const cat = CATEGORY_COLORS[note.category];
  const preview = note.content.replace(/\s+/g, " ").trim().slice(0, 90);
  return (
    <button
      onClick={onClick}
      className={`group relative text-left rounded-xl border p-3 transition-all ${
        active
          ? "border-primary/50 bg-secondary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
          : "border-border/40 bg-card/40 hover:border-border hover:bg-card/70"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {note.pinned && <Pin className="h-3 w-3 text-primary fill-primary flex-shrink-0" />}
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: cat }}>
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
    </button>
  );
}

function NoteRow({ note, active, onClick }: { note: Note; active: boolean; onClick: () => void }) {
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
        <span className="text-[10px] uppercase tracking-wider" style={{ color: CATEGORY_COLORS[note.category] }}>
          {note.category}
        </span>
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
  note, saving, onChange, onDelete, onClose, onFav, onPin,
}: {
  note: Note;
  saving: boolean;
  onChange: (patch: Partial<Note>) => void;
  onDelete: () => void;
  onClose: () => void;
  onFav: (v: boolean) => void;
  onPin: (v: boolean) => void;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t || note.tags.includes(t)) { setTagDraft(""); return; }
    onChange({ tags: [...note.tags, t] });
    setTagDraft("");
  };
  const removeTag = (t: string) => onChange({ tags: note.tags.filter((x) => x !== t) });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-14 px-6 border-b border-border/60 flex items-center justify-between gap-3 bg-card/20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: CATEGORY_COLORS[note.category] }}>
            {note.category}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[11px] text-muted-foreground">
            Editado {formatRelative(note.updated_at)}
          </span>
          {saving && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPin(!note.pinned)}
            className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Fixar"
          >
            <Pin className={`h-4 w-4 ${note.pinned ? "fill-current text-primary" : ""}`} />
          </button>
          <button
            onClick={() => onFav(!note.favorite)}
            className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Favoritar"
          >
            <Star className={`h-4 w-4 ${note.favorite ? "fill-warning text-warning" : ""}`} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <input
            value={note.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Sem título"
            className="w-full bg-transparent text-3xl font-display font-bold tracking-tight text-foreground placeholder:text-muted-foreground/40 outline-none mb-4"
          />

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <select
              value={note.category}
              onChange={(e) => onChange({ category: e.target.value as Category })}
              className="text-[11px] uppercase tracking-wider font-semibold bg-secondary/60 border border-border/40 rounded-md px-2.5 py-1.5 outline-none cursor-pointer hover:bg-secondary"
              style={{ color: CATEGORY_COLORS[note.category] }}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-[11px] bg-secondary/60 border border-border/40 rounded-md px-2 py-1 text-muted-foreground"
                >
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
