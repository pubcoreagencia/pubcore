import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Plus, Trash2, Save, Copy, Download, FileText, History,
  CheckCircle2, AlertTriangle, Trophy, Sparkles, X, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { useChecklistCompanies } from "@/lib/checklist-companies";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

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
function uid() { return Math.random().toString(36).slice(2, 10); }

const ORIGIN_LABEL: Record<Origin, string> = {
  manual: "Manual", checklist: "Checklist", kanban: "Kanban", ponto: "Ponto", outro: "Outro",
};

export function CompletionReportDialog({ open, onOpenChange }: Props) {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();

  const [tab, setTab] = useState<"editor" | "visual" | "history">("editor");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [bottlenecks, setBottlenecks] = useState("");
  const [achievements, setAchievements] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ReportRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const visualRef = useRef<HTMLDivElement | null>(null);
  const { companies } = useChecklistCompanies();
  const companyListId = "completion-report-company-options";

  // Draft
  const [draft, setDraft] = useState<Execution>({ id: "", title: "", description: "", company: "", origin: "manual" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const displayName = useMemo(() => user?.name || user?.email || "—", [user]);

  const reset = () => {
    setCurrentId(null);
    setDate(today());
    setExecutions([]);
    setBottlenecks("");
    setAchievements("");
    setDraft({ id: "", title: "", description: "", company: "", origin: "manual" });
    setEditingId(null);
    setTab("editor");
  };


  useEffect(() => {
    if (open) {
      reset();
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeWorkspaceId, user?.id]);

  async function loadHistory() {
    if (!user?.id || !activeWorkspaceId) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("completion_reports")
      .select("id, report_date, executions, bottlenecks, achievements, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("workspace_id", activeWorkspaceId)
      .order("report_date", { ascending: false })
      .limit(100);
    setLoadingHistory(false);
    if (error) { toast.error("Erro ao carregar histórico"); return; }
    setHistory((data ?? []).map((r) => ({
      ...r,
      executions: Array.isArray(r.executions) ? (r.executions as unknown as Execution[]) : [],
    })));
  }

  const addExecution = () => {
    if (!draft.title.trim()) { toast.error("Informe um título para a execução"); return; }
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


  async function save() {
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
    loadHistory();
  }

  function loadReport(r: ReportRow) {
    setCurrentId(r.id);
    setDate(r.report_date);
    setExecutions(r.executions ?? []);
    setBottlenecks(r.bottlenecks ?? "");
    setAchievements(r.achievements ?? "");
    setTab("editor");
  }

  async function removeReport(id: string) {
    if (!confirm("Excluir este relatório?")) return;
    const { error } = await supabase.from("completion_reports").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    if (currentId === id) reset();
    toast.success("Excluído");
    loadHistory();
  }

  function buildText() {
    const lines: string[] = [];
    lines.push(`RELATÓRIO DE CONCLUSÃO`);
    lines.push(`Data: ${fmtDatePT(date)}`);
    lines.push(`Autor: ${displayName}`);
    lines.push("");
    lines.push(`✅ EXECUÇÕES DO DIA`);
    if (executions.length === 0) lines.push("—");
    else executions.forEach((e, i) => {
      lines.push(`${i + 1}. ${e.title}${e.company ? ` — ${e.company}` : ""}${e.origin && e.origin !== "manual" ? ` [${ORIGIN_LABEL[e.origin]}]` : ""}`);
      if (e.description) lines.push(`   ${e.description}`);
    });
    lines.push("");
    lines.push(`⚠️ GARGALOS`);
    lines.push(bottlenecks.trim() || "—");
    lines.push("");
    lines.push(`🏆 CONQUISTAS`);
    lines.push(achievements.trim() || "—");
    return lines.join("\n");
  }

  async function copy() {
    try { await navigator.clipboard.writeText(buildText()); toast.success("Copiado"); }
    catch { toast.error("Falha ao copiar"); }
  }

  function download() {
    const blob = new Blob([buildText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-conclusao-${date}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  async function printPDF() {
    // Ensure the visual tab is rendered
    if (tab !== "visual") {
      setTab("visual");
      await new Promise((r) => setTimeout(r, 250));
    }
    const el = visualRef.current;
    if (!el) { toast.error("Nada para exportar"); return; }
    try {
      const [{ default: html2canvas }, jsPdfMod] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const jsPDF = (jsPdfMod as any).jsPDF || (jsPdfMod as any).default;

      // Resolve current theme background so the capture matches the site look
      const bodyBg = getComputedStyle(document.body).backgroundColor || "#0b0b10";

      const canvas = await html2canvas(el, {
        backgroundColor: bodyBg,
        scale: 2,
        useCORS: true,
        windowWidth: el.scrollWidth,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const contentW = pageW - margin * 2;
      const ratio = contentW / canvas.width;
      const fullH = canvas.height * ratio;

      // Fill page background to match theme
      pdf.setFillColor(bodyBg);
      pdf.rect(0, 0, pageW, pageH, "F");

      if (fullH <= pageH - margin * 2) {
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", margin, margin, contentW, fullH);
      } else {
        // Slice canvas into page-sized chunks
        const pageContentH = pageH - margin * 2;
        const sliceHpx = Math.floor(pageContentH / ratio);
        let y = 0;
        let first = true;
        while (y < canvas.height) {
          const h = Math.min(sliceHpx, canvas.height - y);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = h;
          const ctx = pageCanvas.getContext("2d");
          if (!ctx) break;
          ctx.fillStyle = bodyBg;
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
          const imgData = pageCanvas.toDataURL("image/png");
          if (!first) {
            pdf.addPage();
            pdf.setFillColor(bodyBg);
            pdf.rect(0, 0, pageW, pageH, "F");
          }
          pdf.addImage(imgData, "PNG", margin, margin, contentW, h * ratio);
          first = false;
          y += h;
        }
      }
      pdf.save(`relatorio-conclusao-${date}.pdf`);
      toast.success("PDF exportado");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao gerar PDF");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Relatório de Conclusão
          </DialogTitle>
          <DialogDescription className="text-xs">
            Registre manualmente as execuções, gargalos e conquistas do seu dia.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 px-4 pt-3 border-b border-border">
          {(["editor", "visual", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition ${
                tab === t ? "bg-primary/15 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "editor" ? "Editor" : t === "visual" ? "Visual" : "Histórico"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "editor" && (
            <div className="space-y-6">
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

              {/* Execuções */}
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
                  <Input placeholder="Empresa (opcional) — escolha ou digite"
                    list={companyListId}
                    value={draft.company ?? ""} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
                  <datalist id={companyListId}>
                    {companies.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                  <Input className="md:col-span-1" placeholder="Descrição curta (opcional)"
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
                      <Button onClick={cancelEditExecution} size="sm" variant="outline" className="whitespace-nowrap">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>


                <ul className="mt-4 space-y-2">
                  {executions.map((e) => (
                    <li key={e.id} className="rounded-lg border border-border bg-surface/60 p-3 flex items-start gap-3">
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
                      <button onClick={() => removeExecution(e.id)}
                        className="text-muted-foreground hover:text-destructive p-1" title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                  {executions.length === 0 && (
                    <li className="text-xs text-muted-foreground italic">Nenhuma execução adicionada ainda.</li>
                  )}
                </ul>
              </section>

              {/* Gargalos */}
              <section className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h3 className="font-semibold text-sm">Gargalos</h3>
                </div>
                <Textarea rows={5} value={bottlenecks} onChange={(e) => setBottlenecks(e.target.value)}
                  placeholder="Escreva livremente as travas, dificuldades ou percepções do dia..." />
              </section>

              {/* Conquistas */}
              <section className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  <h3 className="font-semibold text-sm">Conquistas</h3>
                </div>
                <Textarea rows={5} value={achievements} onChange={(e) => setAchievements(e.target.value)}
                  placeholder="Registre avanços, aprendizados ou entregas importantes..." />
              </section>
            </div>
          )}

          {tab === "visual" && (
            <div ref={visualRef} className="r">
              <div className="text-center mb-6">
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">PUB CORE</div>
                <h1 className="font-display text-2xl sm:text-3xl mt-1">Relatório de Conclusão</h1>
                <div className="muted text-xs text-muted-foreground mt-1">{fmtDatePT(date)} · {displayName}</div>
              </div>

              <div className="card rounded-2xl border border-border bg-card/60 p-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-semibold text-sm uppercase tracking-wider">Execuções do Dia</h3>
                </div>
                {executions.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">Nenhuma execução registrada.</div>
                ) : (
                  <ol className="space-y-2">
                    {executions.map((e, i) => (
                      <li key={e.id} className="exec rounded-lg pl-3 py-2 border-l-2 border-primary bg-primary/5">
                        <div className="text-sm font-medium">
                          {i + 1}. {e.title}
                          {e.company && <span className="ml-2 text-[10px] text-primary">· {e.company}</span>}
                          {e.origin && e.origin !== "manual" && (
                            <span className="badge ml-2 text-[9px] bg-muted rounded px-1.5 py-0.5">{ORIGIN_LABEL[e.origin]}</span>
                          )}
                        </div>
                        {e.description && <div className="text-xs text-muted-foreground mt-0.5">{e.description}</div>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card rounded-2xl border border-border bg-card/60 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h3 className="font-semibold text-sm uppercase tracking-wider">Gargalos</h3>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                    {bottlenecks.trim() || "—"}
                  </pre>
                </div>
                <div className="card rounded-2xl border border-border bg-card/60 p-5">
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
          )}

          {tab === "history" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Relatórios Anteriores</h3>
              </div>
              {loadingHistory && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Carregando...</div>}
              {!loadingHistory && history.length === 0 && (
                <div className="text-xs text-muted-foreground italic">Nenhum relatório salvo ainda.</div>
              )}
              <ul className="space-y-2">
                {history.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border bg-card/40 p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{fmtDatePT(r.report_date)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.executions.length} execuç{r.executions.length === 1 ? "ão" : "ões"}
                        {r.bottlenecks ? " · Gargalos" : ""}
                        {r.achievements ? " · Conquistas" : ""}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => loadReport(r)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeReport(r.id)} title="Excluir">
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex flex-wrap items-center gap-2 justify-end">
          {tab === "editor" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setTab("visual")}>
                <FileText className="h-4 w-4 mr-1" /> Gerar Relatório Visual
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {currentId ? "Atualizar" : "Salvar"}
              </Button>
            </>
          )}
          {tab === "visual" && (
            <>
              <Button variant="outline" size="sm" onClick={copy}><Copy className="h-4 w-4 mr-1" /> Copiar texto</Button>
              <Button variant="outline" size="sm" onClick={download}><Download className="h-4 w-4 mr-1" /> .txt</Button>
              <Button variant="outline" size="sm" onClick={printPDF}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {currentId ? "Atualizar" : "Salvar"}
              </Button>
            </>
          )}
          {tab === "history" && (
            <Button variant="outline" size="sm" onClick={() => { reset(); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo relatório
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
