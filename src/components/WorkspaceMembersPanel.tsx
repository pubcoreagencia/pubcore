import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, Trash2, Shield, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Member = { user_id: string; role: "admin" | "member"; email: string | null; display_name: string | null };

export function WorkspaceMembersPanel() {
  const { activeWorkspaceId, activeWorkspace, isWorkspaceAdmin } = useWorkspace();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("list_workspace_members" as never, { _workspace_id: activeWorkspaceId } as never);
    setLoading(false);
    if (error) { console.error(error); return; }
    setMembers((data ?? []) as Member[]);
  }, [activeWorkspaceId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const ch = supabase.channel(`wsm:${activeWorkspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter: `workspace_id=eq.${activeWorkspaceId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeWorkspaceId, load]);

  const invite = async () => {
    if (!activeWorkspaceId || !email.trim()) return;
    setInviting(true);
    const { data, error } = await supabase.rpc("invite_member_by_email" as never, {
      _workspace_id: activeWorkspaceId, _email: email.trim(), _role: "member",
    } as never);
    setInviting(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) { toast.error(res?.error ?? "Falha ao convidar"); return; }
    toast.success("Membro adicionado");
    setEmail("");
    load();
  };

  const setRole = async (uid: string, role: "admin" | "member") => {
    if (!activeWorkspaceId) return;
    const { error } = await supabase.rpc("set_member_role" as never, {
      _workspace_id: activeWorkspaceId, _user_id: uid, _role: role,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success(role === "admin" ? "Promovido a admin" : "Rebaixado a membro");
    load();
  };

  const remove = async (uid: string) => {
    if (!activeWorkspaceId) return;
    if (!confirm("Remover este membro do workspace?")) return;
    const { error } = await supabase.rpc("remove_member" as never, {
      _workspace_id: activeWorkspaceId, _user_id: uid,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Membro removido");
    load();
  };

  if (!activeWorkspaceId) return null;

  return (
    <section className="rounded-xl border border-border bg-card shadow-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-primary"><Users className="h-4 w-4" /></div>
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg">Membros do workspace</h2>
          <div className="text-xs text-muted-foreground">{activeWorkspace?.name}</div>
        </div>
      </div>

      {isWorkspaceAdmin && (
        <div className="flex gap-2 mb-5">
          <Input type="email" placeholder="e-mail@exemplo.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()} />
          <Button onClick={invite} disabled={inviting || !email.trim()} className="gap-2">
            <UserPlus className="h-4 w-4" /> Convidar
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {loading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!loading && members.length === 0 && <div className="text-sm text-muted-foreground">Nenhum membro</div>}
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface/40">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm">
              {(m.display_name ?? m.email ?? "?")[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.display_name ?? m.email}</div>
              <div className="text-xs text-muted-foreground truncate">{m.email}</div>
            </div>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md ${m.role === "admin" ? "bg-primary/15 text-primary" : "bg-surface text-muted-foreground"}`}>
              {m.role}
            </span>
            {isWorkspaceAdmin && m.user_id !== user?.id && (
              <div className="flex items-center gap-1">
                {m.role === "member" ? (
                  <button onClick={() => setRole(m.user_id, "admin")} className="p-2 rounded-md hover:bg-surface text-muted-foreground hover:text-primary" title="Promover a admin">
                    <ShieldCheck className="h-4 w-4" />
                  </button>
                ) : (
                  <button onClick={() => setRole(m.user_id, "member")} className="p-2 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground" title="Rebaixar a membro">
                    <Shield className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => remove(m.user_id)} className="p-2 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive" title="Remover">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
