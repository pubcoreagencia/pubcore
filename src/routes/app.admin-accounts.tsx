import { useEffect, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { ShieldCheck, Check, X, Clock, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

type FilterStatus = "pending" | "approved" | "rejected" | "all";

function AdminAccountsPage() {
  const { isMaster, loading: wsLoading } = useWorkspace();
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!wsLoading && !isMaster) nav({ to: "/app" });
  }, [wsLoading, isMaster, nav]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_accounts_by_status", {
      _status: filter === "all" ? null : filter,
    });
    if (error) toast.error(error.message);
    setAccounts((data as Account[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { if (isMaster) load(); }, [isMaster, load]);

  const setStatus = async (id: string, status: Account["status"]) => {
    setActingId(id);
    const { error } = await supabase.rpc("set_account_status", { _user_id: id, _status: status });
    setActingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Conta aprovada" : status === "rejected" ? "Conta rejeitada" : "Status atualizado");
    load();
  };

  if (!isMaster) return null;

  const counts = {
    pending: accounts.filter((a) => a.status === "pending").length,
  };

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Administração · MASTER</div>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Controle de contas</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Aprovar, rejeitar e gerenciar o acesso de usuários à plataforma.</p>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        {(["pending","approved","rejected","all"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${filter === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-surface"}`}
          >
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
                    <button
                      disabled={actingId === a.id}
                      onClick={() => setStatus(a.id, "approved")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 text-success border border-success/30 px-3 py-1.5 text-xs font-semibold hover:bg-success/25 transition disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Aprovar
                    </button>
                  )}
                  {a.status !== "rejected" && (
                    <button
                      disabled={actingId === a.id}
                      onClick={() => setStatus(a.id, "rejected")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/20 transition disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Rejeitar
                    </button>
                  )}
                  {a.status !== "pending" && (
                    <button
                      disabled={actingId === a.id}
                      onClick={() => setStatus(a.id, "pending")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface transition disabled:opacity-50"
                    >
                      <Clock className="h-3.5 w-3.5" /> Pendente
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
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
