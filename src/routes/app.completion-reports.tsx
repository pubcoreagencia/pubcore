import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Plus, Trash2, Save, Copy, Download, FileText, History,
  CheckCircle2, AlertTriangle, Trophy, Sparkles, X, Pencil, Search,
  ArrowLeft, Eye, Calendar as CalendarIcon, Building2, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { useChecklistCompanies } from "@/lib/checklist-companies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/completion-reports")({
  component: CompletionReportsPage,
});

type Origin = "manual" | "checklist" | "kanban" | "ponto" | "outro";
interface Execution {
  id: string;
  title: string;
  description?: string;
  company?: string;
  origin?: Origin;
}
interface ReportRow {
  id: string;
  report_date: string;
  executions: Execution[];
  bottlenecks: string;
  achievements: string;
  created_at: string;
  updated_at: string;
}

const ORIGIN_LABEL: Record<Origin, string> = {
  manual: "Manual", checklist: "Checklist", kanban: "Kanban", ponto: "Ponto", outro: "Outro",
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDatePT(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}
function fmtDateShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function uid() { return Math.random().toString(36).slice(2, 10); }

type Mode = "list" | "editor" | "visual";

function CompletionReportsPage() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const { companies } = useChecklistCompanies();
  const companyListId = "cr-company-options";

  const [mode, setMode] = useState<Mode>("list");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [bottlenecks, setBottlenecks] = useState("");
  const [achievements, setAchievements] = useState("");
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<Execution>({ id: "", title: "", description: "", company: "", origin: "manual" });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("__all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const displayName = useMemo(() => user?.name || user?.email || "—", [user]);

  const reset = () => {
    setCurrentId(null);
    setDate(today());
    setExecutions([]);
    setBottlenecks("");
    setAchievements("");
    setDraft({ id: "", title: "", description: "", company: "", origin: "manual" });
    setEditingId(null);
  };

  const loadReports = async () => {
    if (!user?.id || !activeWorkspaceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("completion_reports")
      .select("id, report_date, executions, bottlenecks, achievements, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("workspace_id", activeWorkspaceId)
      .order("report_date", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) { toast.error("Erro ao carregar histórico"); return; }
    setReports((data ?? []).map((r) => ({
      ...r,
      executions: Array.isArray(r.executions) ? (r.executions as unknown as Execution[]) : [],
    })));
  };

  useEffect(() => { loadReports(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id, activeWorkspaceId]);

  // Realtime
  useEffect(() => {
    if (!user?.id || !activeWorkspaceId) return;
    const ch = supabase
      .channel(`cr:${user.id}:${activeWorkspaceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "completion_reports", filter: `workspace_id=eq.${activeWorkspaceId}` },
        () => { loadReports(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeWorkspaceId]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (dateFrom && r.report_date < dateFrom) return false;
      if (dateTo && r.report_date > dateTo) return false;
      if (companyFilter && companyFilter !== "__all") {
        const hasCompany = (r.executions ?? []).some((e) => (e.company ?? "").toLowerCase() === companyFilter.toLowerCase());
        if (!hasCompany) return false;
      }
      if (q) {
        const hay = [
          r.report_date,
          r.bottlenecks,
          r.achievements,
          ...(r.executions ?? []).flatMap((e) => [e.title, e.description ?? "", e.company ?? ""]),
        ].join(" \n ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, search, dateFrom, dateTo, companyFilter]);

  const addExecution = () => {
    if (!draft.title.trim()) { toast.error("Informe um título"); return; }
    if (editingId) {
      setExecutions((prev) => prev.map((e) => (e.id === editingId ? { ...draft, id: editingId } : e)));
      setEditingId(null);
    } else {
      setExecutions((prev) => [...prev, { ...draft, id: uid() }]);
    }
    setDraft({ id: "", title: "", description: "", company: "", origin: "manual" });
  };
  const removeExecution = (id: string) => {
    setExecutions((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraft({ id: "", title: "", description: "", company: "", origin: "manual" });
    }
  };
  const startEditExecution = (e: Execution) => {
    setEditingId(e.id);
    setDraft({ id: e.id, title: e.title, description: e.description ?? "", company: e.company ?? "", origin: e.origin ?? "manual" });
  };
  const cancelEditExecution = () => {
    setEditingId(null);
    setDraft({ id: "", title: "", description: "", company: "", origin: "manual" });
  };

  const save = async () => {
    if (!user?.id || !activeWorkspaceId) { toast.error("Sem sessão ativa"); return; }
    if (executions.length === 0 && !bottlenecks.trim() && !achievements.trim()) {
      toast.error("Preencha ao menos um bloco do relatório"); return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      workspace_id: activeWorkspaceId,
      report_date: date,
      executions: executions as unknown as never,
      bottlenecks,
      achievements,
    };
    if (currentId) {
      const { error } = await supabase.from("completion_reports").update(payload).eq("id", currentId);
      setSaving(false);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Relatório atualizado");
    } else {
      const { data, error } = await supabase.from("completion_reports").insert(payload).select("id").single();
      setSaving(false);
      if (error) { toast.error("Erro ao salvar"); return; }
      setCurrentId(data.id);
      toast.success("Relatório salvo");
    }
    loadReports();
  };

  const startNew = () => { reset(); setMode("editor"); };
  const openReport = (r: ReportRow, target: Mode = "visual") => {
    setCurrentId(r.id);
    setDate(r.report_date);
    setExecutions(r.executions ?? []);
    setBottlenecks(r.bottlenecks ?? "");
    setAchievements(r.achievements ?? "");
    setDraft({ id: "", title: "", description: "", company: "", origin: "manual" });
    setEditingId(null);
    setMode(target);
  };
  const removeReport = async (id: string) => {
    if (!confirm("Excluir este relatório?")) return;
    const { error } = await supabase.from("completion_reports").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    if (currentId === id) reset();
    toast.success("Excluído");
    loadReports();
  };

  const buildText = (r?: { date: string; executions: Execution[]; bottlenecks: string; achievements: string }) => {
    const d = r?.date ?? date;
    const ex = r?.executions ?? executions;
    const bn = r?.bottlenecks ?? bottlenecks;
    const ach = r?.achievements ?? achievements;
    const lines: string[] = [];
    lines.push(`RELATÓRIO DE CONCLUSÃO`);
    lines.push(`Data: ${fmtDatePT(d)}`);
    lines.push(`Autor: ${displayName}`);
    lines.push("");
    lines.push(`✅ EXECUÇÕES DO DIA`);
    if (ex.length === 0) lines.push("—");
    else ex.forEach((e, i) => {
      lines.push(`${i + 1}. ${e.title}${e.company ? ` — ${e.company}` : ""}${e.origin && e.origin !== "manual" ? ` [${ORIGIN_LABEL[e.origin]}]` : ""}`);
      if (e.description) lines.push(`   ${e.description}`);
    });
    lines.push("");
    lines.push(`⚠️ GARGALOS`);
    lines.push(bn.trim() || "—");
    lines.push("");
    lines.push(`🏆 CONQUISTAS`);
    lines.push(ach.trim() || "—");
    return lines.join("\n");
  };

  const copyCurrent = async () => {
    try { await navigator.clipboard.writeText(buildText()); toast.success("Copiado"); }
    catch { toast.error("Falha ao copiar"); }
  };

  const printPDF = async () => {
    try {
      const jsPdfMod = await import("jspdf");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsPDF = (jsPdfMod as any).jsPDF || (jsPdfMod as any).default;

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 44;
      const contentW = pageW - margin * 2;
      const bg: [number, number, number] = [15, 15, 18];
      const card: [number, number, number] = [28, 28, 32];
      const border: [number, number, number] = [58, 58, 64];
      const fg: [number, number, number] = [244, 244, 245];
      const muted: [number, number, number] = [166, 166, 174];
      const primary: [number, number, number] = [221, 48, 48];
      let y = margin;

      const setText = (color: [number, number, number]) => pdf.setTextColor(color[0], color[1], color[2]);
      const fillPage = () => {
        pdf.setFillColor(bg[0], bg[1], bg[2]);
        pdf.rect(0, 0, pageW, pageH, "F");
      };
      const ensureSpace = (height: number) => {
        if (y + height <= pageH - margin) return;
        pdf.addPage();
        fillPage();
        y = margin;
      };
      const writeWrapped = (text: string, x: number, width: number, size = 10, lineHeight = 15, color = fg) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(size);
        setText(color);
        const lines = pdf.splitTextToSize(text || "—", width) as string[];
        lines.forEach((line) => {
          ensureSpace(lineHeight + 2);
          pdf.text(line, x, y);
          y += lineHeight;
        });
      };
      const sectionTitle = (title: string, color: [number, number, number]) => {
        ensureSpace(30);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        setText(color);
        pdf.text(title.toUpperCase(), margin, y);
        y += 18;
      };

      fillPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      setText(primary);
      pdf.text("PUB CORE", pageW / 2, y, { align: "center" });
      y += 24;
      pdf.setFontSize(24);
      setText(fg);
      pdf.text("Relatório de Conclusão", pageW / 2, y, { align: "center" });
      y += 20;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      setText(muted);
      pdf.text(`${fmtDatePT(date)} · ${displayName}`, pageW / 2, y, { align: "center" });
      y += 36;

      sectionTitle("Execuções do Dia", [74, 222, 128]);
      if (executions.length === 0) {
        writeWrapped("Nenhuma execução registrada.", margin, contentW, 10, 15, muted);
      } else {
        executions.forEach((execution, index) => {
          const meta = [execution.company, execution.origin && execution.origin !== "manual" ? ORIGIN_LABEL[execution.origin] : ""]
            .filter(Boolean).join(" · ");
          const titleLines = pdf.splitTextToSize(`${index + 1}. ${execution.title}`, contentW - 24) as string[];
          const descLines = execution.description ? (pdf.splitTextToSize(execution.description, contentW - 24) as string[]) : [];
          const cardH = 22 + titleLines.length * 14 + (meta ? 14 : 0) + descLines.length * 13;
          ensureSpace(cardH + 10);
          pdf.setFillColor(card[0], card[1], card[2]);
          pdf.setDrawColor(border[0], border[1], border[2]);
          pdf.roundedRect(margin, y - 12, contentW, cardH, 6, 6, "FD");
          let innerY = y + 4;
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10.5);
          setText(fg);
          titleLines.forEach((line) => { pdf.text(line, margin + 12, innerY); innerY += 14; });
          if (meta) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8.5);
            setText(primary);
            pdf.text(meta, margin + 12, innerY);
            innerY += 14;
          }
          if (descLines.length) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            setText(muted);
            descLines.forEach((line) => { pdf.text(line, margin + 12, innerY); innerY += 13; });
          }
          y += cardH + 10;
        });
      }

      y += 10;
      sectionTitle("Gargalos", [251, 191, 36]);
      writeWrapped(bottlenecks.trim() || "—", margin, contentW, 10, 15, fg);
      y += 18;
      sectionTitle("Conquistas", [250, 204, 21]);
      writeWrapped(achievements.trim() || "—", margin, contentW, 10, 15, fg);

      pdf.save(`relatorio-conclusao-${date}.pdf`);
      toast.success("PDF exportado");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Falha ao gerar PDF");
    }
  };

  const clearFilters = () => {
    setSearch(""); setCompanyFilter("__all"); setDateFrom(""); setDateTo("");
  };
  const hasFilters = !!(search || (companyFilter && companyFilter !== "__all") || dateFrom || dateTo);

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-[1400px] mx-auto pb-24 md:pb-10">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-1 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Relatórios de Conclusão
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Histórico completo dos seus relatórios diários e gerador visual.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {mode !== "list" && (
            <Button variant="outline" size="sm" onClick={() => setMode("list")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao histórico
            </Button>
          )}
          {mode === "list" && (
            <Button size="sm" onClick={startNew} className="shadow-glow">
              <Plus className="h-4 w-4 mr-1" /> Novo relatório
            </Button>
          )}
        </div>
      </header>

      {mode === "list" && (
        <section className="space-y-4">
          {/* Filters */}
          <div className="rounded-2xl border border-border bg-card/40 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros</span>
              {hasFilters && (
                <button onClick={clearFilters} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline">
                  Limpar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="md:col-span-2">
                <Label className="text-[10px] text-muted-foreground uppercase">Buscar</Label>
                <div className="relative mt-1">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Título, descrição, gargalos, conquistas…" className="h-9 pl-8" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Empresa</Label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todas</SelectItem>
                    {companies.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">De</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Até</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 mt-1" />
                </div>
              </div>
            </div>
          </div>

          {/* History cards */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Histórico ({filteredReports.length}{filteredReports.length !== reports.length ? ` de ${reports.length}` : ""})
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/20 p-10 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {reports.length === 0 ? "Nenhum relatório salvo ainda." : "Nenhum relatório corresponde aos filtros."}
              </p>
              {reports.length === 0 && (
                <Button size="sm" onClick={startNew} className="mt-4">
                  <Plus className="h-4 w-4 mr-1" /> Criar meu primeiro
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredReports.map((r) => {
                const bnPrev = (r.bottlenecks || "").trim().split("\n")[0].slice(0, 120);
                const achPrev = (r.achievements || "").trim().split("\n")[0].slice(0, 120);
                return (
                  <article key={r.id}
                    className="group rounded-2xl border border-border bg-card/50 hover:border-primary/40 hover:shadow-glow transition p-4 flex flex-col gap-3">
                    <button onClick={() => openReport(r, "visual")} className="text-left">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" /> {fmtDateShort(r.report_date)}
                          </div>
                          <div className="text-sm font-display font-semibold mt-0.5 line-clamp-1">
                            {fmtDatePT(r.report_date).replace(/^./, (c) => c.toUpperCase())}
                          </div>
                        </div>
                        <span className="text-[10px] rounded-full bg-primary/15 text-primary px-2 py-0.5 font-semibold whitespace-nowrap">
                          {r.executions.length} exec.
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 truncate">{displayName}</div>
                    </button>

                    {bnPrev && (
                      <div className="text-[11px] flex gap-1.5 items-start">
                        <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground line-clamp-2">{bnPrev}</span>
                      </div>
                    )}
                    {achPrev && (
                      <div className="text-[11px] flex gap-1.5 items-start">
                        <Trophy className="h-3 w-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground line-clamp-2">{achPrev}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 mt-auto pt-2 border-t border-border/60">
                      <Button variant="ghost" size="sm" onClick={() => openReport(r, "visual")} title="Visualizar">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openReport(r, "editor")} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={async () => { openReport(r, "visual"); setTimeout(() => printPDF(), 50); }} title="Exportar PDF">
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                      <div className="flex-1" />
                      <Button variant="ghost" size="sm" onClick={() => removeReport(r.id)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {mode === "editor" && (
        <section className="space-y-6">
          <div className="flex items-center gap-2 px-1">
            <Pencil className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {currentId ? "Editar relatório" : "Novo relatório"}
            </span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setMode("visual")}>
              <Eye className="h-4 w-4 mr-1" /> Visualizar
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {currentId ? "Atualizar" : "Salvar"}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-3">
            <div>
              <Label className="text-xs">Data do Relatório</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Autor</Label>
              <Input value={displayName} disabled className="h-9 mt-1" />
            </div>
          </div>

          <section className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h3 className="font-semibold text-sm">Execuções do Dia</h3>
              <span className="text-[10px] text-muted-foreground">({executions.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input placeholder="Título da execução"
                value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExecution(); } }} />
              <Input placeholder="Empresa (opcional)" list={companyListId}
                value={draft.company ?? ""} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
              <datalist id={companyListId}>
                {companies.map((c) => (<option key={c.id} value={c.name} />))}
              </datalist>
              <Input placeholder="Descrição curta (opcional)"
                value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <div className="flex gap-2">
                <Select value={draft.origin} onValueChange={(v) => setDraft({ ...draft, origin: v as Origin })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ORIGIN_LABEL) as Origin[]).map((o) => (
                      <SelectItem key={o} value={o}>{ORIGIN_LABEL[o]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addExecution} size="sm" className="whitespace-nowrap">
                  <Plus className="h-4 w-4 mr-1" /> {editingId ? "Salvar" : "Adicionar"}
                </Button>
                {editingId && (
                  <Button onClick={cancelEditExecution} size="sm" variant="outline">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {executions.map((e) => (
                <li key={e.id} className={`rounded-lg border p-3 flex items-start gap-3 ${editingId === e.id ? "border-primary bg-primary/10" : "border-border bg-surface/60"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {e.title}
                      {e.company && <span className="ml-2 text-[10px] text-primary">· {e.company}</span>}
                      {e.origin && e.origin !== "manual" && (
                        <span className="ml-2 text-[9px] uppercase tracking-wider bg-primary/15 text-primary rounded px-1.5 py-0.5">
                          {ORIGIN_LABEL[e.origin]}
                        </span>
                      )}
                    </div>
                    {e.description && <div className="text-xs text-muted-foreground mt-0.5">{e.description}</div>}
                  </div>
                  <button onClick={() => startEditExecution(e)} className="text-muted-foreground hover:text-primary p-1" title="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeExecution(e.id)} className="text-muted-foreground hover:text-destructive p-1" title="Remover">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {executions.length === 0 && (
                <li className="text-xs text-muted-foreground italic">Nenhuma execução adicionada ainda.</li>
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h3 className="font-semibold text-sm">Gargalos</h3>
            </div>
            <Textarea rows={5} value={bottlenecks} onChange={(e) => setBottlenecks(e.target.value)}
              placeholder="Escreva livremente as travas, dificuldades ou percepções do dia..." />
          </section>

          <section className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <h3 className="font-semibold text-sm">Conquistas</h3>
            </div>
            <Textarea rows={5} value={achievements} onChange={(e) => setAchievements(e.target.value)}
              placeholder="Registre avanços, aprendizados ou entregas importantes..." />
          </section>
        </section>
      )}

      {mode === "visual" && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap px-1">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visualização</span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setMode("editor")}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
            <Button variant="outline" size="sm" onClick={copyCurrent}>
              <Copy className="h-4 w-4 mr-1" /> Copiar texto
            </Button>
            <Button variant="outline" size="sm" onClick={printPDF}>
              <FileText className="h-4 w-4 mr-1" /> Exportar PDF
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {currentId ? "Atualizar" : "Salvar"}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">PUB CORE</div>
              <h1 className="font-display text-2xl sm:text-3xl mt-1">Relatório de Conclusão</h1>
              <div className="text-xs text-muted-foreground mt-1">{fmtDatePT(date)} · {displayName}</div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <h3 className="font-semibold text-sm uppercase tracking-wider">Execuções do Dia</h3>
              </div>
              {executions.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Nenhuma execução registrada.</div>
              ) : (
                <ol className="space-y-2">
                  {executions.map((e, i) => (
                    <li key={e.id} className="rounded-lg pl-3 py-2 border-l-2 border-primary bg-primary/5">
                      <div className="text-sm font-medium">
                        {i + 1}. {e.title}
                        {e.company && <span className="ml-2 text-[10px] text-primary">· {e.company}</span>}
                        {e.origin && e.origin !== "manual" && (
                          <span className="ml-2 text-[9px] bg-muted rounded px-1.5 py-0.5">{ORIGIN_LABEL[e.origin]}</span>
                        )}
                      </div>
                      {e.description && <div className="text-xs text-muted-foreground mt-0.5">{e.description}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h3 className="font-semibold text-sm uppercase tracking-wider">Gargalos</h3>
                </div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                  {bottlenecks.trim() || "—"}
                </pre>
              </div>
              <div className="rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  <h3 className="font-semibold text-sm uppercase tracking-wider">Conquistas</h3>
                </div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                  {achievements.trim() || "—"}
                </pre>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
