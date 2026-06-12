import { useEffect, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { ShieldCheck, Check, X, Clock, RotateCcw, Loader2, Building2, Trash2, Users, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/admin-accounts")({
  component: AdminAccountsPage,
});

type Account = {
  id: string;
  email: string | null;
  display_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
  member_count: number;
  created_at: string;
};

type FilterStatus = "pending" | "approved" | "rejected" | "all";
type Tab = "accounts" | "workspaces";

function AdminAccountsPage() {
  const { isMaster, loading: wsLoading, activeWorkspaceId, refresh: refreshWs } = useWorkspace();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsListLoading, setWsListLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!wsLoading && !isMaster) nav({ to: "/app" });
  }, [wsLoading, isMaster, nav]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_accounts_by_status", {
      _status: filter === "all" ? undefined : filter,
    });
    if (error) toast.error(error.message);
    setAccounts((data as Account[]) ?? []);
    setLoading(false);
  }, [filter]);

  const loadWorkspaces = useCallback(async () => {
    setWsListLoading(true);
    const { data, error } = await supabase.rpc("list_all_workspaces");
    if (error) toast.error(error.message);
    setWorkspaces((data as Workspace[]) ?? []);
    setWsListLoading(false);
  }, []);

  useEffect(() => { if (isMaster && tab === "accounts") load(); }, [isMaster, tab, load]);
  useEffect(() => { if (isMaster && tab === "workspaces") loadWorkspaces(); }, [isMaster, tab, loadWorkspaces]);

  const setStatus = async (id: string, status: Account["status"]) => {
    setActingId(id);
    const { error } = await supabase.rpc("set_account_status", { _user_id: id, _status: status });
    setActingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Conta aprovada" : status === "rejected" ? "Conta rejeitada" : "Status atualizado");
    load();
  };

  const doDeleteWorkspace = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const target = confirmDelete;
    const { error } = await supabase.rpc("delete_workspace_cascade", { _workspace_id: target.id });
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Workspace "${target.name}" apagado`);
    setConfirmDelete(null);
    setWorkspaces((prev) => prev.filter((w) => w.id !== target.id));
    await refreshWs();
    if (activeWorkspaceId === target.id) nav({ to: "/app" });
  };

  if (!isMaster) return null;

  const counts = { pending: accounts.filter((a) => a.status === "pending").length };

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Administração · MASTER</div>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Controle de contas</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Gerenciar contas de usuários e workspaces da plataforma.</p>
      </header>

      <div className="flex gap-1 mb-4 border-b border-border">
        {([["accounts","Contas"],["workspaces","Workspaces"]] as [Tab,string][]).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab===k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "accounts" ? (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {(["pending","approved","rejected","all"] as FilterStatus[]).map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${filter === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-surface"}`}>
                {labelFor(s)}{s === "pending" && counts.pending > 0 ? ` · ${counts.pending}` : ""}
              </button>
            ))}
            <button onClick={load} className="ml-auto rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface transition inline-flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Atualizar
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            {loading ? (
              <div className="p-10 flex items-center justify-center text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…</div>
            ) : accounts.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nenhuma conta {labelFor(filter).toLowerCase()}.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {accounts.map((a) => (
                  <li key={a.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium truncate">{a.display_name || a.email}</div>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.email}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                        Solicitado em {new Date(a.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {a.status !== "approved" && (
                        <button disabled={actingId === a.id} onClick={() => setStatus(a.id, "approved")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 text-success border border-success/30 px-3 py-1.5 text-xs font-semibold hover:bg-success/25 transition disabled:opacity-50">
                          <Check className="h-3.5 w-3.5" /> Aprovar
                        </button>
                      )}
                      {a.status !== "rejected" && (
                        <button disabled={actingId === a.id} onClick={() => setStatus(a.id, "rejected")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/20 transition disabled:opacity-50">
                          <X className="h-3.5 w-3.5" /> Rejeitar
                        </button>
                      )}
                      {a.status !== "pending" && (
                        <button disabled={actingId === a.id} onClick={() => setStatus(a.id, "pending")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface transition disabled:opacity-50">
                          <Clock className="h-3.5 w-3.5" /> Pendente
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-muted-foreground">{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""} no sistema</div>
            <button onClick={loadWorkspaces} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface transition inline-flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Atualizar
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            {wsListLoading ? (
              <div className="p-10 flex items-center justify-center text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…</div>
            ) : workspaces.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nenhum workspace encontrado.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {workspaces.map((w) => {
                  const isActive = w.id === activeWorkspaceId;
                  return (
                    <li key={w.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium truncate">{w.name}</div>
                          {isActive && <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Ativo</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                          <Crown className="h-3 w-3 shrink-0" />
                          <span className="truncate">{w.owner_name || w.owner_email || w.owner_id}</span>
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 flex items-center gap-3">
                          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {w.member_count} membro{w.member_count !== 1 ? "s" : ""}</span>
                          <span>Criado em {new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <button
                          onClick={() => setConfirmDelete(w)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/20 transition">
                          <Trash2 className="h-3.5 w-3.5" /> Apagar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar workspace "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga permanentemente o workspace e <strong>todos</strong> os seus dados:
              empresas, pontos, checklists, kanban, finanças, estoque, notas, calendário, CRM e membros.
              Não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDeleteWorkspace} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Apagando…</> : <>Apagar definitivamente</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function labelFor(s: FilterStatus) {
  switch (s) {
    case "pending": return "Pendentes";
    case "approved": return "Aprovadas";
    case "rejected": return "Rejeitadas";
    default: return "Todas";
  }
}

function StatusBadge({ status }: { status: Account["status"] }) {
  const map = {
    pending: { label: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
    approved: { label: "Aprovada", cls: "bg-success/15 text-success border-success/30" },
    rejected: { label: "Rejeitada", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  } as const;
  const v = map[status];
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${v.cls}`}>{v.label}</span>;
}
