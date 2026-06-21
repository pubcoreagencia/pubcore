import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Share2, Inbox, Send, ShieldCheck, Eye, MessageSquare, Pencil, Copy as CopyIcon,
  Building2, Loader2, X, RotateCcw, CheckCircle2, Clock, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import {
  SHARE_PERMISSION_LABEL, SHARE_TYPE_LABEL,
  postComment, revokeShare, reactivateShare, updateSharePermission,
  type SharedItem, type SharePermission,
} from "@/lib/sharing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/app/shared")({
  component: SharedHub,
});

type Tab = "received" | "sent" | "revoked";

interface Comment {
  id: string;
  shared_item_id: string;
  user_id: string;
  workspace_id: string;
  body: string;
  created_at: string;
}

interface Profile { id: string; display_name: string | null; email: string | null }
interface Workspace { id: string; name: string }

const PERM_ICON: Record<SharePermission, typeof Eye> = {
  view: Eye, comment: MessageSquare, edit: Pencil, duplicate: CopyIcon,
};

function SharedHub() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [tab, setTab] = useState<Tab>("received");
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load shared items related to active workspace
  useEffect(() => {
    if (!activeWorkspaceId) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("shared_items")
        .select("*")
        .or(`source_workspace_id.eq.${activeWorkspaceId},target_workspace_id.eq.${activeWorkspaceId}`)
        .order("updated_at", { ascending: false });
      if (error) console.error("[shared] load", error);
      if (cancelled) return;
      const list = (data ?? []) as SharedItem[];
      setItems(list);
      // Load workspace names + sharer profiles
      const wsIds = Array.from(new Set(list.flatMap((s) => [s.source_workspace_id, s.target_workspace_id])));
      const userIds = Array.from(new Set(list.map((s) => s.shared_by_user_id)));
      if (wsIds.length) {
        const { data: ws } = await supabase.from("workspaces").select("id,name").in("id", wsIds);
        const map: Record<string, string> = {};
        ((ws ?? []) as Workspace[]).forEach((w) => { map[w.id] = w.name; });
        if (!cancelled) setWorkspaces(map);
      }
      if (userIds.length) {
        const { data: pr } = await supabase.from("profiles").select("id,display_name,email").in("id", userIds);
        const m: Record<string, Profile> = {};
        ((pr ?? []) as Profile[]).forEach((p) => { m[p.id] = p; });
        if (!cancelled) setProfiles(m);
      }
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`shared_items_hub:${activeWorkspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_items" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeWorkspaceId]);

  const filtered = useMemo(() => {
    if (!activeWorkspaceId) return [];
    if (tab === "received") return items.filter((s) => s.target_workspace_id === activeWorkspaceId && s.status === "active");
    if (tab === "sent") return items.filter((s) => s.source_workspace_id === activeWorkspaceId && s.status === "active");
    return items.filter((s) => s.status === "revoked");
  }, [items, tab, activeWorkspaceId]);

  const selected = useMemo(() => items.find((s) => s.id === selectedId) ?? null, [items, selectedId]);

  const counts = useMemo(() => ({
    received: items.filter((s) => s.target_workspace_id === activeWorkspaceId && s.status === "active").length,
    sent: items.filter((s) => s.source_workspace_id === activeWorkspaceId && s.status === "active").length,
    revoked: items.filter((s) => s.status === "revoked").length,
  }), [items, activeWorkspaceId]);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30 flex items-center justify-center">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-light tracking-tight">Compartilhados</h1>
            <p className="text-xs text-muted-foreground">
              Itens trocados entre workspaces — recebidos, enviados e histórico.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        <TabButton active={tab === "received"} onClick={() => setTab("received")} icon={Inbox} label="Recebidos" count={counts.received} />
        <TabButton active={tab === "sent"} onClick={() => setTab("sent")} icon={Send} label="Enviados" count={counts.sent} />
        <TabButton active={tab === "revoked"} onClick={() => setTab("revoked")} icon={ShieldCheck} label="Histórico" count={counts.revoked} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        <div className="space-y-2">
          {loading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <Share2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">
                {tab === "received" && "Nada recebido de outros workspaces."}
                {tab === "sent" && "Você ainda não compartilhou nada."}
                {tab === "revoked" && "Sem compartilhamentos revogados."}
              </div>
            </div>
          ) : filtered.map((s) => {
            const isReceived = s.target_workspace_id === activeWorkspaceId;
            const otherWs = isReceived ? s.source_workspace_id : s.target_workspace_id;
            const PermIcon = PERM_ICON[s.permission_level];
            const sharer = profiles[s.shared_by_user_id];
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left rounded-xl border p-4 transition ${
                  selectedId === s.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-surface"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-primary">
                        {SHARE_TYPE_LABEL[s.item_type]}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        s.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                      }`}>
                        {s.status === "active" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                        {s.status === "active" ? "Ativo" : "Revogado"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold">
                        <PermIcon className="h-2.5 w-2.5" /> {SHARE_PERMISSION_LABEL[s.permission_level]}
                      </span>
                    </div>
                    <div className="mt-1.5 font-semibold truncate">{s.item_title ?? "(sem título)"}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {isReceived ? "De " : "Para "}
                      <span className="font-medium text-foreground">{workspaces[otherWs] ?? "—"}</span>
                      <span className="opacity-60">•</span>
                      {sharer?.display_name ?? sharer?.email ?? "—"}
                    </div>
                    {s.message && (
                      <div className="mt-2 text-xs text-muted-foreground italic line-clamp-2">"{s.message}"</div>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(s.updated_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-4 self-start">
          {selected ? (
            <DetailPane
              share={selected}
              workspaces={workspaces}
              profiles={profiles}
              activeWorkspaceId={activeWorkspaceId}
              userId={user?.id ?? ""}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Selecione um item para ver detalhes e conversar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void; icon: typeof Inbox; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-surface"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium">{label}</span>
      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
        active ? "bg-primary/20" : "bg-muted text-muted-foreground"
      }`}>{count}</span>
    </button>
  );
}

function DetailPane({ share, workspaces, profiles, activeWorkspaceId, userId, onClose }: {
  share: SharedItem;
  workspaces: Record<string, string>;
  profiles: Record<string, Profile>;
  activeWorkspaceId: string | null;
  userId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = share.source_workspace_id === activeWorkspaceId || share.shared_by_user_id === userId;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("shared_item_comments")
        .select("*")
        .eq("shared_item_id", share.id)
        .order("created_at", { ascending: true });
      if (!cancelled) setComments((data ?? []) as Comment[]);
      const ids = Array.from(new Set((data ?? []).map((c: Comment) => c.user_id)));
      if (ids.length) {
        const missing = ids.filter((i) => !profiles[i]);
        if (missing.length) await supabase.from("profiles").select("id,display_name,email").in("id", missing);
      }
    };
    load();
    const ch = supabase
      .channel(`shared_comments:${share.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "shared_item_comments", filter: `shared_item_id=eq.${share.id}` },
        () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [share.id, profiles]);

  const handlePost = async () => {
    if (!draft.trim() || !activeWorkspaceId) return;
    setBusy(true);
    const res = await postComment(share.id, userId, activeWorkspaceId, draft);
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Erro ao comentar"); return; }
    setDraft("");
  };

  const handleRevoke = async () => {
    const res = await revokeShare(share.id, userId);
    if (!res.ok) toast.error(res.error ?? "Erro");
    else toast.success("Compartilhamento revogado");
  };
  const handleReactivate = async () => {
    const res = await reactivateShare(share.id, userId);
    if (!res.ok) toast.error(res.error ?? "Erro");
    else toast.success("Reativado");
  };
  const handlePerm = async (p: SharePermission) => {
    const res = await updateSharePermission(share.id, p, userId);
    if (!res.ok) toast.error(res.error ?? "Erro");
    else toast.success("Permissão atualizada");
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col max-h-[calc(100dvh-180px)]">
      <header className="p-4 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">
            {SHARE_TYPE_LABEL[share.item_type]}
          </div>
          <div className="font-semibold truncate">{share.item_title ?? "(sem título)"}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {workspaces[share.source_workspace_id]} → {workspaces[share.target_workspace_id]}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
          <X className="h-4 w-4" />
        </button>
      </header>

      {canManage && (
        <div className="p-3 border-b border-border bg-surface/40">
          <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Permissão</div>
          <div className="flex flex-wrap gap-1.5">
            {(["view","comment","edit","duplicate"] as SharePermission[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePerm(p)}
                className={`text-[11px] px-2 py-1 rounded-md border ${
                  share.permission_level === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-surface"
                }`}
              >
                {SHARE_PERMISSION_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {share.status === "active" ? (
              <Button variant="ghost" size="sm" onClick={handleRevoke} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Revogar
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleReactivate}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reativar
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {comments.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            Sem mensagens ainda.
          </div>
        ) : comments.map((c) => {
          const author = profiles[c.user_id];
          const isMine = c.user_id === userId;
          return (
            <div key={c.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                isMine ? "bg-primary/15 text-foreground" : "bg-surface"
              }`}>
                <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                  {author?.display_name ?? author?.email ?? "Usuário"} • {workspaces[c.workspace_id] ?? ""}
                </div>
                <div className="text-sm whitespace-pre-wrap break-words">{c.body}</div>
                <div className="text-[9px] text-muted-foreground mt-1">
                  {new Date(c.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-3 flex gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva uma mensagem…"
          rows={2}
          className="text-sm"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost(); }}
        />
        <Button onClick={handlePost} disabled={busy || !draft.trim()} size="sm">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Enviar
        </Button>
      </div>
    </div>
  );
}
