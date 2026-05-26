import { useEffect } from "react";
import { Clock, ShieldCheck, LogOut, RefreshCw, XCircle } from "lucide-react";
import { useAuth, type AccountStatus } from "@/lib/auth";

export function PendingApprovalScreen({ status }: { status: AccountStatus }) {
  const { user, logout, refreshAccountStatus } = useAuth();
  const rejected = status === "rejected";

  // Auto-refresh status every 20s while waiting
  useEffect(() => {
    if (rejected) return;
    const id = setInterval(() => { refreshAccountStatus(); }, 20000);
    return () => clearInterval(id);
  }, [rejected, refreshAccountStatus]);

  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-background p-6">
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-transparent to-info/10 blur-3xl" />
        <div className="rounded-2xl border border-border bg-card shadow-card p-8 text-center">
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${rejected ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {rejected ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">PUB CORE</div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {rejected ? "Acesso não autorizado" : "Aguardando aprovação"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {rejected
              ? "Sua solicitação de acesso à PUB CORE foi recusada. Caso acredite que isso seja um engano, entre em contato com a administração."
              : "Sua conta foi criada com sucesso e está em análise. Um administrador precisa aprovar seu acesso antes que você possa entrar na plataforma."}
          </p>

          <div className="mt-6 rounded-xl border border-border bg-surface/50 px-4 py-3 text-left">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Conta</div>
            <div className="text-sm font-medium mt-0.5 truncate">{user?.email}</div>
          </div>

          {!rejected && (
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span>Plataforma privada — acesso restrito</span>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            {!rejected && (
              <button
                onClick={() => refreshAccountStatus()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface/70 transition"
              >
                <RefreshCw className="h-4 w-4" /> Verificar
              </button>
            )}
            <button
              onClick={() => logout()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
