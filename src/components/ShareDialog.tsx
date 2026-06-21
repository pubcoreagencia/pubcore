import { useEffect, useMemo, useState } from "react";
import { Share2, Loader2, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  createShare, SHARE_PERMISSION_LABEL, SHARE_TYPE_LABEL,
  type ShareItemType, type SharePermission,
} from "@/lib/sharing";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itemType: ShareItemType;
  itemId: string;
  itemTitle: string;
}

interface WorkspaceOption { id: string; name: string }

export function ShareDialog({ open, onOpenChange, itemType, itemId, itemTitle }: Props) {
  const { user } = useAuth();
  const { activeWorkspaceId, workspaces, isMaster } = useWorkspace();
  const [targets, setTargets] = useState<WorkspaceOption[]>([]);
  const [targetId, setTargetId] = useState<string>("");
  const [permission, setPermission] = useState<SharePermission>("view");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage(""); setFilter(""); setPermission("view"); setTargetId("");
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Master: list all workspaces. Otherwise: only workspaces the user belongs to.
      if (isMaster) {
        const { data } = await supabase.from("workspaces").select("id,name").order("name");
        if (!cancelled) setTargets(((data ?? []) as WorkspaceOption[]).filter((w) => w.id !== activeWorkspaceId));
      } else {
        setTargets(workspaces.filter((w) => w.id !== activeWorkspaceId).map((w) => ({ id: w.id, name: w.name })));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, activeWorkspaceId, workspaces, isMaster]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((t) => t.name.toLowerCase().includes(q));
  }, [targets, filter]);

  const handleShare = async () => {
    if (!user?.id || !activeWorkspaceId || !targetId) return;
    setBusy(true);
    const res = await createShare({
      item_type: itemType,
      item_id: itemId,
      item_title: itemTitle,
      source_workspace_id: activeWorkspaceId,
      target_workspace_id: targetId,
      permission_level: permission,
      message: message.trim() || undefined,
    }, user.id);
    setBusy(false);
    if (!res.ok) { toast.error(res.error ?? "Falha ao compartilhar"); return; }
    toast.success("Compartilhado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            Compartilhar {SHARE_TYPE_LABEL[itemType].toLowerCase()}
          </DialogTitle>
          <DialogDescription className="truncate">{itemTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace de destino
            </label>
            <Input
              placeholder="Buscar workspace…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="mt-2"
            />
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
              {loading ? (
                <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando workspaces…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  Nenhum workspace disponível.
                </div>
              ) : filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTargetId(t.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition ${
                    targetId === t.id ? "bg-primary/10 text-primary" : "hover:bg-surface"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Permissão
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["view", "comment", "edit", "duplicate"] as SharePermission[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPermission(p)}
                  className={`rounded-lg border px-3 py-2 text-sm text-left transition ${
                    permission === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-surface"
                  }`}
                >
                  <div className="font-semibold">{SHARE_PERMISSION_LABEL[p]}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p === "view" && "Somente leitura"}
                    {p === "comment" && "Leitura + comentários"}
                    {p === "edit" && "Edita o original"}
                    {p === "duplicate" && "Copia para o workspace"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mensagem (opcional)
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="mt-2"
              placeholder="Ex: Confere se faz sentido pro funil de vocês."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleShare} disabled={!targetId || busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Compartilhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
