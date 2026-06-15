import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Music2, Plus, Upload, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Search, Trash2, Pencil, Disc3, Mic2, MessageCircle, Download, X,
  FolderOpen, Send, ListMusic, ChevronUp, ChevronDown, Rewind, FastForward, Heart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/discography")({
  component: DiscographyPage,
});

// ============ Types ============
type Project = {
  id: string; workspace_id: string; name: string; description: string | null;
  artist: string | null; company: string | null; cover_path: string | null;
  status: string; position: number; created_at: string;
};
type Track = {
  id: string; workspace_id: string; project_id: string | null; name: string;
  artist: string | null; status: string; bpm: number | null; music_key: string | null;
  genre: string | null; responsible: string | null; notes: string | null;
  lyrics: string | null; cover_path: string | null; lyrics_storage_path: string | null;
  position: number; created_at: string;
};
type Version = {
  id: string; workspace_id: string; track_id: string; label: string;
  storage_path: string; mime_type: string | null; size_bytes: number;
  duration_ms: number | null; position: number; notes: string | null; created_at: string;
};
type Comment = {
  id: string; workspace_id: string; track_id: string; version_id: string | null;
  author_id: string | null; author_name: string | null; body: string; created_at: string;
};

const STATUS_OPTIONS = [
  { value: "ideia", label: "Ideia", color: "oklch(0.65 0.10 260)" },
  { value: "guia", label: "Guia", color: "oklch(0.72 0.16 220)" },
  { value: "demo", label: "Demo", color: "oklch(0.78 0.15 75)" },
  { value: "beat", label: "Beat", color: "oklch(0.72 0.18 145)" },
  { value: "letra", label: "Letra", color: "oklch(0.70 0.20 300)" },
  { value: "gravando", label: "Gravando", color: "oklch(0.68 0.20 25)" },
  { value: "mixagem", label: "Mixagem", color: "oklch(0.75 0.15 195)" },
  { value: "masterizacao", label: "Masterização", color: "oklch(0.72 0.15 340)" },
  { value: "aprovada", label: "Aprovada", color: "oklch(0.72 0.18 145)" },
  { value: "arquivada", label: "Arquivada", color: "oklch(0.55 0.05 260)" },
  { value: "lancada", label: "Lançada", color: "oklch(0.78 0.15 75)" },
];

const QUICK_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "guia", label: "Guias" },
  { key: "demo", label: "Demos" },
  { key: "beat", label: "Beats" },
  { key: "mixagem", label: "Mixagem" },
  { key: "masterizacao", label: "Masterização" },
  { key: "aprovada", label: "Aprovadas" },
  { key: "lancada", label: "Lançadas" },
  { key: "arquivada", label: "Arquivadas" },
];

const AUDIO_MIMES = /^audio\//;

type PlayerItem = {
  versionId: string;
  storagePath: string;
  label: string;
  trackId: string;
  trackName: string;
  artist: string | null;
  coverPath: string | null;
};

function isAudioVersion(v: { mime_type: string | null; storage_path: string }) {
  return AUDIO_MIMES.test(v.mime_type ?? "") ||
    /\.(mp3|wav|flac|aiff|aif|m4a|ogg|oga|opus|webm)$/i.test(v.storage_path);
}

function statusMeta(value: string) {
  return STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[0];
}

function humanSize(n: number) {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ============ Signed URL cache ============
const urlCache = new Map<string, { url: string; exp: number }>();
async function signedUrl(path: string): Promise<string | null> {
  const now = Date.now();
  const cached = urlCache.get(path);
  if (cached && cached.exp > now + 30_000) return cached.url;
  const { data, error } = await supabase.storage.from("files").createSignedUrl(path, 3600);
  if (error || !data) return null;
  urlCache.set(path, { url: data.signedUrl, exp: now + 3500_000 });
  return data.signedUrl;
}

// ============ Page ============
function DiscographyPage() {
  const { activeWorkspaceId, isWorkspaceAdmin, isMaster } = useWorkspace();
  const { user } = useAuth();
  const canManage = isWorkspaceAdmin || isMaster;

  const [projects, setProjects] = useState<Project[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newTrackOpen, setNewTrackOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // ===== Load =====
  const load = useCallback(async (wsId: string) => {
    const [p, t] = await Promise.all([
      supabase.from("disco_projects").select("*").eq("workspace_id", wsId).order("position"),
      supabase.from("disco_tracks").select("*").eq("workspace_id", wsId).order("position"),
    ]);
    return {
      projects: (p.data ?? []) as Project[],
      tracks: (t.data ?? []) as Track[],
    };
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) { setProjects([]); setTracks([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { projects: p, tracks: t } = await load(activeWorkspaceId);
      if (!cancelled) { setProjects(p); setTracks(t); setLoading(false); }
    })();

    const ch = supabase
      .channel(`disco:${activeWorkspaceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "disco_projects", filter: `workspace_id=eq.${activeWorkspaceId}` },
        async () => { const { projects: p } = await load(activeWorkspaceId); if (!cancelled) setProjects(p); })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "disco_tracks", filter: `workspace_id=eq.${activeWorkspaceId}` },
        async () => { const { tracks: t } = await load(activeWorkspaceId); if (!cancelled) setTracks(t); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeWorkspaceId, load]);

  // ===== Derived =====
  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tracks.filter((t) => {
      if (selectedProjectId && t.project_id !== selectedProjectId) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.artist ?? "").toLowerCase().includes(q) ||
        (t.genre ?? "").toLowerCase().includes(q) ||
        (t.responsible ?? "").toLowerCase().includes(q) ||
        (t.music_key ?? "").toLowerCase().includes(q) ||
        String(t.bpm ?? "").includes(q)
      );
    });
  }, [tracks, selectedProjectId, statusFilter, search]);

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) ?? null,
    [tracks, selectedTrackId],
  );

  // ===== Player state (lifted, persists across track-detail close) =====
  const [player, setPlayer] = useState<{
    items: PlayerItem[]; index: number;
  } | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("disco:favs") ?? "[]")); }
    catch { return new Set(); }
  });
  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("disco:favs", JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <div className="flex h-[calc(100dvh-120px)] md:h-[100dvh] flex-col bg-background">
      {/* Header / tabs */}
      <header className="shrink-0 border-b border-border px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Disc3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">PUB RECORDS</div>
            <h1 className="font-display text-lg sm:text-xl font-bold truncate">Discografia</h1>
          </div>
        </div>
        <nav className="flex rounded-lg border border-border overflow-hidden text-xs sm:text-sm">
          <Link to="/app/files" className="px-3 py-1.5 hover:bg-surface transition flex items-center gap-1.5 text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" /> Arquivos
          </Link>
          <span className="px-3 py-1.5 bg-primary text-primary-foreground flex items-center gap-1.5 font-medium">
            <Disc3 className="h-3.5 w-3.5" /> Discografia
          </span>
        </nav>
      </header>

      {/* Main 3 cols */}
      <div className="flex-1 min-h-0 flex">
        {/* Projects sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface/40">
          <div className="p-3 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Projetos</div>
            {canManage && (
              <button onClick={() => setNewProjectOpen(true)} className="text-muted-foreground hover:text-foreground" title="Novo projeto">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
            <button
              onClick={() => setSelectedProjectId(null)}
              className={`w-full text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 ${selectedProjectId === null ? "bg-primary/15 text-primary" : "hover:bg-surface text-foreground/80"}`}
            >
              <ListMusic className="h-3.5 w-3.5" /> Todas as faixas
              <span className="ml-auto text-[10px] text-muted-foreground">{tracks.length}</span>
            </button>
            {projects.map((p) => {
              const count = tracks.filter((t) => t.project_id === p.id).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  onDoubleClick={() => canManage && setEditingProject(p)}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 group ${selectedProjectId === p.id ? "bg-primary/15 text-primary" : "hover:bg-surface text-foreground/80"}`}
                >
                  <Disc3 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{count}</span>
                </button>
              );
            })}
            {projects.length === 0 && !loading && (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                Nenhum projeto. {canManage && "Crie o primeiro."}
              </div>
            )}
          </div>
        </aside>

        {/* Tracks list */}
        <section className="flex-1 min-w-0 flex flex-col border-r border-border">
          <div className="p-3 sm:p-4 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por música, artista, BPM, tom…"
                  className="pl-8 h-9"
                />
              </div>
              {/* Mobile projects select */}
              <div className="md:hidden">
                <Select value={selectedProjectId ?? "__all__"} onValueChange={(v) => setSelectedProjectId(v === "__all__" ? null : v)}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {canManage && (
                <Button onClick={() => setNewTrackOpen(true)} size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nova faixa</span>
                </Button>
              )}
            </div>
            <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition ${statusFilter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
            ) : filteredTracks.length === 0 ? (
              <div className="p-12 text-center">
                <Music2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <div className="text-sm text-muted-foreground">
                  {tracks.length === 0 ? "Nenhuma faixa ainda." : "Nada encontrado."}
                </div>
                {canManage && tracks.length === 0 && (
                  <Button variant="outline" onClick={() => setNewTrackOpen(true)} className="mt-4 gap-2">
                    <Plus className="h-4 w-4" /> Adicionar primeira faixa
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {filteredTracks.map((t) => {
                  const isSel = t.id === selectedTrackId;
                  const isPlaying = player?.items[player.index]?.trackId === t.id;
                  const st = statusMeta(t.status);
                  return (
                    <li
                      key={t.id}
                      onClick={() => setSelectedTrackId(t.id)}
                      className={`px-3 sm:px-4 py-2.5 flex items-center gap-3 cursor-pointer transition ${isSel ? "bg-primary/10" : "hover:bg-surface/60"}`}
                    >
                      <div className="h-10 w-10 shrink-0 rounded-md bg-surface flex items-center justify-center" style={{ backgroundColor: `color-mix(in oklch, ${st.color} 18%, transparent)` }}>
                        {isPlaying ? <Pause className="h-4 w-4" style={{ color: st.color }} /> : <Music2 className="h-4 w-4" style={{ color: st.color }} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{t.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
                          {t.artist && <span>{t.artist}</span>}
                          {t.bpm && <span>· {t.bpm} BPM</span>}
                          {t.music_key && <span>· {t.music_key}</span>}
                          {t.genre && <span>· {t.genre}</span>}
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider hidden sm:inline"
                        style={{ backgroundColor: `color-mix(in oklch, ${st.color} 18%, transparent)`, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Detail panel */}
        {selectedTrack && (
          <TrackDetail
            track={selectedTrack}
            project={projects.find((p) => p.id === selectedTrack.project_id) ?? null}
            canManage={canManage}
            userId={user?.id ?? null}
            userName={user?.name ?? user?.email ?? null}
            onClose={() => setSelectedTrackId(null)}
            onEdit={() => setEditingTrack(selectedTrack)}
            onPlay={(versions, idx) => {
              const items: PlayerItem[] = versions.filter(isAudioVersion).map((v) => ({
                versionId: v.id,
                storagePath: v.storage_path,
                label: v.label,
                trackId: selectedTrack.id,
                trackName: selectedTrack.name,
                artist: selectedTrack.artist,
                coverPath: selectedTrack.cover_path,
              }));
              if (items.length === 0) return;
              const clampedIdx = Math.max(0, Math.min(items.length - 1, idx));
              setPlayer({ items, index: clampedIdx });
            }}
            currentPlayer={player}
            isFav={favorites.has(selectedTrack.id)}
            onToggleFav={() => toggleFav(selectedTrack.id)}
          />
        )}
      </div>

      {/* Bottom player */}
      {player && (
        <BottomPlayer
          state={player}
          onChangeIndex={(idx) => setPlayer((p) => p ? { ...p, index: Math.max(0, Math.min(p.items.length - 1, idx)) } : p)}
          onClose={() => setPlayer(null)}
          isFav={favorites.has(player.items[player.index]?.trackId ?? "")}
          onToggleFav={() => {
            const id = player.items[player.index]?.trackId;
            if (id) toggleFav(id);
          }}
          onOpenTrack={(trackId) => setSelectedTrackId(trackId)}
        />
      )}

      {/* Dialogs */}
      {newProjectOpen && activeWorkspaceId && (
        <ProjectDialog
          workspaceId={activeWorkspaceId}
          position={projects.length}
          onClose={() => setNewProjectOpen(false)}
        />
      )}
      {editingProject && activeWorkspaceId && (
        <ProjectDialog
          workspaceId={activeWorkspaceId}
          existing={editingProject}
          position={editingProject.position}
          onClose={() => setEditingProject(null)}
        />
      )}
      {(newTrackOpen || editingTrack) && activeWorkspaceId && (
        <TrackDialog
          workspaceId={activeWorkspaceId}
          projects={projects}
          defaultProjectId={selectedProjectId}
          existing={editingTrack}
          position={tracks.length}
          userId={user?.id ?? null}
          onClose={() => { setNewTrackOpen(false); setEditingTrack(null); }}
        />
      )}
    </div>
  );
}

// ============ Track Detail Panel ============
function TrackDetail({
  track, project, canManage, userId, userName, onClose, onEdit, onPlay, currentPlayer,
  isFav, onToggleFav,
}: {
  track: Track;
  project: Project | null;
  canManage: boolean;
  userId: string | null;
  userName: string | null;
  onClose: () => void;
  onEdit: () => void;
  onPlay: (versions: Version[], index: number) => void;
  currentPlayer: { items: PlayerItem[]; index: number } | null;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [newComment, setNewComment] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const st = statusMeta(track.status);

  // Load versions + comments + realtime
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [v, c] = await Promise.all([
        supabase.from("disco_versions").select("*").eq("track_id", track.id).order("position"),
        supabase.from("disco_comments").select("*").eq("track_id", track.id).order("created_at", { ascending: false }),
      ]);
      if (!cancelled) {
        setVersions((v.data ?? []) as Version[]);
        setComments((c.data ?? []) as Comment[]);
      }
    })();
    const ch = supabase
      .channel(`disco-track:${track.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "disco_versions", filter: `track_id=eq.${track.id}` },
        async () => {
          const { data } = await supabase.from("disco_versions").select("*").eq("track_id", track.id).order("position");
          if (!cancelled) setVersions((data ?? []) as Version[]);
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "disco_comments", filter: `track_id=eq.${track.id}` },
        async () => {
          const { data } = await supabase.from("disco_comments").select("*").eq("track_id", track.id).order("created_at", { ascending: false });
          if (!cancelled) setComments((data ?? []) as Comment[]);
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [track.id]);

  const uploadVersion = async (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    setUploadingVersion(true);
    try {
      for (const file of Array.from(fl)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${track.workspace_id}/disco/${track.id}/${crypto.randomUUID()}_${safe}`;
        const up = await supabase.storage.from("files").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (up.error) { toast.error(up.error.message); continue; }
        const labelGuess = file.name.replace(/\.[^.]+$/, "").slice(0, 60);
        const { error } = await supabase.from("disco_versions").insert({
          workspace_id: track.workspace_id, track_id: track.id,
          label: labelGuess, storage_path: path,
          mime_type: file.type || null, size_bytes: file.size,
          position: versions.length, created_by: userId,
        } as never);
        if (error) toast.error(error.message);
      }
      toast.success("Versão enviada");
    } finally {
      setUploadingVersion(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeVersion = async (v: Version) => {
    if (!confirm(`Excluir a versão "${v.label}"?`)) return;
    await supabase.storage.from("files").remove([v.storage_path]);
    const { error } = await supabase.from("disco_versions").delete().eq("id", v.id);
    if (error) toast.error(error.message); else toast.success("Versão excluída");
  };

  const renameVersion = async (v: Version) => {
    const next = prompt("Nome da versão", v.label);
    if (next == null || !next.trim() || next.trim() === v.label) return;
    await supabase.from("disco_versions").update({ label: next.trim() } as never).eq("id", v.id);
  };

  const downloadVersion = async (v: Version) => {
    const url = await signedUrl(v.storage_path);
    if (!url) { toast.error("Falha ao gerar link"); return; }
    const a = document.createElement("a");
    a.href = url; a.download = `${track.name} - ${v.label}`; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const submitComment = async () => {
    const body = newComment.trim();
    if (!body) return;
    setNewComment("");
    const { error } = await supabase.from("disco_comments").insert({
      workspace_id: track.workspace_id, track_id: track.id,
      author_id: userId, author_name: userName, body,
    } as never);
    if (error) { toast.error(error.message); setNewComment(body); }
  };

  const removeComment = async (c: Comment) => {
    if (!confirm("Excluir comentário?")) return;
    await supabase.from("disco_comments").delete().eq("id", c.id);
  };

  return (
    <aside className="fixed inset-0 z-40 flex flex-col bg-background lg:static lg:z-auto lg:w-[420px] xl:w-[480px] lg:shrink-0 lg:border-l lg:border-border lg:bg-surface/30 overflow-hidden">
      <div className="p-4 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {project?.name ?? "Sem projeto"}
          </div>
          <div className="font-display text-lg font-bold truncate">{track.name}</div>
          {track.artist && <div className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mic2 className="h-3 w-3" />{track.artist}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleFav}
            className={`h-7 w-7 rounded-md hover:bg-surface flex items-center justify-center ${isFav ? "text-rose-500" : "text-muted-foreground hover:text-foreground"}`}
            title={isFav ? "Remover favorita" : "Favoritar"}
          >
            <Heart className={`h-3.5 w-3.5 ${isFav ? "fill-current" : ""}`} />
          </button>
          {canManage && (
            <button onClick={onEdit} className="h-7 w-7 rounded-md hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground" title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onClose} className="h-7 w-7 rounded-md hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground" title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border flex flex-wrap gap-1.5 text-[11px]">
        <span className="font-medium px-2 py-0.5 rounded uppercase tracking-wider" style={{ backgroundColor: `color-mix(in oklch, ${st.color} 18%, transparent)`, color: st.color }}>{st.label}</span>
        {track.bpm && <span className="px-2 py-0.5 rounded bg-surface text-muted-foreground">{track.bpm} BPM</span>}
        {track.music_key && <span className="px-2 py-0.5 rounded bg-surface text-muted-foreground">{track.music_key}</span>}
        {track.genre && <span className="px-2 py-0.5 rounded bg-surface text-muted-foreground">{track.genre}</span>}
        {track.responsible && <span className="px-2 py-0.5 rounded bg-surface text-muted-foreground">@{track.responsible}</span>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Versions */}
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Versões</div>
            <label className={`text-xs flex items-center gap-1 cursor-pointer ${uploadingVersion ? "opacity-50" : "text-primary hover:underline"}`}>
              <Upload className="h-3 w-3" /> {uploadingVersion ? "Enviando…" : "Enviar"}
              <input
                ref={fileRef}
                type="file" multiple
                accept="audio/*,.mp3,.wav,.flac,.aiff,.m4a,.zip,.pdf,.txt,.docx,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => uploadVersion(e.target.files)}
                disabled={uploadingVersion}
              />
            </label>
          </div>
          {versions.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-lg">
              Nenhuma versão ainda. Envie áudio, letra ou arquivos do projeto.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {versions.map((v, i) => {
                const isAudio = isAudioVersion(v);
                const isPlayingThis = currentPlayer?.items[currentPlayer.index]?.versionId === v.id;
                return (
                  <li key={v.id} className={`rounded-lg border ${isPlayingThis ? "border-primary/50 bg-primary/5" : "border-border bg-card"} p-2.5`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-5 text-center">v{i + 1}</span>
                      {isAudio ? (
                        <button onClick={() => onPlay(versions, versions.filter(isAudioVersion).findIndex((x) => x.id === v.id))} className="h-7 w-7 rounded-full bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center" title="Reproduzir">
                          {isPlayingThis ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                        </button>
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-surface flex items-center justify-center text-muted-foreground">
                          <FolderOpen className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{v.label}</div>
                        <div className="text-[10px] text-muted-foreground">{humanSize(v.size_bytes)} · {new Date(v.created_at).toLocaleDateString("pt-BR")}</div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => downloadVersion(v)} className="h-7 w-7 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground flex items-center justify-center" title="Baixar"><Download className="h-3.5 w-3.5" /></button>
                        {canManage && <button onClick={() => renameVersion(v)} className="h-7 w-7 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground flex items-center justify-center" title="Renomear"><Pencil className="h-3.5 w-3.5" /></button>}
                        {canManage && <button onClick={() => removeVersion(v)} className="h-7 w-7 rounded-md hover:bg-surface text-destructive flex items-center justify-center" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Notes / lyrics */}
        {(track.notes || track.lyrics) && (
          <div className="px-4 pb-4 space-y-3">
            {track.lyrics && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Letra / guia</div>
                <pre className="text-xs whitespace-pre-wrap font-sans bg-surface/60 rounded-lg p-3 max-h-48 overflow-y-auto">{track.lyrics}</pre>
              </div>
            )}
            {track.notes && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Observações</div>
                <div className="text-xs text-muted-foreground bg-surface/60 rounded-lg p-3">{track.notes}</div>
              </div>
            )}
          </div>
        )}

        {/* Comments */}
        <div className="px-4 pb-4 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MessageCircle className="h-3 w-3" /> Comentários ({comments.length})
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Anotação, pendência, feedback…"
              rows={2}
              className="text-xs"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); } }}
            />
            <Button size="sm" onClick={submitComment} disabled={!newComment.trim()} className="shrink-0"><Send className="h-3.5 w-3.5" /></Button>
          </div>
          <ul className="space-y-1.5">
            {comments.map((c) => {
              const isMine = c.author_id === userId;
              return (
                <li key={c.id} className="rounded-lg bg-surface/60 p-2.5 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground/90">{c.author_name ?? "Anônimo"}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-muted-foreground">{c.body}</div>
                  {(isMine || canManage) && (
                    <button onClick={() => removeComment(c)} className="text-[10px] text-destructive hover:underline mt-1">excluir</button>
                  )}
                </li>
              );
            })}
            {comments.length === 0 && <li className="text-xs text-muted-foreground italic">Sem comentários ainda.</li>}
          </ul>
        </div>
      </div>
    </aside>
  );
}

// ============ Bottom Player ============
function BottomPlayer({
  state, onChangeIndex, onClose, isFav, onToggleFav, onOpenTrack,
}: {
  state: { items: PlayerItem[]; index: number };
  onChangeIndex: (idx: number) => void;
  onClose: () => void;
  isFav: boolean;
  onToggleFav: () => void;
  onOpenTrack: (trackId: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [src, setSrc] = useState<string>("");
  const [expanded, setExpanded] = useState(false);

  const item = state.items[state.index];
  const hasPrev = state.index > 0;
  const hasNext = state.index < state.items.length - 1;

  // Resolve signed url when version changes
  useEffect(() => {
    let cancelled = false;
    setSrc("");
    setCurrent(0);
    setDuration(0);
    if (!item) return;
    (async () => {
      const url = await signedUrl(item.storagePath);
      if (!cancelled && url) {
        setSrc(url);
        setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
      } else if (!cancelled) {
        toast.error("Falha ao carregar áudio");
      }
    })();
    return () => { cancelled = true; };
  }, [item?.versionId, item?.storagePath]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (!src) { toast.message("Carregando áudio…"); return; }
    if (el.paused || el.ended) {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch((err) => {
        console.warn("audio play blocked", err);
        toast.error("Toque novamente para reproduzir");
      });
    } else {
      el.pause();
    }
  };

  const seek = (pct: number) => {
    const el = audioRef.current; if (!el || !duration) return;
    el.currentTime = Math.max(0, Math.min(duration, duration * pct));
  };

  const skip = (sec: number) => {
    const el = audioRef.current; if (!el) return;
    el.currentTime = Math.max(0, Math.min((el.duration || 0), el.currentTime + sec));
  };

  const goPrev = () => { if (hasPrev) onChangeIndex(state.index - 1); };
  const goNext = () => { if (hasNext) onChangeIndex(state.index + 1); };

  const downloadCurrent = async () => {
    if (!item) return;
    const url = await signedUrl(item.storagePath);
    if (!url) { toast.error("Falha ao gerar link"); return; }
    const a = document.createElement("a");
    a.href = url; a.download = `${item.trackName} - ${item.label}`; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  if (!item) return null;

  const audioEl = (
    <audio
      ref={audioRef}
      src={src}
      preload="metadata"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
      onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration || 0)}
      onEnded={() => { setPlaying(false); if (hasNext) goNext(); }}
      onError={() => toast.error("Erro ao reproduzir áudio")}
    />
  );

  const progressBar = (
    <div
      className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden cursor-pointer touch-none"
      onClick={(e) => {
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        seek((e.clientX - r.left) / r.width);
      }}
    >
      <div className="h-full bg-primary transition-[width]" style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }} />
    </div>
  );

  return (
    <>
      {/* Mini player — fixed, sits above mobile bottom nav */}
      <div className="fixed inset-x-0 z-[60] border-t border-border bg-card/95 backdrop-blur px-3 sm:px-4 py-2 sm:py-2.5 bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-0">
        {audioEl}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cover / track */}
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
            title="Expandir player"
          >
            <div className="h-10 w-10 shrink-0 rounded-md bg-primary/15 text-primary flex items-center justify-center">
              <Music2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{item.trackName} <span className="text-muted-foreground">· {item.label}</span></div>
              <div className="text-[10px] text-muted-foreground truncate">{item.artist ?? "—"}</div>
            </div>
          </button>

          {/* Controls */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button onClick={goPrev} disabled={!hasPrev} className="hidden sm:flex h-8 w-8 rounded-md hover:bg-surface items-center justify-center text-foreground/80 disabled:opacity-30" title="Anterior"><SkipBack className="h-4 w-4" /></button>
            <button onClick={() => skip(-10)} className="hidden sm:flex h-8 w-8 rounded-md hover:bg-surface items-center justify-center text-foreground/80" title="-10s"><Rewind className="h-4 w-4" /></button>
            <button onClick={togglePlay} className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:scale-105 transition flex items-center justify-center">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>
            <button onClick={() => skip(10)} className="hidden sm:flex h-8 w-8 rounded-md hover:bg-surface items-center justify-center text-foreground/80" title="+10s"><FastForward className="h-4 w-4" /></button>
            <button onClick={goNext} disabled={!hasNext} className="hidden sm:flex h-8 w-8 rounded-md hover:bg-surface items-center justify-center text-foreground/80 disabled:opacity-30" title="Próxima"><SkipForward className="h-4 w-4" /></button>
          </div>

          {/* Progress + time (desktop inline) */}
          <div className="hidden md:flex items-center gap-2 min-w-0 flex-1 max-w-md">
            <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{formatTime(current)}</span>
            {progressBar}
            <span className="text-[10px] font-mono text-muted-foreground w-10">{formatTime(duration)}</span>
          </div>

          {/* Volume desktop */}
          <div className="hidden lg:flex items-center gap-1.5">
            <button onClick={() => setMuted((m) => !m)} className="text-muted-foreground hover:text-foreground">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
            <input
              type="range" min={0} max={1} step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
              className="w-20 accent-primary"
            />
          </div>

          <button onClick={() => setExpanded(true)} className="h-8 w-8 rounded-md hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground" title="Expandir"><ChevronUp className="h-4 w-4" /></button>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground" title="Fechar player"><X className="h-4 w-4" /></button>
        </div>

        {/* Mobile progress under controls */}
        <div className="md:hidden flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{formatTime(current)}</span>
          {progressBar}
          <span className="text-[10px] font-mono text-muted-foreground w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Full player modal */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-4 border-b border-border/40">
            <button onClick={() => setExpanded(false)} className="h-9 w-9 rounded-full hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground" title="Recolher">
              <ChevronDown className="h-5 w-5" />
            </button>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Reproduzindo agora</div>
            <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground" title="Fechar"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-6 overflow-y-auto">
            <div className="relative w-56 h-56 sm:w-72 sm:h-72 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-surface shadow-2xl flex items-center justify-center">
              <Disc3 className={`h-28 w-28 text-primary/70 ${playing ? "animate-spin" : ""}`} style={{ animationDuration: "8s" }} />
            </div>
            <div className="text-center max-w-md">
              <div className="font-display text-2xl font-bold truncate">{item.trackName}</div>
              <div className="text-sm text-muted-foreground mt-1 truncate">{item.artist ?? "—"} · {item.label}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-2">
                Faixa {state.index + 1} de {state.items.length}
              </div>
            </div>

            <div className="w-full max-w-md space-y-1.5">
              {progressBar}
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>{formatTime(current)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={onToggleFav} className={`h-10 w-10 rounded-full hover:bg-surface flex items-center justify-center ${isFav ? "text-rose-500" : "text-muted-foreground"}`} title="Favoritar">
                <Heart className={`h-5 w-5 ${isFav ? "fill-current" : ""}`} />
              </button>
              <button onClick={goPrev} disabled={!hasPrev} className="h-11 w-11 rounded-full hover:bg-surface flex items-center justify-center text-foreground disabled:opacity-30" title="Anterior"><SkipBack className="h-5 w-5" /></button>
              <button onClick={() => skip(-10)} className="h-10 w-10 rounded-full hover:bg-surface flex items-center justify-center text-foreground/80" title="-10s"><Rewind className="h-5 w-5" /></button>
              <button onClick={togglePlay} className="h-14 w-14 rounded-full bg-primary text-primary-foreground hover:scale-105 transition flex items-center justify-center shadow-lg">
                {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
              </button>
              <button onClick={() => skip(10)} className="h-10 w-10 rounded-full hover:bg-surface flex items-center justify-center text-foreground/80" title="+10s"><FastForward className="h-5 w-5" /></button>
              <button onClick={goNext} disabled={!hasNext} className="h-11 w-11 rounded-full hover:bg-surface flex items-center justify-center text-foreground disabled:opacity-30" title="Próxima"><SkipForward className="h-5 w-5" /></button>
              <button onClick={downloadCurrent} className="h-10 w-10 rounded-full hover:bg-surface flex items-center justify-center text-muted-foreground" title="Baixar"><Download className="h-5 w-5" /></button>
            </div>

            <div className="w-full max-w-md flex items-center gap-2">
              <button onClick={() => setMuted((m) => !m)} className="text-muted-foreground hover:text-foreground">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
              <input
                type="range" min={0} max={1} step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                className="flex-1 accent-primary"
              />
            </div>

            <button
              onClick={() => { onOpenTrack(item.trackId); setExpanded(false); }}
              className="text-xs text-primary hover:underline"
            >
              Abrir detalhes da faixa
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ============ Project Dialog ============
function ProjectDialog({
  workspaceId, existing, position, onClose,
}: {
  workspaceId: string;
  existing?: Project;
  position: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [artist, setArtist] = useState(existing?.artist ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState(existing?.status ?? "active");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Informe um nome"); return; }
    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase.from("disco_projects").update({
          name: name.trim(), artist, description, status,
        } as never).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("disco_projects").insert({
          workspace_id: workspaceId,
          name: name.trim(), artist, description, status, position,
        } as never);
        if (error) throw error;
      }
      toast.success(existing ? "Projeto atualizado" : "Projeto criado");
      onClose();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!existing || !confirm(`Excluir o projeto "${existing.name}"? As faixas ficarão sem projeto.`)) return;
    const { error } = await supabase.from("disco_projects").delete().eq("id", existing.id);
    if (error) toast.error(error.message); else { toast.success("Projeto excluído"); onClose(); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Editar projeto" : "Novo projeto"}</DialogTitle>
          <DialogDescription>Álbuns, EPs, coletâneas de beats, demos…</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Peace Beats" /></div>
          <div><Label className="text-xs">Artista</Label><Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Ex: PUB RECORDS" /></div>
          <div><Label className="text-xs">Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {existing && <Button variant="destructive" onClick={remove} disabled={saving} className="sm:mr-auto">Excluir</Button>}
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Track Dialog ============
function TrackDialog({
  workspaceId, projects, defaultProjectId, existing, position, userId, onClose,
}: {
  workspaceId: string;
  projects: Project[];
  defaultProjectId: string | null;
  existing: Track | null;
  position: number;
  userId: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [artist, setArtist] = useState(existing?.artist ?? "");
  const [projectId, setProjectId] = useState<string | null>(existing?.project_id ?? defaultProjectId);
  const [status, setStatus] = useState(existing?.status ?? "ideia");
  const [bpm, setBpm] = useState<string>(existing?.bpm?.toString() ?? "");
  const [musicKey, setMusicKey] = useState(existing?.music_key ?? "");
  const [genre, setGenre] = useState(existing?.genre ?? "");
  const [responsible, setResponsible] = useState(existing?.responsible ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [lyrics, setLyrics] = useState(existing?.lyrics ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Informe um nome"); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), artist: artist || null,
        project_id: projectId, status,
        bpm: bpm ? Math.max(1, Math.min(400, Math.round(Number(bpm)))) : null,
        music_key: musicKey || null, genre: genre || null,
        responsible: responsible || null, notes: notes || null,
        lyrics: lyrics || null,
      };
      if (existing) {
        const { error } = await supabase.from("disco_tracks").update(payload as never).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("disco_tracks").insert({
          workspace_id: workspaceId, position, created_by: userId, ...payload,
        } as never);
        if (error) throw error;
      }
      toast.success(existing ? "Faixa atualizada" : "Faixa criada");
      onClose();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!existing || !confirm(`Excluir "${existing.name}" e todas as suas versões?`)) return;
    // Best-effort: remove storage files for versions
    const { data: vs } = await supabase.from("disco_versions").select("storage_path").eq("track_id", existing.id);
    const paths = ((vs ?? []) as { storage_path: string }[]).map((v) => v.storage_path);
    if (paths.length) await supabase.storage.from("files").remove(paths);
    const { error } = await supabase.from("disco_tracks").delete().eq("id", existing.id);
    if (error) toast.error(error.message); else { toast.success("Faixa excluída"); onClose(); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Editar faixa" : "Nova faixa"}</DialogTitle>
          <DialogDescription>Música, demo, beat, sample, guia…</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="sm:col-span-2"><Label className="text-xs">Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Artista</Label><Input value={artist} onChange={(e) => setArtist(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Projeto</Label>
            <Select value={projectId ?? "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sem projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem projeto</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Responsável</Label><Input value={responsible} onChange={(e) => setResponsible(e.target.value)} /></div>
          <div><Label className="text-xs">BPM</Label><Input value={bpm} onChange={(e) => setBpm(e.target.value)} inputMode="numeric" placeholder="Ex: 120" /></div>
          <div><Label className="text-xs">Tom</Label><Input value={musicKey} onChange={(e) => setMusicKey(e.target.value)} placeholder="Ex: Am" /></div>
          <div><Label className="text-xs">Gênero</Label><Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Ex: Trap" /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Letra / guia</Label><Textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={4} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {existing && <Button variant="destructive" onClick={remove} disabled={saving} className="sm:mr-auto"><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir</Button>}
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
