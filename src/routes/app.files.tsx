import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Folder, FolderOpen, FolderPlus, Upload, Search, Star, StarOff, Download,
  Trash2, Pencil, Move, ChevronRight, Home, LayoutGrid, List as ListIcon,
  MousePointer2, Wand2, Link as LinkIcon, FileText, FileImage, FileVideo,
  FileArchive, FileSpreadsheet, File as FileIcon, MoreVertical, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { useChecklistCompanies } from "@/lib/checklist-companies";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/files")({
  component: FilesPage,
});

type Folder = {
  id: string; workspace_id: string; parent_id: string | null;
  name: string; description: string | null; color: string | null; icon: string | null;
  company: string | null; favorite: boolean; pos_x: number; pos_y: number;
  created_at: string; updated_at: string;
};
type Item = {
  id: string; workspace_id: string; folder_id: string | null;
  name: string; storage_path: string; mime_type: string | null; size_bytes: number;
  company: string | null; category: string | null; favorite: boolean;
  pos_x: number; pos_y: number; created_at: string; updated_at: string;
};
type ViewMode = "free" | "list" | "grid";
const VIEW_KEY = "pubcore:files:view";

const FOLDER_COLORS = ["#ef4444","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#64748b"];

function fileIconFor(mime: string | null | undefined, name?: string) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "";
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/") || ["jpg","jpeg","png","webp","gif","svg"].includes(ext)) return FileImage;
  if (m.startsWith("video/") || ["mp4","mov","webm"].includes(ext)) return FileVideo;
  if (["zip","rar","7z","tar","gz"].includes(ext) || m.includes("zip")) return FileArchive;
  if (["xls","xlsx","csv"].includes(ext) || m.includes("sheet")) return FileSpreadsheet;
  if (["pdf","doc","docx","ppt","pptx","txt","md"].includes(ext) || m.includes("pdf") || m.includes("document")) return FileText;
  return FileIcon;
}

function humanSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Free-mode slot grid (prevents overlap and keeps items aligned).
const SLOT_COL = 140, SLOT_ROW = 140, SLOT_X0 = 16, SLOT_Y0 = 16, SLOT_COLS = 7;
function toCell(x: number, y: number) {
  return {
    cx: Math.max(0, Math.round((x - SLOT_X0) / SLOT_COL)),
    cy: Math.max(0, Math.round((y - SLOT_Y0) / SLOT_ROW)),
  };
}
function fromCell(cx: number, cy: number) {
  return { x: SLOT_X0 + cx * SLOT_COL, y: SLOT_Y0 + cy * SLOT_ROW };
}
function buildOccupied(
  folders: { id: string; pos_x: number; pos_y: number }[],
  items: { id: string; pos_x: number; pos_y: number }[],
  excludeId?: string,
) {
  const occ = new Map<string, string>();
  const add = (id: string, x: number, y: number) => {
    if (id === excludeId) return;
    const { cx, cy } = toCell(x, y);
    occ.set(`${cx},${cy}`, id);
  };
  for (const f of folders) add(f.id, f.pos_x, f.pos_y);
  for (const it of items) add(it.id, it.pos_x, it.pos_y);
  return occ;
}
function nextFreeSlot(
  folders: { id: string; pos_x: number; pos_y: number }[],
  items: { id: string; pos_x: number; pos_y: number }[],
  excludeId?: string,
) {
  const occ = buildOccupied(folders, items, excludeId);
  for (let i = 0; i < 4000; i++) {
    const cx = i % SLOT_COLS, cy = Math.floor(i / SLOT_COLS);
    if (!occ.has(`${cx},${cy}`)) return fromCell(cx, cy);
  }
  return fromCell(0, 0);
}
function nearestFreeSlot(
  x: number, y: number,
  folders: { id: string; pos_x: number; pos_y: number }[],
  items: { id: string; pos_x: number; pos_y: number }[],
  excludeId?: string,
) {
  const occ = buildOccupied(folders, items, excludeId);
  const { cx, cy } = toCell(x, y);
  if (!occ.has(`${cx},${cy}`)) return fromCell(cx, cy);
  for (let r = 1; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const ncx = cx + dx, ncy = cy + dy;
        if (ncx < 0 || ncy < 0) continue;
        if (!occ.has(`${ncx},${ncy}`)) return fromCell(ncx, ncy);
      }
    }
  }
  return fromCell(cx, cy);
}

function FilesPage() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const { companies } = useChecklistCompanies();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "free";
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "list" || v === "grid" || v === "free" ? (v as ViewMode) : "free";
  });
  const [search, setSearch] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renameTarget, setRenameTarget] = useState<{ kind: "folder" | "item"; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderCompany, setNewFolderCompany] = useState<string>("");
  const [newFolderColor, setNewFolderColor] = useState<string>(FOLDER_COLORS[3]);
  const [moveTarget, setMoveTarget] = useState<{ kind: "folder" | "item"; id: string; name: string } | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Folder | Item | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kind: "folder" | "item"; id: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: string; kind: "folder" | "item"; offX: number; offY: number; moved: boolean } | null>(null);

  useEffect(() => {
    window.localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // Load
  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const [f, i] = await Promise.all([
      supabase.from("files_folders").select("*").eq("workspace_id", activeWorkspaceId),
      supabase.from("files_items").select("*").eq("workspace_id", activeWorkspaceId),
    ]);
    if (!f.error) setFolders(f.data as any);
    if (!i.error) setItems(i.data as any);
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const ch = supabase
      .channel(`files-${activeWorkspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "files_folders", filter: `workspace_id=eq.${activeWorkspaceId}` }, (p: any) => {
        setFolders((cur) => {
          if (p.eventType === "DELETE") return cur.filter((x) => x.id !== p.old.id);
          if (p.eventType === "INSERT") return cur.some((x) => x.id === p.new.id) ? cur : [...cur, p.new];
          return cur.map((x) => (x.id === p.new.id ? p.new : x));
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "files_items", filter: `workspace_id=eq.${activeWorkspaceId}` }, (p: any) => {
        setItems((cur) => {
          if (p.eventType === "DELETE") return cur.filter((x) => x.id !== p.old.id);
          if (p.eventType === "INSERT") return cur.some((x) => x.id === p.new.id) ? cur : [...cur, p.new];
          return cur.map((x) => (x.id === p.new.id ? p.new : x));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeWorkspaceId]);

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const out: Folder[] = [];
    let cur = folders.find((f) => f.id === currentFolderId) || null;
    while (cur) { out.unshift(cur); cur = folders.find((f) => f.id === cur!.parent_id) || null; }
    return out;
  }, [currentFolderId, folders]);

  // Visible items in this folder + filters
  const visibleFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return folders
      .filter((f) => (q ? true : f.parent_id === currentFolderId))
      .filter((f) => (showFavorites ? f.favorite : true))
      .filter((f) => (companyFilter ? f.company === companyFilter : true))
      .filter((f) => (q ? f.name.toLowerCase().includes(q) || (f.company || "").toLowerCase().includes(q) : true));
  }, [folders, currentFolderId, search, showFavorites, companyFilter]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((it) => (q ? true : it.folder_id === currentFolderId))
      .filter((it) => (showFavorites ? it.favorite : true))
      .filter((it) => (companyFilter ? it.company === companyFilter : true))
      .filter((it) => (q ? it.name.toLowerCase().includes(q) || (it.company || "").toLowerCase().includes(q) || (it.category || "").toLowerCase().includes(q) : true));
  }, [items, currentFolderId, search, showFavorites, companyFilter]);

  // Actions
  const createFolder = async () => {
    if (!activeWorkspaceId || !newFolderName.trim()) return;
    const siblingFolders = folders.filter((f) => f.parent_id === currentFolderId);
    const siblingItems = items.filter((it) => it.folder_id === currentFolderId);
    const slot = nextFreeSlot(siblingFolders, siblingItems);
    const { error } = await supabase.from("files_folders").insert({
      workspace_id: activeWorkspaceId, name: newFolderName.trim(),
      parent_id: currentFolderId, color: newFolderColor,
      company: newFolderCompany || null, created_by: user?.id,
      pos_x: slot.x, pos_y: slot.y,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Pasta criada");
    setNewFolderOpen(false); setNewFolderName(""); setNewFolderCompany(""); setNewFolderColor(FOLDER_COLORS[3]);
  };

  const uploadFiles = async (fl: FileList | null) => {
    if (!fl || !activeWorkspaceId) return;
    setUploading(true);
    try {
      const siblingFolders = folders.filter((f) => f.parent_id === currentFolderId);
      const siblingItems = items.filter((it) => it.folder_id === currentFolderId);
      const pending: { id: string; pos_x: number; pos_y: number }[] = [];
      for (const file of Array.from(fl)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${activeWorkspaceId}/${crypto.randomUUID()}_${safe}`;
        const up = await supabase.storage.from("files").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (up.error) { toast.error(up.error.message); continue; }
        const slot = nextFreeSlot(siblingFolders, [...siblingItems, ...pending]);
        pending.push({ id: path, pos_x: slot.x, pos_y: slot.y });
        const { error } = await supabase.from("files_items").insert({
          workspace_id: activeWorkspaceId, folder_id: currentFolderId,
          name: file.name, storage_path: path, mime_type: file.type || null,
          size_bytes: file.size, created_by: user?.id,
          pos_x: slot.x, pos_y: slot.y,
        } as any);
        if (error) toast.error(error.message);
      }
      toast.success("Upload concluído");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFolder = async (id: string) => {
    if (!confirm("Excluir esta pasta e todo seu conteúdo?")) return;
    // Cascade-delete files in storage under this folder (best effort)
    const all = collectDescendants(id, folders, items);
    const paths = all.items.map((x) => x.storage_path);
    if (paths.length) await supabase.storage.from("files").remove(paths);
    const { error } = await supabase.from("files_folders").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Pasta excluída");
  };
  const removeItem = async (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    if (!confirm("Excluir este arquivo?")) return;
    await supabase.storage.from("files").remove([it.storage_path]);
    const { error } = await supabase.from("files_items").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Arquivo excluído");
  };

  const toggleFavorite = async (kind: "folder" | "item", id: string, current: boolean) => {
    const tbl = kind === "folder" ? "files_folders" : "files_items";
    await supabase.from(tbl).update({ favorite: !current } as any).eq("id", id);
  };

  const renameSubmit = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const tbl = renameTarget.kind === "folder" ? "files_folders" : "files_items";
    await supabase.from(tbl).update({ name: renameValue.trim() } as any).eq("id", renameTarget.id);
    setRenameTarget(null); setRenameValue("");
  };

  const moveItemTo = async (folderId: string | null) => {
    if (!moveTarget) return;
    const tbl = moveTarget.kind === "folder" ? "files_folders" : "files_items";
    const patch: any = moveTarget.kind === "folder" ? { parent_id: folderId } : { folder_id: folderId };
    if (moveTarget.kind === "folder" && folderId === moveTarget.id) { toast.error("Pasta não pode estar dentro de si mesma"); return; }
    await supabase.from(tbl).update(patch).eq("id", moveTarget.id);
    setMoveTarget(null);
    toast.success("Movido");
  };

  const downloadItem = async (it: Item) => {
    const { data, error } = await supabase.storage.from("files").createSignedUrl(it.storage_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const copyInternalLink = (kind: "folder" | "item", id: string) => {
    const url = `${window.location.origin}/app/files?${kind === "folder" ? "folder" : "item"}=${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const organizeAuto = async () => {
    const COL = 140, ROW = 140, CW = 7;
    let i = 0;
    const updates: any[] = [];
    for (const f of visibleFolders) {
      const x = 16 + (i % CW) * COL, y = 16 + Math.floor(i / CW) * ROW;
      updates.push(supabase.from("files_folders").update({ pos_x: x, pos_y: y } as any).eq("id", f.id).then(() => {}));
      i++;
    }
    for (const it of visibleItems) {
      const x = 16 + (i % CW) * COL, y = 16 + Math.floor(i / CW) * ROW;
      updates.push(supabase.from("files_items").update({ pos_x: x, pos_y: y } as any).eq("id", it.id).then(() => {}));
      i++;
    }
    await Promise.all(updates);
    toast.success("Itens organizados");
  };


  // Free mode dragging
  const startDrag = (e: React.PointerEvent, kind: "folder" | "item", id: string, curX: number, curY: number) => {
    if (view !== "free") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { id, kind, offX: e.clientX - rect.left - curX, offY: e.clientY - rect.top - curY, moved: false };
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.round(e.clientX - rect.left - d.offX));
    const y = Math.max(0, Math.round(e.clientY - rect.top - d.offY));
    d.moved = true;
    if (d.kind === "folder") {
      setFolders((cur) => cur.map((f) => (f.id === d.id ? { ...f, pos_x: x, pos_y: y } : f)));
    } else {
      setItems((cur) => cur.map((it) => (it.id === d.id ? { ...it, pos_x: x, pos_y: y } : it)));
    }
  };
  const endDrag = async (e: React.PointerEvent) => {
    const d = dragState.current;
    dragState.current = null;
    if (!d || !d.moved) return;
    // Check drop on a folder
    const drop = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const folderEl = drop?.closest("[data-folder-drop]") as HTMLElement | null;
    const targetFolderId = folderEl?.getAttribute("data-folder-drop");
    if (targetFolderId && targetFolderId !== d.id) {
      if (d.kind === "folder") {
        if (targetFolderId === d.id) return;
        await supabase.from("files_folders").update({ parent_id: targetFolderId } as any).eq("id", d.id);
        toast.success("Pasta movida");
      } else {
        await supabase.from("files_items").update({ folder_id: targetFolderId } as any).eq("id", d.id);
        toast.success("Arquivo movido");
      }
      return;
    }
    // Persist position (free drag, no snap)
    const cur = d.kind === "folder" ? folders.find((f) => f.id === d.id) : items.find((i) => i.id === d.id);
    if (!cur) return;
    const tbl = d.kind === "folder" ? "files_folders" : "files_items";
    await supabase.from(tbl).update({ pos_x: cur.pos_x, pos_y: cur.pos_y } as any).eq("id", d.id);
  };

  const openContext = (e: React.MouseEvent, kind: "folder" | "item", id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, kind, id });
  };
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-screen w-full min-w-0">
      {/* Header */}
      <div className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 grid place-items-center">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl sm:text-2xl text-foreground truncate">Central de Arquivos</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Biblioteca digital da PUB CORE</p>
          </div>
          <nav className="flex rounded-lg border border-border overflow-hidden text-xs shrink-0">
            <span className="px-3 py-1.5 bg-primary text-primary-foreground font-medium">Arquivos</span>
            <a href="/app/discography" className="px-3 py-1.5 hover:bg-surface text-muted-foreground transition">Discografia</a>
          </nav>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs mb-3 overflow-x-auto">
          <button onClick={() => setCurrentFolderId(null)} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface text-muted-foreground hover:text-foreground transition">
            <Home className="h-3 w-3" /> Raiz
          </button>
          {breadcrumb.map((b) => (
            <div key={b.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button onClick={() => setCurrentFolderId(b.id)} className="px-2 py-1 rounded hover:bg-surface text-foreground transition truncate max-w-[160px]">
                {b.name}
              </button>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar arquivos, pastas, empresas…" className="pl-8 h-9 text-sm" />
          </div>

          <Select value={companyFilter || "__all"} onValueChange={(v) => setCompanyFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas empresas</SelectItem>
              {companies.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button variant={showFavorites ? "default" : "outline"} size="sm" onClick={() => setShowFavorites((v) => !v)} className="h-9 gap-1.5">
            <Star className="h-3.5 w-3.5" /> Favoritos
          </Button>

          <div className="flex rounded-lg border border-border bg-surface/40 p-0.5">
            <ViewBtn active={view === "free"} onClick={() => setView("free")} icon={MousePointer2} label="Livre" />
            <ViewBtn active={view === "list"} onClick={() => setView("list")} icon={ListIcon} label="Lista" />
            <ViewBtn active={view === "grid"} onClick={() => setView("grid")} icon={LayoutGrid} label="Grade" />
          </div>

          {view === "free" && (
            <Button variant="outline" size="sm" onClick={organizeAuto} className="h-9 gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> Organizar
            </Button>
          )}

          <div className="flex-1" />

          <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)} className="h-9 gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="h-9 gap-1.5">
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando…" : "Upload"}
          </Button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
        ) : view === "free" ? (
          <div
            ref={canvasRef}
            className="relative w-full min-h-full p-2"
            style={{ minHeight: 800 }}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
          >
            {visibleFolders.length === 0 && visibleItems.length === 0 && (
              <EmptyState onUpload={() => fileInputRef.current?.click()} onNewFolder={() => setNewFolderOpen(true)} />
            )}
            {visibleFolders.map((f) => (
              <FolderCard
                key={f.id} f={f} mode="free"
                onPointerDown={(e) => startDrag(e, "folder", f.id, f.pos_x, f.pos_y)}
                onDoubleClick={() => setCurrentFolderId(f.id)}
                onContextMenu={(e) => openContext(e, "folder", f.id)}
              />
            ))}
            {visibleItems.map((it) => (
              <ItemCard
                key={it.id} it={it} mode="free"
                onPointerDown={(e) => startDrag(e, "item", it.id, it.pos_x, it.pos_y)}
                onDoubleClick={() => downloadItem(it)}
                onContextMenu={(e) => openContext(e, "item", it.id)}
              />
            ))}
          </div>
        ) : view === "grid" ? (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {visibleFolders.map((f) => (
              <FolderCard
                key={f.id} f={f} mode="grid"
                onDoubleClick={() => setCurrentFolderId(f.id)}
                onClick={() => setCurrentFolderId(f.id)}
                onContextMenu={(e) => openContext(e, "folder", f.id)}
              />
            ))}
            {visibleItems.map((it) => (
              <ItemCard
                key={it.id} it={it} mode="grid"
                onDoubleClick={() => downloadItem(it)}
                onContextMenu={(e) => openContext(e, "item", it.id)}
              />
            ))}
            {visibleFolders.length === 0 && visibleItems.length === 0 && (
              <div className="col-span-full"><EmptyState onUpload={() => fileInputRef.current?.click()} onNewFolder={() => setNewFolderOpen(true)} /></div>
            )}
          </div>
        ) : (
          <div className="p-2 sm:p-4">
            <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_90px_110px_140px_40px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                <div>Nome</div><div>Tamanho</div><div>Tipo</div><div>Empresa / Data</div><div></div>
              </div>

              {visibleFolders.map((f) => (
                <ListRow key={f.id} kind="folder"
                  name={f.name} icon={<Folder className="h-4 w-4" style={{ color: f.color || "var(--color-primary)" }} />}
                  size="—" type="Pasta" company={f.company} date={f.updated_at} favorite={f.favorite}
                  onOpen={() => setCurrentFolderId(f.id)} onContext={(e) => openContext(e, "folder", f.id)}
                />
              ))}
              {visibleItems.map((it) => {
                const Ico = fileIconFor(it.mime_type, it.name);
                return (
                  <ListRow key={it.id} kind="item"
                    name={it.name} icon={<Ico className="h-4 w-4 text-muted-foreground" />}
                    size={humanSize(it.size_bytes)} type={(it.mime_type || it.name.split(".").pop() || "").toUpperCase().slice(0, 12)}
                    company={it.company} date={it.updated_at} favorite={it.favorite}
                    onOpen={() => downloadItem(it)} onContext={(e) => openContext(e, "item", it.id)}
                  />
                );
              })}
              {visibleFolders.length === 0 && visibleItems.length === 0 && (
                <div className="p-8 text-sm text-muted-foreground text-center">Vazio</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          kind={contextMenu.kind} id={contextMenu.id}
          folder={contextMenu.kind === "folder" ? folders.find((f) => f.id === contextMenu.id) : undefined}
          item={contextMenu.kind === "item" ? items.find((i) => i.id === contextMenu.id) : undefined}
          onOpen={() => {
            if (contextMenu.kind === "folder") setCurrentFolderId(contextMenu.id);
            else { const it = items.find((i) => i.id === contextMenu.id); if (it) downloadItem(it); }
            setContextMenu(null);
          }}
          onRename={() => {
            const name = contextMenu.kind === "folder"
              ? folders.find((f) => f.id === contextMenu.id)?.name
              : items.find((i) => i.id === contextMenu.id)?.name;
            setRenameTarget({ kind: contextMenu.kind, id: contextMenu.id, name: name || "" });
            setRenameValue(name || "");
            setContextMenu(null);
          }}
          onMove={() => {
            const name = contextMenu.kind === "folder"
              ? folders.find((f) => f.id === contextMenu.id)?.name
              : items.find((i) => i.id === contextMenu.id)?.name;
            setMoveTarget({ kind: contextMenu.kind, id: contextMenu.id, name: name || "" });
            setContextMenu(null);
          }}
          onDelete={() => {
            if (contextMenu.kind === "folder") removeFolder(contextMenu.id);
            else removeItem(contextMenu.id);
            setContextMenu(null);
          }}
          onFavorite={() => {
            const o = contextMenu.kind === "folder"
              ? folders.find((f) => f.id === contextMenu.id)
              : items.find((i) => i.id === contextMenu.id);
            if (o) toggleFavorite(contextMenu.kind, contextMenu.id, o.favorite);
            setContextMenu(null);
          }}
          onCopyLink={() => { copyInternalLink(contextMenu.kind, contextMenu.id); setContextMenu(null); }}
          onDetails={() => {
            const o = contextMenu.kind === "folder"
              ? folders.find((f) => f.id === contextMenu.id)
              : items.find((i) => i.id === contextMenu.id);
            if (o) setDetailsTarget(o as any);
            setContextMenu(null);
          }}
          onDownload={contextMenu.kind === "item" ? () => {
            const it = items.find((i) => i.id === contextMenu.id);
            if (it) downloadItem(it);
            setContextMenu(null);
          } : undefined}
        />
      )}

      {/* New folder */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova pasta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nome da pasta" autoFocus />
            <Select value={newFolderCompany || "__none"} onValueChange={(v) => setNewFolderCompany(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Empresa (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sem empresa</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              {FOLDER_COLORS.map((c) => (
                <button key={c} onClick={() => setNewFolderColor(c)}
                  className={`h-7 w-7 rounded-lg border-2 transition ${newFolderColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancelar</Button>
            <Button onClick={createFolder}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus
            onKeyDown={(e) => e.key === "Enter" && renameSubmit()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancelar</Button>
            <Button onClick={renameSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover "{moveTarget?.name}"</DialogTitle></DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            <button onClick={() => moveItemTo(null)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface flex items-center gap-2">
              <Home className="h-4 w-4" /> Raiz
            </button>
            {folders
              .filter((f) => !(moveTarget?.kind === "folder" && f.id === moveTarget.id))
              .map((f) => (
                <button key={f.id} onClick={() => moveItemTo(f.id)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface flex items-center gap-2">
                  <Folder className="h-4 w-4" style={{ color: f.color || "var(--color-primary)" }} />
                  <span className="truncate">{folderPath(f, folders)}</span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Details */}
      <Dialog open={!!detailsTarget} onOpenChange={(o) => !o && setDetailsTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes</DialogTitle></DialogHeader>
          {detailsTarget && (
            <div className="space-y-2 text-sm">
              <Detail label="Nome" value={(detailsTarget as any).name} />
              {(detailsTarget as any).storage_path && (
                <>
                  <Detail label="Tipo" value={(detailsTarget as Item).mime_type || "—"} />
                  <Detail label="Tamanho" value={humanSize((detailsTarget as Item).size_bytes)} />
                </>
              )}
              <Detail label="Empresa" value={(detailsTarget as any).company || "—"} />
              <Detail label="Criado em" value={new Date(detailsTarget.created_at).toLocaleString("pt-BR")} />
              <Detail label="Atualizado" value={new Date(detailsTarget.updated_at).toLocaleString("pt-BR")} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function folderPath(f: Folder, all: Folder[]): string {
  const chain: string[] = [f.name];
  let cur = all.find((x) => x.id === f.parent_id);
  while (cur) { chain.unshift(cur.name); cur = all.find((x) => x.id === cur!.parent_id); }
  return chain.join(" / ");
}

function collectDescendants(rootId: string, folders: Folder[], items: Item[]) {
  const folderIds = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of folders) {
      if (f.parent_id && folderIds.has(f.parent_id) && !folderIds.has(f.id)) {
        folderIds.add(f.id); added = true;
      }
    }
  }
  const its = items.filter((i) => i.folder_id && folderIds.has(i.folder_id));
  return { folders: folders.filter((f) => folderIds.has(f.id)), items: its };
}

function ViewBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Folder; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium transition ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FolderCard({ f, mode, ...rest }: {
  f: Folder; mode: "free" | "grid";
  onPointerDown?: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const style: React.CSSProperties = mode === "free"
    ? { position: "absolute", left: f.pos_x, top: f.pos_y, width: 120, touchAction: "none", userSelect: "none" }
    : {};
  return (
    <div
      {...rest}
      data-folder-drop={f.id}
      style={style}
      className={`group ${mode === "free" ? "" : "w-full"} flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-surface/60 transition cursor-pointer`}
    >
      <div className="relative">
        <Folder className="h-14 w-14 drop-shadow-md" style={{ color: f.color || "var(--color-primary)" }} fill="currentColor" fillOpacity={0.25} strokeWidth={1.5} />
        {f.favorite && <Star className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-400" fill="currentColor" />}
      </div>
      <div className="text-xs text-center text-foreground line-clamp-2 max-w-full px-1">{f.name}</div>
      {f.company && <div className="text-[10px] text-muted-foreground truncate max-w-full">{f.company}</div>}
    </div>
  );
}

function ItemCard({ it, mode, ...rest }: {
  it: Item; mode: "free" | "grid";
  onPointerDown?: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const Ico = fileIconFor(it.mime_type, it.name);
  const style: React.CSSProperties = mode === "free"
    ? { position: "absolute", left: it.pos_x, top: it.pos_y, width: 120, touchAction: "none", userSelect: "none" }
    : {};
  return (
    <div {...rest} style={style}
      className={`group ${mode === "free" ? "" : "w-full"} flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-surface/60 transition cursor-pointer`}
    >
      <div className="relative h-14 w-14 rounded-lg bg-surface border border-border grid place-items-center">
        <Ico className="h-7 w-7 text-muted-foreground" />
        {it.favorite && <Star className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-400" fill="currentColor" />}
      </div>
      <div className="text-xs text-center text-foreground line-clamp-2 max-w-full px-1">{it.name}</div>
      <div className="text-[10px] text-muted-foreground">{humanSize(it.size_bytes)}</div>
    </div>
  );
}

function ListRow({ kind, name, icon, size, type, company, date, favorite, onOpen, onContext }: {
  kind: "folder" | "item"; name: string; icon: React.ReactNode;
  size: string; type: string; company: string | null; date: string;
  favorite: boolean; onOpen: () => void; onContext: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onDoubleClick={onOpen}
      onClick={onOpen}
      onContextMenu={onContext}
      className="grid grid-cols-[1fr_40px] sm:grid-cols-[1fr_90px_110px_140px_40px] gap-2 px-3 py-2 border-b border-border/30 last:border-0 hover:bg-surface/40 cursor-pointer text-sm items-center"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-foreground">{name}</span>
            {favorite && <Star className="h-3 w-3 text-amber-400 flex-shrink-0" fill="currentColor" />}
          </div>
          <div className="sm:hidden text-[10px] text-muted-foreground truncate">
            {type} · {size} · {company || new Date(date).toLocaleDateString("pt-BR")}
          </div>
        </div>
      </div>
      <div className="hidden sm:block text-xs text-muted-foreground">{size}</div>
      <div className="hidden sm:block text-xs text-muted-foreground truncate">{type}</div>
      <div className="hidden sm:block text-xs text-muted-foreground truncate">
        <div className="truncate">{company || "—"}</div>
        <div className="text-[10px]">{new Date(date).toLocaleDateString("pt-BR")}</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onContext(e); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface text-muted-foreground">
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
    </div>

  );
}

function ContextMenu({
  x, y, kind, folder, item,
  onOpen, onRename, onMove, onDelete, onFavorite, onCopyLink, onDetails, onDownload,
}: {
  x: number; y: number; kind: "folder" | "item"; id: string;
  folder?: Folder; item?: Item;
  onOpen: () => void; onRename: () => void; onMove: () => void; onDelete: () => void;
  onFavorite: () => void; onCopyLink: () => void; onDetails: () => void; onDownload?: () => void;
}) {
  const isFav = (folder?.favorite ?? item?.favorite) || false;
  const style: React.CSSProperties = {
    position: "fixed", left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 320),
    zIndex: 9999,
  };
  return (
    <div style={style} onClick={(e) => e.stopPropagation()}
      className="w-56 rounded-xl border border-border bg-popover backdrop-blur shadow-elegant py-1.5">
      <MenuBtn icon={kind === "folder" ? FolderOpen : Download} label={kind === "folder" ? "Abrir" : "Abrir / Baixar"} onClick={onOpen} />
      {onDownload && <MenuBtn icon={Download} label="Baixar" onClick={onDownload} />}
      <MenuBtn icon={Pencil} label="Renomear" onClick={onRename} />
      <MenuBtn icon={Move} label="Mover" onClick={onMove} />
      <MenuBtn icon={isFav ? StarOff : Star} label={isFav ? "Desfavoritar" : "Favoritar"} onClick={onFavorite} />
      <MenuBtn icon={LinkIcon} label="Copiar link interno" onClick={onCopyLink} />
      <MenuBtn icon={FileText} label="Ver detalhes" onClick={onDetails} />
      <div className="my-1 border-t border-border/40" />
      <MenuBtn icon={Trash2} label="Excluir" onClick={onDelete} danger />
    </div>
  );
}
function MenuBtn({ icon: Icon, label, onClick, danger }: { icon: typeof Folder; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-surface transition ${danger ? "text-destructive" : "text-foreground"}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className="text-foreground text-right truncate">{value}</span>
    </div>
  );
}

function EmptyState({ onUpload, onNewFolder }: { onUpload: () => void; onNewFolder: () => void }) {
  return (
    <div className="grid place-items-center h-full min-h-[300px] p-8">
      <div className="text-center max-w-sm">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center mx-auto mb-4">
          <FolderOpen className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-display text-lg text-foreground mb-1">Pasta vazia</h3>
        <p className="text-sm text-muted-foreground mb-4">Faça upload de arquivos ou crie sua primeira pasta para começar a organizar.</p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={onNewFolder}><FolderPlus className="h-3.5 w-3.5 mr-1.5" /> Nova pasta</Button>
          <Button size="sm" onClick={onUpload}><Upload className="h-3.5 w-3.5 mr-1.5" /> Upload</Button>
        </div>
      </div>
    </div>
  );
}
