import { useEffect, useState } from "react";
import { Play, Loader2, Sunrise } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { usePonto } from "@/lib/ponto";
import { COMPANIES, COMPANY_COLORS, type Company } from "@/lib/mock-data";
import { toast } from "sonner";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfTodayISO() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Painel obrigatório de seleção do primeiro expediente do dia.
 * Aparece após o Painel da Gratidão, apenas se:
 *  - gratidão do dia já foi concluída
 *  - não existe nenhum ponto iniciado hoje (working / paused / ended)
 */
export function FirstShiftPanel() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { startCompany } = usePonto();

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [starting, setStarting] = useState<Company | null>(null);

  // Verifica condições uma única vez por sessão de usuário
  useEffect(() => {
    if (!user?.id || !activeWorkspaceId) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        // 1) Gratidão de hoje precisa estar concluída
        const { data: grat } = await (supabase as any)
          .from("gratitude_entries")
          .select("completed_at")
          .eq("user_id", user.id)
          .eq("entry_date", todayISO())
          .maybeSingle();
        if (cancelled) return;
        if (!grat?.completed_at) {
          // Espera a gratidão ser concluída — reavalia em alguns segundos
          setOpen(false);
          setChecking(false);
          return;
        }

        // 2) Não pode haver ponto iniciado hoje (qualquer status)
        const { data: sess } = await supabase
          .from("ponto_sessions")
          .select("id")
          .eq("user_id", user.id)
          .gte("started_at", startOfTodayISO())
          .limit(1);
        if (cancelled) return;

        if (!sess || sess.length === 0) {
          setOpen(true);
        } else {
          setOpen(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeWorkspaceId]);

  // Reavalia periodicamente até gratidão concluir (sem ficar pesado)
  useEffect(() => {
    if (open || checking || !user?.id) return;
    const id = window.setInterval(async () => {
      const { data: grat } = await (supabase as any)
        .from("gratitude_entries")
        .select("completed_at")
        .eq("user_id", user.id)
        .eq("entry_date", todayISO())
        .maybeSingle();
      if (!grat?.completed_at) return;
      const { data: sess } = await supabase
        .from("ponto_sessions")
        .select("id")
        .eq("user_id", user.id)
        .gte("started_at", startOfTodayISO())
        .limit(1);
      if (!sess || sess.length === 0) setOpen(true);
    }, 4000);
    return () => window.clearInterval(id);
  }, [open, checking, user?.id]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handlePick = async (c: Company) => {
    if (starting) return;
    setStarting(c);
    try {
      await startCompany(c, user?.name, user?.email, user?.id);
      toast.success(`Expediente em ${c} iniciado`);
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível iniciar. Tente novamente.");
    } finally {
      setStarting(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-stretch justify-center overflow-y-auto bg-background/95 backdrop-blur-sm p-0 md:p-6 animate-in fade-in duration-300">
      <div className="relative w-full max-w-3xl my-auto md:my-6">
        <div className="relative rounded-none md:rounded-3xl border border-border/40 bg-card shadow-2xl overflow-hidden">
          <header className="px-6 md:px-10 pt-8 pb-6 text-center border-b border-border/30">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30 mb-4">
              <Sunrise className="h-6 w-6 text-primary" />
            </div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">Início do dia</div>
            <h1 className="mt-2 text-2xl md:text-3xl font-light tracking-tight">Escolha seu primeiro expediente</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Selecione a empresa onde você começará a trabalhar. O timer iniciará automaticamente.
            </p>
          </header>

          <div className="px-4 md:px-8 py-6 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {COMPANIES.map((c) => {
                const color = COMPANY_COLORS[c];
                const isStarting = starting === c;
                const disabled = starting !== null && !isStarting;
                return (
                  <button
                    key={c}
                    onClick={() => handlePick(c)}
                    disabled={disabled || isStarting}
                    className="group relative rounded-2xl border border-border/60 bg-surface/50 hover:bg-surface hover:border-primary/40 transition-all p-4 text-left overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div
                      className="absolute inset-0 opacity-40 pointer-events-none transition-opacity group-hover:opacity-70"
                      style={{ background: `radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, ${color} 22%, transparent), transparent 65%)` }}
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
                        />
                        <span className="font-display font-bold tracking-tight text-sm truncate">{c}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-primary opacity-0 group-hover:opacity-100 transition">
                        {isStarting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        {isStarting ? "Iniciando" : "Iniciar"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <footer className="px-6 md:px-10 py-4 border-t border-border/30 bg-background/30 text-[11px] text-muted-foreground text-center">
            Esta seleção só aparece uma vez por dia. Você poderá trocar de empresa depois pelo painel "Bater Ponto".
          </footer>
        </div>
      </div>
    </div>
  );
}
