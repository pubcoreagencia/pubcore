import { useEffect, useMemo, useState, useCallback } from "react";
import { Play, Loader2, RotateCw, Repeat } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { usePonto } from "@/lib/ponto";
import { type Company } from "@/lib/mock-data";
import { useChecklistCompanies } from "@/lib/checklist-companies";
import { toast } from "sonner";

const CYCLE_KEY = "pubcore_ponto_cycle_start_v1";
const CHECK_MS = 5_000;
// Sem fallback fixo: o limite vem 100% das configurações da empresa.
// Se a empresa ainda não foi carregada ou não tem limite definido,
// o painel de rotação permanece inativo.

type CycleState = { sessionId: string; startedAt: number } | null;

function readCycle(): CycleState {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CYCLE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v && typeof v.sessionId === "string" && typeof v.startedAt === "number") return v;
    return null;
  } catch {
    return null;
  }
}
function writeCycle(v: CycleState) {
  if (typeof window === "undefined") return;
  if (!v) localStorage.removeItem(CYCLE_KEY);
  else localStorage.setItem(CYCLE_KEY, JSON.stringify(v));
}

/**
 * Painel de rotação operacional.
 * O limite (tempo e ativação) vem 100% das configurações da empresa
 * (checklist_companies.ponto_daily_limit_minutes / ponto_limit_enabled).
 */
export function ShiftRotationPanel() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { activeCompany, sessions, startCompany } = usePonto();
  const { companies: checklistCompanies, colorOf } = useChecklistCompanies();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Company | "extend" | null>(null);

  const activeSession = activeCompany ? sessions[activeCompany] : undefined;
  const activeSessionId = activeSession?.sessionId ?? null;
  const isLive =
    activeSession?.status === "working" || activeSession?.status === "paused";

  // Configuração dinâmica da empresa ativa (fonte única de verdade)
  const activeConfig = useMemo(() => {
    const cc = checklistCompanies.find((x) => x.name === activeCompany);
    // Sem empresa carregada ou sem limite configurado → painel desativado.
    const hasConfig = !!cc && typeof cc.ponto_daily_limit_minutes === "number" && cc.ponto_daily_limit_minutes > 0;
    const limitEnabled = hasConfig && cc?.ponto_limit_enabled !== false;
    const limitMinutes = hasConfig ? Math.max(1, cc!.ponto_daily_limit_minutes as number) : 0;
    return { limitEnabled, limitMinutes, limitMs: limitMinutes * 60 * 1000 };
  }, [checklistCompanies, activeCompany]);

  // Garante registro de início do ciclo para a sessão ativa
  useEffect(() => {
    if (!isLive || !activeSessionId || !activeSession?.startedAt) {
      const cur = readCycle();
      if (cur && (!activeSessionId || cur.sessionId !== activeSessionId)) {
        writeCycle(null);
      }
      return;
    }
    const cur = readCycle();
    if (!cur || cur.sessionId !== activeSessionId) {
      writeCycle({ sessionId: activeSessionId, startedAt: activeSession.startedAt });
    }
  }, [isLive, activeSessionId, activeSession?.startedAt]);

  // Se o limite for desativado, cancela qualquer modal pendente imediatamente
  useEffect(() => {
    if (!activeConfig.limitEnabled && open) setOpen(false);
  }, [activeConfig.limitEnabled, open]);

  // Verifica periodicamente o limite do ciclo
  useEffect(() => {
    if (!user?.id || !activeWorkspaceId) return;
    if (!isLive || !activeSessionId || !activeConfig.limitEnabled) {
      if (open) setOpen(false);
      return;
    }
    const limitMs = activeConfig.limitMs;
    const check = () => {
      const cur = readCycle();
      if (!cur || cur.sessionId !== activeSessionId) return;
      if (Date.now() - cur.startedAt >= limitMs) setOpen(true);
    };
    check();
    const id = window.setInterval(check, CHECK_MS);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", check);
    };
  }, [
    user?.id,
    activeWorkspaceId,
    isLive,
    activeSessionId,
    open,
    activeConfig.limitEnabled,
    activeConfig.limitMs,
  ]);

  // Lock scroll quando aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const limitMinutes = activeConfig.limitMinutes;

  const handleExtend = useCallback(() => {
    if (!activeSessionId) return;
    setBusy("extend");
    try {
      writeCycle({ sessionId: activeSessionId, startedAt: Date.now() });
      toast.success(`Expediente em ${activeCompany} estendido por mais ${limitMinutes}min`);
      setOpen(false);
    } finally {
      setBusy(null);
    }
  }, [activeSessionId, activeCompany, limitMinutes]);

  const handlePick = useCallback(
    async (c: Company) => {
      if (busy) return;
      if (c === activeCompany) {
        handleExtend();
        return;
      }
      setBusy(c);
      try {
        await startCompany(c, user?.name, user?.email, user?.id);
        toast.success(`Expediente em ${c} iniciado`);
        setOpen(false);
      } catch (e) {
        console.error(e);
        toast.error("Não foi possível trocar de empresa. Tente novamente.");
      } finally {
        setBusy(null);
      }
    },
    [busy, activeCompany, handleExtend, startCompany, user],
  );

  if (!open || !activeCompany || !activeConfig.limitEnabled) return null;

  return (
    <div className="fixed inset-0 z-[96] flex items-stretch justify-center overflow-y-auto bg-background/95 backdrop-blur-sm p-0 md:p-6 animate-in fade-in duration-300">
      <div className="relative w-full max-w-3xl my-auto md:my-6">
        <div className="relative rounded-none md:rounded-3xl border border-border/40 bg-card shadow-2xl overflow-hidden">
          <header className="px-6 md:px-10 pt-8 pb-6 text-center border-b border-border/30">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30 mb-4">
              <RotateCw className="h-6 w-6 text-primary" />
            </div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">
              Rotação de expediente
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-light tracking-tight">
              {limitMinutes} minutos em {activeCompany}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Escolha o próximo ponto. Você pode trocar de empresa ou estender o expediente atual
              por mais {limitMinutes} minutos.
            </p>
          </header>

          <div className="px-4 md:px-8 py-6 max-h-[65vh] overflow-y-auto space-y-5">
            <button
              onClick={handleExtend}
              disabled={busy !== null}
              className="group relative w-full rounded-2xl border-2 border-primary/50 bg-primary/10 hover:bg-primary/20 transition-all p-5 text-left overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/40 shrink-0">
                    <Repeat className="h-5 w-5 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-display font-bold tracking-tight text-base">
                      Estender Expediente Atual
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Continuar em {activeCompany} por mais {limitMinutes} minutos
                    </div>
                  </div>
                </div>
                {busy === "extend" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-primary">
                    Estender
                  </span>
                )}
              </div>
            </button>

            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-3 px-1">
                Trocar para outra empresa
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {checklistCompanies
                  .map((cc) => cc.name)
                  .filter((c: string) => c !== activeCompany)
                  .map((c: string) => {
                  const color = colorOf(c);
                  const isStarting = busy === c;
                  const disabled = busy !== null && !isStarting;
                  return (
                    <button
                      key={c}
                      onClick={() => handlePick(c)}
                      disabled={disabled || isStarting}
                      className="group relative rounded-2xl border border-border/60 bg-surface/50 hover:bg-surface hover:border-primary/40 transition-all p-4 text-left overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div
                        className="absolute inset-0 opacity-40 pointer-events-none transition-opacity group-hover:opacity-70"
                        style={{
                          background: `radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, ${color} 22%, transparent), transparent 65%)`,
                        }}
                      />
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
                          />
                          <span className="font-display font-bold tracking-tight text-sm truncate">
                            {c}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-primary opacity-0 group-hover:opacity-100 transition">
                          {isStarting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          {isStarting ? "Iniciando" : "Iniciar"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <footer className="px-6 md:px-10 py-4 border-t border-border/30 bg-background/30 text-[11px] text-muted-foreground text-center">
            O limite de {limitMinutes}min é apenas uma rotação operacional — seu expediente do dia
            continua normalmente.
          </footer>
        </div>
      </div>
    </div>
  );
}
