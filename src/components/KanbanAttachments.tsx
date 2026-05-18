import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";
import {
  Paperclip, Upload, Trash2, Download, FileText, Image as ImageIcon,
  FileVideo, FileAudio, FileArchive, File as FileIcon,
} from "lucide-react";

interface Attachment {
  id: string;
  card_id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size: number;
  uploader_name: string | null;
  created_at: string;
}

const BUCKET = "kanban-attachments";
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

function iconFor(mime: string | null, name: string) {
  const m = (mime || "").toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith("image/")) return ImageIcon;
  if (m.startsWith("video/")) return FileVideo;
  if (m.startsWith("audio/")) return FileAudio;
  if (m === "application/pdf" || n.endsWith(".pdf")) return FileText;
  if (/zip|rar|7z|tar|gz/.test(m) || /\.(zip|rar|7z|tar|gz)$/.test(n)) return FileArchive;
  return FileIcon;
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function KanbanAttachments({ cardId }: { cardId: string }) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<{ name: string; pct: number }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("kanban_attachments")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setItems((data ?? []) as Attachment[]);
        setLoading(false);
      }
    };
    load();
    const ch = supabase
      .channel(`kanban_att:${cardId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "kanban_attachments", filter: `card_id=eq.${cardId}` },
        load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [cardId, activeWorkspaceId]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!user || !activeWorkspaceId) return;
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} excede 50MB`);
        continue;
      }
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${activeWorkspaceId}/${cardId}/${Date.now()}-${safeName}`;
      setUploading((u) => [...u, { name: file.name, pct: 10 }]);
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) {
        toast.error(`Falha ao enviar ${file.name}: ${upErr.message}`);
        setUploading((u) => u.filter((x) => x.name !== file.name));
        continue;
      }
      setUploading((u) => u.map((x) => x.name === file.name ? { ...x, pct: 80 } : x));
      const { error: insErr } = await supabase.from("kanban_attachments").insert({
        workspace_id: activeWorkspaceId,
        card_id: cardId,
        user_id: user.id,
        uploader_name: user.email ?? null,
        name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size: file.size,
      } as never);
      if (insErr) toast.error(insErr.message);
      setUploading((u) => u.filter((x) => x.name !== file.name));
    }
  };

  const openFile = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 600);
    if (error || !data) { toast.error("Não foi possível abrir"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const downloadFile = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 600, { download: a.name });
    if (error || !data) { toast.error("Não foi possível baixar"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const removeFile = async (a: Attachment) => {
    if (!confirm(`Excluir "${a.name}"?`)) return;
    await supabase.storage.from(BUCKET).remove([a.storage_path]);
    await supabase.from("kanban_attachments").delete().eq("id", a.id);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-4 text-center transition ${
          dragOver ? "border-primary bg-primary/10" : "border-border bg-surface/30"
        }`}
      >
        <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground mb-2">
          Arraste arquivos aqui ou
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs rounded bg-primary/15 text-primary px-3 py-1 font-bold"
        >
          Selecionar arquivos
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
        />
        <p className="text-[10px] text-muted-foreground mt-1.5">Máx. 50MB por arquivo</p>
      </div>

      {uploading.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {uploading.map((u) => (
            <div key={u.name} className="text-xs">
              <div className="flex justify-between mb-0.5">
                <span className="truncate flex-1">{u.name}</span>
                <span className="text-muted-foreground ml-2">{u.pct}%</span>
              </div>
              <div className="h-1 bg-muted rounded overflow-hidden">
                <div className="h-full bg-gradient-primary transition-all" style={{ width: `${u.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground mt-3">Carregando…</p>
      ) : items.length === 0 && uploading.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-3 text-center">Nenhum anexo</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((a) => {
            const Icon = iconFor(a.mime_type, a.name);
            return (
              <li
                key={a.id}
                className="group flex items-center gap-2 rounded-lg border border-border bg-surface/40 p-2 hover:border-primary/40 transition"
              >
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <button
                  onClick={() => openFile(a)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-xs font-medium truncate">{a.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {formatSize(a.size)} · {a.uploader_name ?? "—"} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </button>
                <button
                  onClick={() => downloadFile(a)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1"
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removeFile(a)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { Paperclip };
