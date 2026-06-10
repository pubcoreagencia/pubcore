import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Save, X, AlertTriangle, Timer, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtTime } from "@/lib/ponto";
import { type Company } from "@/lib/mock-data";
import { useChecklistCompanies } from "@/lib/checklist-companies";

export interface EditablePontoSession {
  id: string;
  workspace_id?: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
  total_ms: number | null;
  productive_ms: number | null;
  pause_ms: number | null;
  pauses?: unknown;
  notes?: string | null;
  description?: string | null;
  company?: string | null;
  user_name?: string | null;
  original_started_at?: string | null;
  original_ended_at?: string | null;
}

interface Props {
  session: EditablePontoSession | null;
  onClose: () => void;
  onSaved?: () => void;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function normalizePauses(input: unknown): { start: number; end?: number }[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const r = p as { start?: unknown; end?: unknown };
      const s = Number(r.start);
      const e = r.end == null ? undefined : Number(r.end);
      if (!Number.isFinite(s)) return null;
      return Number.isFinite(e) ? { start: s, end: e as number } : { start: s };
    })
    .filter(Boolean) as { start: number; end?: number }[];
}

export function EditPontoSessionDialog({ session, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [company, setCompany] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    setStart(toLocalInput(session.started_at));
    setEnd(toLocalInput(session.ended_at));
    setCompany(session.company ?? "");
    setNotes(session.notes ?? "");
    setDescription(session.description ?? "");
  }, [session]);

  const startDate = useMemo(() => fromLocalInput(start), [start]);
  const endDate = useMemo(() => fromLocalInput(end), [end]);

  const validation = useMemo(() => {
    if (!startDate) return { ok: false, msg: "Horário de início inválido." };
    if (!endDate) return { ok: false, msg: "Horário de término inválido." };
    if (endDate.getTime() <= startDate.getTime())
      return { ok: false, msg: "O término deve ser depois do início." };
    return { ok: true as const, msg: "" };
  }, [startDate, endDate]);

  const recomputed = useMemo(() => {
    if (!session || !startDate || !endDate || !validation.ok) {
      return { totalMs: 0, pauseMs: 0, productiveMs: 0, pauses: [] as { start: number; end?: number }[] };
    }
    const s = startDate.getTime();
    const e = endDate.getTime();
    const totalMs = Math.max(0, e - s);
    // Clip pauses ao novo intervalo
    const raw = normalizePauses(session.pauses);
    const clipped = raw
      .map((p) => {
        const ps = Math.max(s, p.start);
        const pe = Math.min(e, p.end ?? e);
        if (pe <= ps) return null;
        return { start: ps, end: pe };
      })
      .filter(Boolean) as { start: number; end: number }[];
    const pauseMs = clipped.reduce((a, p) => a + Math.max(0, (p.end ?? e) - p.start), 0);
    const productiveMs = Math.max(0, totalMs - pauseMs);
    return { totalMs, pauseMs, productiveMs, pauses: clipped };
  }, [session, startDate, endDate, validation.ok]);

  if (!session) return null;

  const handleSave = async () => {
    if (!validation.ok || !startDate || !endDate) {
      toast.error(validation.msg);
      return;
    }
    setSaving(true);
    try {
      const previous = {
        started_at: session.started_at,
        ended_at: session.ended_at,
        total_ms: session.total_ms,
        productive_ms: session.productive_ms,
        pause_ms: session.pause_ms,
        company: session.company,
        notes: session.notes ?? null,
        description: session.description ?? null,
      };
      const next = {
        started_at: startDate.toISOString(),
        ended_at: endDate.toISOString(),
        status: "ended",
        total_ms: recomputed.totalMs,
        productive_ms: recomputed.productiveMs,
        pause_ms: recomputed.pauseMs,
        pauses: recomputed.pauses as unknown as never,
        company: company || null,
        notes: notes.trim() ? notes.trim() : null,
        description: description.trim() ? description.trim() : null,
        edited_at: new Date().toISOString(),
        edited_by: user?.id ?? null,
        original_started_at: session.original_started_at ?? session.started_at,
        original_ended_at: session.original_ended_at ?? session.ended_at,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;

      const { error } = await supabase
        .from("ponto_sessions")
        .update(next as never)
        .eq("id", session.id);
      if (error) throw error;

      // Auditoria — best-effort
      if (session.workspace_id && user?.id) {
        await supabase.from("ponto_session_edits").insert({
          session_id: session.id,
          workspace_id: session.workspace_id,
          edited_by: user.id,
          edited_by_email: user.email ?? null,
          previous: previous as unknown as never,
          next: next as unknown as never,
        } as never);
      }

      toast.success("Expediente atualizado");
      onSaved?.();
      onClose();
    } catch (e) {
      console.error("[ponto] edit error", e);
      toast.error("Não foi possível salvar o expediente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Editar expediente</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-surface" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Início</span>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Término</span>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Empresa</span>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="">— sem empresa —</option>
              {COMPANIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Descrição operacional</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="O que foi feito neste expediente?"
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Observações</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Ex.: esqueci de iniciar, falha de internet, etc."
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm resize-none"
            />
          </label>

          <div className="rounded-lg border border-border bg-surface/60 p-3 text-xs grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Total</div>
              <div className="font-mono font-semibold tabular-nums flex items-center gap-1"><Timer className="h-3 w-3 text-primary" />{fmtTime(recomputed.totalMs)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Pausa</div>
              <div className="font-mono font-semibold tabular-nums">{fmtTime(recomputed.pauseMs)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Produtivo</div>
              <div className="font-mono font-semibold tabular-nums text-success">{fmtTime(recomputed.productiveMs)}</div>
            </div>
          </div>

          {!validation.ok && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{validation.msg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 sm:p-5 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm border border-border bg-surface hover:bg-surface-elevated"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!validation.ok || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
