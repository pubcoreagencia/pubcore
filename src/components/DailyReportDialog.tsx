import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Save, Download, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Member { user_id: string; display_name: string | null; email: string | null }

function fmtMs(ms: number) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}m`;
}
function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function dayBounds(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString(), startMs: start.getTime(), endMs: end.getTime() };
}

const HISTORY_KEY = "pubcore:dailyReport:history";

export function DailyReportDialog({ open, onOpenChange }: Props) {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [date, setDate] = useState(today);
  const [userFilter, setUserFilter] = useState<string>("__me");
  const [companyFilter, setCompanyFilter] = useState<string>("__all");
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string>("");

  // Load filter options
  useEffect(() => {
    if (!open || !activeWorkspaceId) return;
    (async () => {
      const [memRes, coRes] = await Promise.all([
        supabase.rpc("list_workspace_members", { _workspace_id: activeWorkspaceId }),
        supabase.from("checklist_companies").select("name").eq("workspace_id", activeWorkspaceId).is("parent_company_id", null).order("name"),
      ]);
      setMembers(((memRes.data as Member[]) ?? []));
      setCompanies(((coRes.data ?? []) as { name: string }[]).map((c) => c.name));
    })();
  }, [open, activeWorkspaceId]);

  const generate = async () => {
    if (!activeWorkspaceId || !user) return;
    setLoading(true);
    try {
      const { startISO, endISO } = dayBounds(date);
      const targetUserId = userFilter === "__me" ? user.id : userFilter === "__all" ? null : userFilter;
      const targetUserName = (() => {
        if (userFilter === "__me") return user.email ?? "Eu";
        if (userFilter === "__all") return "Todos os membros";
        const m = members.find((x) => x.user_id === userFilter);
        return m?.display_name || m?.email || "—";
      })();

      // Helpers to apply filters
      const applyUserCo = <T extends any>(q: T): T => {
        let r: any = q;
        if (targetUserId) r = r.eq("user_id", targetUserId);
        if (companyFilter !== "__all") r = r.eq("company", companyFilter);
        return r as T;
      };

      // Sessions overlapping the day
      let sessQ: any = supabase.from("ponto_sessions")
        .select("id, started_at, ended_at, status, total_ms, productive_ms, pause_ms, company, description, notes, user_id, user_name")
        .eq("workspace_id", activeWorkspaceId)
        .lte("started_at", endISO)
        .or(`ended_at.gte.${startISO},ended_at.is.null`);
      sessQ = applyUserCo(sessQ);
      const sessRes = await sessQ;

      let stQ: any = supabase.from("ponto_session_tasks")
        .select("id, company, title, completed_at, user_name, session_id")
        .eq("workspace_id", activeWorkspaceId)
        .gte("completed_at", startISO).lte("completed_at", endISO);
      stQ = applyUserCo(stQ);
      const stRes = await stQ;

      // Checklist completions today
      let cdQ: any = supabase.from("checklist_daily_completions")
        .select("task_id, task_title, company, completed_at, user_name")
        .eq("workspace_id", activeWorkspaceId)
        .gte("completed_at", startISO).lte("completed_at", endISO);
      cdQ = applyUserCo(cdQ);
      const cdRes = await cdQ;

      // Kanban cards: created / updated / done today
      let kCreatedQ: any = supabase.from("kanban_cards")
        .select("id, title, company, status, funnel_id, parent_card_id, created_at, updated_at")
        .eq("workspace_id", activeWorkspaceId)
        .gte("created_at", startISO).lte("created_at", endISO);
      kCreatedQ = applyUserCo(kCreatedQ);
      const kCreatedRes = await kCreatedQ;

      let kUpdatedQ: any = supabase.from("kanban_cards")
        .select("id, title, company, status, funnel_id, parent_card_id, created_at, updated_at")
        .eq("workspace_id", activeWorkspaceId)
        .gte("updated_at", startISO).lte("updated_at", endISO);
      kUpdatedQ = applyUserCo(kUpdatedQ);
      const kUpdatedRes = await kUpdatedQ;

      // Kanban-linked checklist_tasks (internal tasks) completed today
      let ktDoneQ: any = supabase.from("checklist_tasks")
        .select("id, title, company, done_at, funnel_id, column_id, parent_id, status")
        .eq("workspace_id", activeWorkspaceId)
        .not("funnel_id", "is", null)
        .gte("done_at", startISO).lte("done_at", endISO);
      ktDoneQ = applyUserCo(ktDoneQ);
      const ktDoneRes = await ktDoneQ;

      // Notes created/edited today
      let nQ: any = supabase.from("notes")
        .select("id, title, company, created_at, updated_at, user_name")
        .eq("workspace_id", activeWorkspaceId)
        .or(`and(created_at.gte.${startISO},created_at.lte.${endISO}),and(updated_at.gte.${startISO},updated_at.lte.${endISO})`);
      if (targetUserId) nQ = nQ.eq("user_id", targetUserId);
      if (companyFilter !== "__all") nQ = nQ.eq("company", companyFilter);
      const nRes = await nQ;

      // Files uploaded/changed today
      let fQ: any = supabase.from("files_items")
        .select("id, name, company, created_at, updated_at, created_by, size_bytes")
        .eq("workspace_id", activeWorkspaceId)
        .or(`and(created_at.gte.${startISO},created_at.lte.${endISO}),and(updated_at.gte.${startISO},updated_at.lte.${endISO})`);
      if (targetUserId) fQ = fQ.eq("created_by", targetUserId);
      if (companyFilter !== "__all") fQ = fQ.eq("company", companyFilter);
      const fRes = await fQ;

      // Funnel names map
      const funnelIds = Array.from(new Set([
        ...(kCreatedRes.data ?? []).map((c: any) => c.funnel_id),
        ...(kUpdatedRes.data ?? []).map((c: any) => c.funnel_id),
        ...(ktDoneRes.data ?? []).map((c: any) => c.funnel_id),
      ].filter(Boolean)));
      let funnelMap = new Map<string, string>();
      if (funnelIds.length) {
        const fr = await supabase.from("kanban_funnels").select("id, name").in("id", funnelIds);
        for (const f of (fr.data ?? []) as { id: string; name: string }[]) funnelMap.set(f.id, f.name);
      }

      // Parent card names map for internal tasks
      const parentColumnIds = Array.from(new Set((ktDoneRes.data ?? []).map((t: any) => t.column_id).filter(Boolean))) as string[];
      let columnFunnelMap = new Map<string, string>(); // column -> column name
      if (parentColumnIds.length) {
        const cr = await supabase.from("kanban_columns").select("id, name").in("id", parentColumnIds);
        for (const c of (cr.data ?? []) as { id: string; name: string }[]) columnFunnelMap.set(c.id, c.name);
      }

      // Aggregate
      const sessions = (sessRes.data ?? []) as any[];
      const sessTasks = (stRes.data ?? []) as any[];
      const cdone = (cdRes.data ?? []) as any[];
      const kCreated = (kCreatedRes.data ?? []) as any[];
      const kUpdatedAll = (kUpdatedRes.data ?? []) as any[];
      const createdIds = new Set(kCreated.map((c) => c.id));
      const kEdited = kUpdatedAll.filter((c) => !createdIds.has(c.id));
      const kDone = kUpdatedAll.filter((c) => c.status === "done" || c.status === "archived");
      const ktDone = (ktDoneRes.data ?? []) as any[];
      const notes = (nRes.data ?? []) as any[];
      const files = (fRes.data ?? []) as any[];

      // Time per company (clipped to day)
      const { startMs, endMs } = dayBounds(date);
      const timePerCompany = new Map<string, number>();
      let totalMs = 0;
      for (const s of sessions) {
        const a = Math.max(startMs, new Date(s.started_at).getTime());
        const b = Math.min(endMs, s.ended_at ? new Date(s.ended_at).getTime() : Date.now());
        const dur = Math.max(0, b - a);
        totalMs += dur;
        const co = s.company || "Sem empresa";
        timePerCompany.set(co, (timePerCompany.get(co) ?? 0) + dur);
      }

      // Build text
      const lines: string[] = [];
      const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      lines.push(`📋 RELATÓRIO DO DIA — ${dateLabel}`);
      lines.push(`Usuário: ${targetUserName}`);
      if (companyFilter !== "__all") lines.push(`Empresa: ${companyFilter}`);
      lines.push("");
      lines.push("═══ RESUMO ═══");
      lines.push(`• Tempo total trabalhado: ${fmtMs(totalMs)}`);
      lines.push(`• Empresas trabalhadas: ${timePerCompany.size ? Array.from(timePerCompany.keys()).join(", ") : "—"}`);
      lines.push(`• Tarefas concluídas (expediente): ${sessTasks.length}`);
      lines.push(`• Checklist concluído: ${cdone.length}`);
      lines.push(`• Cards Kanban — criados: ${kCreated.length} · editados: ${kEdited.length} · concluídos: ${kDone.length}`);
      lines.push(`• Tarefas internas Kanban concluídas: ${ktDone.length}`);
      lines.push(`• Notas: ${notes.length} · Arquivos: ${files.length}`);
      lines.push("");

      lines.push("═══ EXPEDIENTE E PONTOS ═══");
      if (!sessions.length) lines.push("Nenhum expediente registrado.");
      else {
        const sorted = [...sessions].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
        for (const s of sorted) {
          lines.push(`• ${s.company || "Sem empresa"} — ${fmtTime(s.started_at)} → ${fmtTime(s.ended_at)} (produtivo: ${fmtMs(s.productive_ms ?? 0)}, pausa: ${fmtMs(s.pause_ms ?? 0)})${s.status !== "ended" ? " [em andamento]" : ""}`);
          if (s.description) lines.push(`   ↳ ${s.description}`);
        }
        lines.push("");
        lines.push("Tempo por empresa:");
        for (const [co, ms] of Array.from(timePerCompany.entries()).sort((a, b) => b[1] - a[1])) {
          lines.push(`  – ${co}: ${fmtMs(ms)}`);
        }
      }
      lines.push("");

      lines.push("═══ CHECKLIST ═══");
      if (!cdone.length) lines.push("Nenhuma tarefa de checklist concluída.");
      else {
        const sorted = [...cdone].sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
        for (const t of sorted) lines.push(`• [${fmtTime(t.completed_at)}] ${t.task_title} — ${t.company || "—"}`);
      }
      lines.push("");

      lines.push("═══ KANBAN ═══");
      const fmtCard = (c: any) => `${c.title} (${funnelMap.get(c.funnel_id) || "—"}${c.company ? " · " + c.company : ""})`;
      lines.push(`Cards criados (${kCreated.length}):`);
      kCreated.forEach((c) => lines.push(`• ${fmtCard(c)}`));
      lines.push(`Cards editados (${kEdited.length}):`);
      kEdited.forEach((c) => lines.push(`• ${fmtCard(c)}`));
      lines.push(`Cards concluídos/arquivados (${kDone.length}):`);
      kDone.forEach((c) => lines.push(`• ${fmtCard(c)}`));
      lines.push("");

      lines.push(`Tarefas internas concluídas (${ktDone.length}):`);
      if (!ktDone.length) lines.push("Nenhuma.");
      else {
        const sorted = [...ktDone].sort((a, b) => new Date(a.done_at).getTime() - new Date(b.done_at).getTime());
        for (const t of sorted) {
          const funnelName = funnelMap.get(t.funnel_id) || "—";
          const colName = t.column_id ? columnFunnelMap.get(t.column_id) : null;
          const ctx = colName ? `${funnelName} · ${colName}` : funnelName;
          lines.push(`• [${fmtTime(t.done_at)}] ${t.title} — ${ctx}${t.company ? " · " + t.company : ""}`);
        }
      }
      lines.push("");

      lines.push("═══ NOTAS ═══");
      if (!notes.length) lines.push("Nenhuma nota criada ou editada.");
      else for (const n of notes) {
        const created = new Date(n.created_at).getTime();
        const tag = created >= startMs && created <= endMs ? "criada" : "editada";
        lines.push(`• [${tag}] ${n.title}${n.company ? " — " + n.company : ""}`);
      }
      lines.push("");

      lines.push("═══ ARQUIVOS ═══");
      if (!files.length) lines.push("Nenhum arquivo enviado ou alterado.");
      else for (const f of files) {
        const created = new Date(f.created_at).getTime();
        const tag = created >= startMs && created <= endMs ? "enviado" : "alterado";
        lines.push(`• [${tag}] ${f.name}${f.company ? " — " + f.company : ""}`);
      }
      lines.push("");

      // Summary final
      lines.push("═══ RESUMO FINAL ═══");
      const acts: string[] = [];
      if (totalMs > 0) acts.push(`${fmtMs(totalMs)} de expediente`);
      if (sessTasks.length) acts.push(`${sessTasks.length} tarefas no ponto`);
      if (cdone.length) acts.push(`${cdone.length} checklists`);
      if (kCreated.length + kEdited.length + kDone.length) acts.push(`${kCreated.length + kEdited.length + kDone.length} ações no Kanban`);
      if (ktDone.length) acts.push(`${ktDone.length} tarefas internas`);
      lines.push(`O que foi feito: ${acts.length ? acts.join(", ") : "Sem registros no período."}`);

      // pending: tarefas com status != done na checklist (geral) e cards não concluídos
      const [pendChk, pendKan] = await Promise.all([
        applyUserCo(supabase.from("checklist_tasks")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", activeWorkspaceId)
          .neq("status", "done")
          .is("funnel_id", null)),
        applyUserCo(supabase.from("kanban_cards")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", activeWorkspaceId)
          .neq("status", "done")),
      ]);
      lines.push(`Pendências identificadas: ${pendChk.count ?? 0} checklists abertos, ${pendKan.count ?? 0} cards Kanban em andamento.`);
      lines.push(`Próximos passos sugeridos: revisar pendências, atualizar status dos cards e registrar pontos faltantes.`);

      setReport(lines.join("\n"));
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar relatório: " + (e?.message || "desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const copyReport = async () => {
    if (!report) return;
    try { await navigator.clipboard.writeText(report); toast.success("Relatório copiado"); }
    catch { toast.error("Falha ao copiar"); }
  };

  const saveReport = () => {
    if (!report) return;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift({ id: crypto.randomUUID(), date, savedAt: new Date().toISOString(), content: report });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, 50)));
      toast.success("Relatório salvo no histórico");
    } catch { toast.error("Falha ao salvar"); }
  };

  const downloadReport = (type: "txt" | "pdf" = "txt") => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${date}.${type === "pdf" ? "txt" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Relatório do Dia</DialogTitle>
          <DialogDescription>Resumo automático de pontos, checklists, Kanban, notas e arquivos.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Usuário</Label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__me">Apenas eu</SelectItem>
                <SelectItem value="__all">Todos os membros</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.display_name || m.email || m.user_id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Empresa</Label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                {companies.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Gerar relatório
          </Button>
          <Button variant="outline" onClick={copyReport} disabled={!report}><Copy className="h-4 w-4 mr-2" /> Copiar</Button>
          <Button variant="outline" onClick={saveReport} disabled={!report}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
          <Button variant="outline" onClick={() => downloadReport("txt")} disabled={!report}><Download className="h-4 w-4 mr-2" /> Baixar .txt</Button>
        </div>

        <div className="flex-1 overflow-auto rounded-lg border border-border bg-surface/40 p-4">
          {report ? (
            <pre className="text-xs sm:text-sm whitespace-pre-wrap font-mono leading-relaxed">{report}</pre>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-12">
              Clique em <span className="font-medium">Gerar relatório</span> para reunir os dados do dia selecionado.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
