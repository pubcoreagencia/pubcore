import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp, Calendar as CalendarIcon, Sparkles, Plus, Search, Filter,
  Flame, Target, Briefcase, AlertCircle, Trash2, Pencil, ExternalLink,
  ListChecks, KanbanSquare, CalendarPlus, RefreshCw, X, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { useChecklistCompanies } from "@/lib/checklist-companies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/trends")({
  component: TrendsPage,
});

// ============== Types ==============
type Seasonality = {
  id: string;
  workspace_id: string;
  name: string;
  event_date: string | null;
  recurring_month: number | null;
  recurring_day: number | null;
  category: string;
  description: string | null;
  opportunity: string | null;
  company: string | null;
  priority: "low" | "medium" | "high";
  status: "idea" | "plan" | "producing" | "ready" | "published" | "archived";
  notes: string | null;
  ideas: string[];
  checklist: { text: string; done: boolean }[];
  assignee: string | null;
};

type Hype = {
  id: string;
  workspace_id: string;
  term: string;
  description: string | null;
  region: string;
  period: string;
  category: string | null;
  source: string;
  growth: number | null;
  related_terms: string[];
  status: "monitor" | "content" | "product" | "campaign" | "executing" | "archived";
  priority: "low" | "medium" | "high";
  company: string | null;
  notes: string | null;
  external_url: string | null;
};

type Opportunity = {
  id: string;
  workspace_id: string;
  title: string;
  reason: string | null;
  source_kind: string | null;
  source_id: string | null;
  company: string | null;
  status: "monitor" | "content" | "product" | "campaign" | "executing" | "archived";
  priority: "low" | "medium" | "high";
  assignee: string | null;
  notes: string | null;
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const STATUS_SEASON = [
  { v: "idea", l: "Ideia" }, { v: "plan", l: "Planejar" }, { v: "producing", l: "Em produção" },
  { v: "ready", l: "Pronto" }, { v: "published", l: "Publicado" }, { v: "archived", l: "Arquivado" },
] as const;
const STATUS_OPP = [
  { v: "monitor", l: "Monitorar" }, { v: "content", l: "Criar Conteúdo" }, { v: "product", l: "Criar Produto" },
  { v: "campaign", l: "Criar Campanha" }, { v: "executing", l: "Em Execução" }, { v: "archived", l: "Arquivado" },
] as const;
const PRIORITY = [
  { v: "low", l: "Baixa" }, { v: "medium", l: "Média" }, { v: "high", l: "Alta" },
] as const;
const CATEGORIES = ["Comemorativa", "Feriado", "Cultural", "E-commerce", "Sazonal", "Comercial", "Nicho", "Causa"];

function priColor(p: string) {
  return p === "high" ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
    : p === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
}
function statusColor(s: string) {
  if (s === "published" || s === "executing") return "text-emerald-400 bg-emerald-500/10";
  if (s === "ready" || s === "campaign") return "text-sky-400 bg-sky-500/10";
  if (s === "producing" || s === "product") return "text-violet-400 bg-violet-500/10";
  if (s === "plan" || s === "content") return "text-amber-400 bg-amber-500/10";
  if (s === "archived") return "text-muted-foreground bg-muted/40";
  return "text-slate-400 bg-slate-500/10";
}

function nextOccurrence(s: Seasonality): Date | null {
  if (s.event_date) return new Date(s.event_date + "T00:00:00");
  if (s.recurring_month && s.recurring_day) {
    const now = new Date();
    let y = now.getFullYear();
    const d = new Date(y, s.recurring_month - 1, s.recurring_day);
    if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      d.setFullYear(y + 1);
    }
    return d;
  }
  if (s.recurring_month) return new Date(new Date().getFullYear(), s.recurring_month - 1, 1);
  return null;
}
function daysUntil(d: Date) {
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ============== Page ==============
function TrendsPage() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { companies } = useChecklistCompanies();
  const [seasonalities, setSeasonalities] = useState<Seasonality[]>([]);
  const [hypes, setHypes] = useState<Hype[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"seasons" | "hype" | "opps">("seasons");

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const [s, h, o] = await Promise.all([
      (supabase as any).from("trends_seasonalities").select("*").eq("workspace_id", activeWorkspaceId).order("recurring_month", { ascending: true, nullsFirst: false }),
      (supabase as any).from("trends_hype").select("*").eq("workspace_id", activeWorkspaceId).order("updated_at", { ascending: false }),
      (supabase as any).from("trends_opportunities").select("*").eq("workspace_id", activeWorkspaceId).order("updated_at", { ascending: false }),
    ]);
    setSeasonalities((s.data ?? []) as Seasonality[]);
    setHypes((h.data ?? []) as Hype[]);
    setOpps((o.data ?? []) as Opportunity[]);
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => { load(); }, [load]);

  const seedDates = async () => {
    if (!activeWorkspaceId) return;
    const { data, error } = await (supabase as any).rpc("seed_trends_seasonalities", { _workspace_id: activeWorkspaceId });
    if (error) { toast.error("Falha ao semear datas: " + error.message); return; }
    toast.success(`${data ?? 0} datas adicionadas.`);
    load();
  };

  // ============== Dashboard metrics ==============
  const enriched = useMemo(() => seasonalities.map(s => ({ ...s, _next: nextOccurrence(s) })), [seasonalities]);
  const upcoming = useMemo(() =>
    enriched.filter(s => s._next).sort((a, b) => (a._next!.getTime() - b._next!.getTime())).slice(0, 6),
  [enriched]);
  const highPrio = useMemo(() => enriched.filter(s => s.priority === "high" && s.status !== "archived").length, [enriched]);
  const inProd = useMemo(() => enriched.filter(s => s.status === "producing" || s.status === "plan").length, [enriched]);
  const oppsOpen = useMemo(() => opps.filter(o => o.status !== "archived").length, [opps]);
  const topHype = useMemo(() =>
    [...hypes].sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0], [hypes]);

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-7xl mx-auto w-full pb-24 md:pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 ring-1 ring-violet-400/30">
            <TrendingUp className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-light tracking-tight">Painel de Tendências</h1>
            <p className="text-sm text-muted-foreground">Antecipe sazonalidades, monitore hypes, gere oportunidades.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {seasonalities.length === 0 && (
            <Button size="sm" onClick={seedDates}>
              <Sparkles className="h-4 w-4 mr-1.5" /> Semear datas BR
            </Button>
          )}
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard icon={CalendarIcon} label="Datas próximas" value={upcoming.length} hint={upcoming[0]?._next ? fmtDate(upcoming[0]._next!) : "—"} tint="sky" />
        <MetricCard icon={Flame} label="Prioridades altas" value={highPrio} hint="sazonalidades" tint="rose" />
        <MetricCard icon={Target} label="Oportunidades" value={oppsOpen} hint="abertas" tint="violet" />
        <MetricCard icon={Briefcase} label="Em produção" value={inProd} hint="campanhas" tint="amber" />
      </div>

      {topHype && (
        <div className="mb-6 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-sky-500/5 p-4 flex items-center gap-3">
          <Flame className="h-5 w-5 text-rose-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Tendência em destaque</div>
            <div className="font-medium truncate">{topHype.term}</div>
          </div>
          {topHype.growth != null && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/40">+{topHype.growth}%</Badge>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="seasons"><CalendarIcon className="h-4 w-4 mr-1.5" /> Sazonalidades</TabsTrigger>
          <TabsTrigger value="hype"><Flame className="h-4 w-4 mr-1.5" /> Hype</TabsTrigger>
          <TabsTrigger value="opps"><Target className="h-4 w-4 mr-1.5" /> Oportunidades</TabsTrigger>
        </TabsList>

        <TabsContent value="seasons">
          <SeasonsPanel
            items={enriched}
            companies={companies.map(c => c.name)}
            onReload={load}
            workspaceId={activeWorkspaceId}
            userId={user?.id ?? null}
            userEmail={user?.email ?? ""}
          />
        </TabsContent>

        <TabsContent value="hype">
          <HypePanel
            items={hypes}
            companies={companies.map(c => c.name)}
            onReload={load}
            workspaceId={activeWorkspaceId}
            userId={user?.id ?? null}
            userEmail={user?.email ?? ""}
          />
        </TabsContent>

        <TabsContent value="opps">
          <OppsPanel
            items={opps}
            companies={companies.map(c => c.name)}
            onReload={load}
            workspaceId={activeWorkspaceId}
            userId={user?.id ?? null}
            userEmail={user?.email ?? ""}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== Metric Card ==============
function MetricCard({ icon: Icon, label, value, hint, tint }: { icon: any; label: string; value: number | string; hint?: string; tint: "sky" | "rose" | "violet" | "amber" }) {
  const colors: Record<string, string> = {
    sky: "from-sky-500/15 to-sky-500/5 ring-sky-400/20 text-sky-300",
    rose: "from-rose-500/15 to-rose-500/5 ring-rose-400/20 text-rose-300",
    violet: "from-violet-500/15 to-violet-500/5 ring-violet-400/20 text-violet-300",
    amber: "from-amber-500/15 to-amber-500/5 ring-amber-400/20 text-amber-300",
  };
  return (
    <div className={`rounded-2xl p-4 border border-border/40 bg-gradient-to-br ring-1 ${colors[tint]}`}>
      <div className="flex items-center gap-2 mb-2"><Icon className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span></div>
      <div className="text-2xl font-light">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

// ============== Seasons ==============
function SeasonsPanel({ items, companies, onReload, workspaceId, userId, userEmail }: {
  items: (Seasonality & { _next: Date | null })[]; companies: string[]; onReload: () => void;
  workspaceId: string | null; userId: string | null; userEmail: string;
}) {
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [view, setView] = useState<"cards" | "list" | "calendar">("cards");
  const [editing, setEditing] = useState<Seasonality | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    return items.filter(s => {
      if (q && !`${s.name} ${s.description ?? ""} ${s.opportunity ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (monthFilter !== "all") {
        const m = s._next ? s._next.getMonth() + 1 : s.recurring_month;
        if (String(m) !== monthFilter) return false;
      }
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (companyFilter !== "all" && s.company !== companyFilter) return false;
      return true;
    }).sort((a, b) => {
      if (!a._next && !b._next) return 0;
      if (!a._next) return 1;
      if (!b._next) return -1;
      return a._next.getTime() - b._next.getTime();
    });
  }, [items, q, monthFilter, statusFilter, companyFilter]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar sazonalidade..." className="pl-8 h-9" />
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="h-9 w-[120px]"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos meses</SelectItem>
            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {STATUS_SEASON.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border/40 p-0.5">
          {(["cards", "list", "calendar"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 text-xs rounded-md transition ${view === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {v === "cards" ? "Cards" : v === "list" ? "Lista" : "Calendário"}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
          Nenhuma sazonalidade encontrada. Use “Semear datas BR” acima ou crie uma nova.
        </div>
      )}

      {view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => <SeasonCard key={s.id} s={s} onEdit={() => setEditing(s)} />)}
        </div>
      )}

      {view === "list" && (
        <div className="rounded-2xl border border-border/40 bg-card/30 divide-y divide-border/40 overflow-hidden">
          {filtered.map(s => (
            <button key={s.id} onClick={() => setEditing(s)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition text-left">
              <div className="w-12 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">{s._next ? MONTHS[s._next.getMonth()] : "—"}</div>
                <div className="text-lg font-light">{s._next ? s._next.getDate() : "—"}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground truncate">{s.opportunity || s.description || s.category}</div>
              </div>
              <Badge variant="outline" className={priColor(s.priority)}>{PRIORITY.find(p => p.v === s.priority)?.l}</Badge>
              <Badge variant="outline" className={statusColor(s.status)}>{STATUS_SEASON.find(x => x.v === s.status)?.l}</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {view === "calendar" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MONTHS.map((mn, i) => {
            const ofMonth = filtered.filter(s => (s._next ? s._next.getMonth() : (s.recurring_month ?? 0) - 1) === i);
            return (
              <div key={i} className="rounded-2xl border border-border/40 bg-card/30 p-3">
                <div className="text-sm font-medium mb-2 text-muted-foreground">{mn}</div>
                {ofMonth.length === 0 ? <div className="text-xs text-muted-foreground/60">—</div> :
                  <div className="space-y-1.5">
                    {ofMonth.map(s => (
                      <button key={s.id} onClick={() => setEditing(s)} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/30 transition">
                        <div className={`h-2 w-2 rounded-full ${s.priority === "high" ? "bg-rose-400" : s.priority === "medium" ? "bg-amber-400" : "bg-emerald-400"}`} />
                        <span className="text-xs truncate flex-1">{s.name}</span>
                        {s._next && <span className="text-[10px] text-muted-foreground">{s._next.getDate()}</span>}
                      </button>
                    ))}
                  </div>
                }
              </div>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <SeasonDialog
          seasonality={editing}
          companies={companies}
          workspaceId={workspaceId}
          userId={userId}
          userEmail={userEmail}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); onReload(); }}
        />
      )}
    </div>
  );
}

function SeasonCard({ s, onEdit }: { s: Seasonality & { _next: Date | null }; onEdit: () => void }) {
  const d = s._next;
  const days = d ? daysUntil(d) : null;
  return (
    <button onClick={onEdit} className="text-left rounded-2xl border border-border/40 bg-card/40 hover:bg-card/60 p-4 transition group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="text-center px-2.5 py-1.5 rounded-lg bg-secondary/60 min-w-[52px]">
            <div className="text-[10px] uppercase text-muted-foreground leading-tight">{d ? MONTHS[d.getMonth()] : "—"}</div>
            <div className="text-base font-medium leading-tight">{d ? d.getDate() : "—"}</div>
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate group-hover:text-primary transition">{s.name}</div>
            <div className="text-[11px] text-muted-foreground">{s.category}{days != null && days >= 0 ? ` · ${days === 0 ? "hoje" : `em ${days}d`}` : ""}</div>
          </div>
        </div>
        <Badge variant="outline" className={`${priColor(s.priority)} text-[10px]`}>{PRIORITY.find(p => p.v === s.priority)?.l}</Badge>
      </div>
      {s.opportunity && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{s.opportunity}</p>}
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className={`${statusColor(s.status)} text-[10px]`}>{STATUS_SEASON.find(x => x.v === s.status)?.l}</Badge>
        {s.company && <span className="text-[10px] text-muted-foreground truncate">{s.company}</span>}
      </div>
    </button>
  );
}

// ============== Season Dialog ==============
function SeasonDialog({ seasonality, companies, workspaceId, userId, userEmail, onClose, onSaved }: {
  seasonality: Seasonality | null; companies: string[]; workspaceId: string | null; userId: string | null; userEmail: string;
  onClose: () => void; onSaved: () => void;
}) {
  const isNew = !seasonality;
  const [form, setForm] = useState<Partial<Seasonality>>(() => seasonality ?? {
    name: "", category: "Comemorativa", priority: "medium", status: "idea",
    ideas: [], checklist: [], event_date: null, recurring_month: null, recurring_day: null,
  });
  const [newIdea, setNewIdea] = useState("");
  const [newTask, setNewTask] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!workspaceId || !form.name) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload = {
      workspace_id: workspaceId,
      user_id: userId,
      owner_email: userEmail,
      name: form.name,
      event_date: form.event_date || null,
      recurring_month: form.recurring_month || null,
      recurring_day: form.recurring_day || null,
      category: form.category ?? "Comemorativa",
      description: form.description ?? null,
      opportunity: form.opportunity ?? null,
      company: form.company ?? null,
      priority: form.priority ?? "medium",
      status: form.status ?? "idea",
      notes: form.notes ?? null,
      ideas: form.ideas ?? [],
      checklist: form.checklist ?? [],
      assignee: form.assignee ?? null,
    };
    const op = isNew
      ? (supabase as any).from("trends_seasonalities").insert(payload)
      : (supabase as any).from("trends_seasonalities").update(payload).eq("id", seasonality!.id);
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "Sazonalidade criada" : "Atualizada");
    onSaved();
  };

  const remove = async () => {
    if (!seasonality) return;
    if (!confirm(`Excluir "${seasonality.name}"?`)) return;
    const { error } = await (supabase as any).from("trends_seasonalities").delete().eq("id", seasonality.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída");
    onSaved();
  };

  // Integrations
  const createTask = async () => {
    if (!workspaceId || !form.name) return;
    const company = form.company || companies[0] || "Geral";
    const { error } = await (supabase as any).from("checklist_tasks").insert({
      workspace_id: workspaceId, user_id: userId, owner_email: userEmail,
      company, title: form.name, description: form.opportunity || form.description || null,
      priority: form.priority === "high" ? "high" : form.priority === "low" ? "low" : "medium",
      due_date: form.event_date || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Tarefa criada no Centro Operacional");
  };
  const createCard = async () => {
    if (!workspaceId || !form.name) return;
    const company = form.company || companies[0] || "Geral";
    const { error } = await (supabase as any).from("kanban_cards").insert({
      workspace_id: workspaceId, user_id: userId, owner_email: userEmail,
      title: form.name, description: form.opportunity || form.description || null, company,
      priority: form.priority === "high" ? "Alta" : form.priority === "low" ? "Baixa" : "Média",
      due_date: form.event_date || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Card criado no Kanban");
  };
  const createEvent = async () => {
    if (!workspaceId || !form.name || !userId) return;
    const date = form.event_date || (form.recurring_month && form.recurring_day
      ? `${new Date().getFullYear()}-${String(form.recurring_month).padStart(2,"0")}-${String(form.recurring_day).padStart(2,"0")}`
      : null);
    if (!date) { toast.error("Defina uma data antes"); return; }
    const { error } = await (supabase as any).from("calendar_events").insert({
      workspace_id: workspaceId, user_id: userId,
      title: form.name, type: "Campanha", company: form.company || null,
      event_date: date, notes: form.opportunity || form.description || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Evento criado no Calendário");
  };
  const createOpp = async () => {
    if (!workspaceId || !form.name) return;
    const { error } = await (supabase as any).from("trends_opportunities").insert({
      workspace_id: workspaceId, user_id: userId, owner_email: userEmail,
      title: form.name, reason: form.opportunity || form.description || null,
      source_kind: "seasonality", source_id: seasonality?.id ?? null,
      company: form.company || null, priority: form.priority || "medium",
      status: "monitor",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Oportunidade registrada");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova sazonalidade" : "Editar sazonalidade"}</DialogTitle>
          <DialogDescription>Configure datas, oportunidades e ações estratégicas.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Dia das Mães" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data fixa</Label>
              <Input type="date" value={form.event_date ?? ""} onChange={e => setForm({ ...form, event_date: e.target.value || null })} />
            </div>
            <div>
              <Label>OU mês/dia recorrente</Label>
              <div className="flex gap-1">
                <Input type="number" min={1} max={12} placeholder="Mês" value={form.recurring_month ?? ""} onChange={e => setForm({ ...form, recurring_month: e.target.value ? Number(e.target.value) : null })} />
                <Input type="number" min={1} max={31} placeholder="Dia" value={form.recurring_day ?? ""} onChange={e => setForm({ ...form, recurring_day: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category ?? "Comemorativa"} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={form.company ?? "_none"} onValueChange={v => setForm({ ...form, company: v === "_none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority ?? "medium"} onValueChange={v => setForm({ ...form, priority: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "idea"} onValueChange={v => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_SEASON.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Oportunidade comercial</Label>
            <Textarea rows={2} value={form.opportunity ?? ""} onChange={e => setForm({ ...form, opportunity: e.target.value })} placeholder="O que essa data viabiliza?" />
          </div>

          <div>
            <Label>Ideias de ação</Label>
            <div className="space-y-1.5 mb-2">
              {(form.ideas ?? []).map((idea, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/40">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                  <span className="text-sm flex-1">{idea}</span>
                  <button onClick={() => setForm({ ...form, ideas: (form.ideas ?? []).filter((_, j) => j !== i) })}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newIdea} onChange={e => setNewIdea(e.target.value)} placeholder="Nova ideia..." onKeyDown={e => { if (e.key === "Enter" && newIdea.trim()) { setForm({ ...form, ideas: [...(form.ideas ?? []), newIdea.trim()] }); setNewIdea(""); } }} />
              <Button type="button" variant="outline" onClick={() => { if (newIdea.trim()) { setForm({ ...form, ideas: [...(form.ideas ?? []), newIdea.trim()] }); setNewIdea(""); } }}>+</Button>
            </div>
          </div>

          <div>
            <Label>Checklist de ações</Label>
            <div className="space-y-1.5 mb-2">
              {(form.checklist ?? []).map((c, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/40">
                  <input type="checkbox" checked={c.done} onChange={e => {
                    const next = [...(form.checklist ?? [])]; next[i] = { ...c, done: e.target.checked }; setForm({ ...form, checklist: next });
                  }} />
                  <span className={`text-sm flex-1 ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                  <button onClick={() => setForm({ ...form, checklist: (form.checklist ?? []).filter((_, j) => j !== i) })}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Nova ação..." onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) { setForm({ ...form, checklist: [...(form.checklist ?? []), { text: newTask.trim(), done: false }] }); setNewTask(""); } }} />
              <Button type="button" variant="outline" onClick={() => { if (newTask.trim()) { setForm({ ...form, checklist: [...(form.checklist ?? []), { text: newTask.trim(), done: false }] }); setNewTask(""); } }}>+</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsável</Label>
              <Input value={form.assignee ?? ""} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="Nome do responsável" />
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          {!isNew && (
            <div className="rounded-xl border border-border/40 bg-secondary/30 p-3">
              <div className="text-xs uppercase text-muted-foreground tracking-wider mb-2">Gerar ação em…</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={createTask}><ListChecks className="h-3.5 w-3.5 mr-1" /> Checklist</Button>
                <Button type="button" size="sm" variant="outline" onClick={createCard}><KanbanSquare className="h-3.5 w-3.5 mr-1" /> Kanban</Button>
                <Button type="button" size="sm" variant="outline" onClick={createEvent}><CalendarPlus className="h-3.5 w-3.5 mr-1" /> Calendário</Button>
                <Button type="button" size="sm" variant="outline" onClick={createOpp}><Target className="h-3.5 w-3.5 mr-1" /> Oportunidade</Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center !justify-between gap-2 flex-wrap">
          {!isNew ? (
            <Button variant="ghost" size="sm" onClick={remove} className="text-rose-400 hover:text-rose-300">
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Hype Panel ==============
function HypePanel({ items, companies, onReload, workspaceId, userId, userEmail }: {
  items: Hype[]; companies: string[]; onReload: () => void;
  workspaceId: string | null; userId: string | null; userEmail: string;
}) {
  const [editing, setEditing] = useState<Hype | null>(null);
  const [creating, setCreating] = useState(false);
  const [trendsTerm, setTrendsTerm] = useState("impressão 3D");
  const [trendsQuery, setTrendsQuery] = useState("impressão 3D");

  const sorted = useMemo(() => [...items].sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0)), [items]);

  // Google Trends embed (iframe). URL pattern is officially documented.
  // ⚠️ Para conectar uma fonte real (API/scraper), substitua esta seção pela
  //    integração via server function. A UI de salvar/comparar já está pronta.
  const trendsEmbedUrl = useMemo(() => {
    const q = encodeURIComponent(trendsQuery);
    return `https://trends.google.com/trends/embed/explore/TIMESERIES?req=%7B%22comparisonItem%22%3A%5B%7B%22keyword%22%3A%22${q}%22%2C%22geo%22%3A%22BR%22%2C%22time%22%3A%22today+12-m%22%7D%5D%2C%22category%22%3A0%2C%22property%22%3A%22%22%7D&tz=180`;
  }, [trendsQuery]);

  return (
    <div className="space-y-6">
      {/* Google Trends explorer */}
      <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-400" />
            <h3 className="font-medium">Google Trends</h3>
            <Badge variant="outline" className="text-[10px]">BR · 12 meses</Badge>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setTrendsQuery(trendsTerm.trim() || "impressão 3D"); }} className="flex gap-2 items-center">
            <Input value={trendsTerm} onChange={e => setTrendsTerm(e.target.value)} placeholder="Pesquisar termo..." className="h-9 w-[200px]" />
            <Button size="sm" type="submit"><Search className="h-4 w-4 mr-1" /> Buscar</Button>
            <Button size="sm" type="button" variant="outline" asChild>
              <a href={`https://trends.google.com/trends/explore?geo=BR&q=${encodeURIComponent(trendsQuery)}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir
              </a>
            </Button>
          </form>
        </div>
        <div className="rounded-xl overflow-hidden bg-background/40 border border-border/30" style={{ height: 380 }}>
          <iframe
            key={trendsQuery}
            src={trendsEmbedUrl}
            className="w-full h-full"
            title={`Google Trends: ${trendsQuery}`}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
        <div className="mt-2 flex items-start gap-2 text-[11px] text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>Embed oficial do Google Trends. Para dados estruturados (API real), conecte uma fonte em <code className="text-foreground/70">trends_hype</code> via server function — a UI abaixo já persiste tudo no Supabase.</span>
        </div>
      </div>

      {/* Saved hypes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Tendências salvas <span className="text-muted-foreground text-sm">({sorted.length})</span></h3>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
        </div>
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
            Nenhuma tendência salva. Pesquise no Google Trends acima e registre as relevantes aqui.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sorted.map(h => (
              <button key={h.id} onClick={() => setEditing(h)} className="text-left rounded-2xl border border-border/40 bg-card/40 hover:bg-card/60 p-4 transition">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="font-medium truncate">{h.term}</div>
                  {h.growth != null && <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 text-[10px]">+{h.growth}%</Badge>}
                </div>
                {h.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{h.description}</p>}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className={`${priColor(h.priority)} text-[10px]`}>{PRIORITY.find(p => p.v === h.priority)?.l}</Badge>
                  <Badge variant="outline" className={`${statusColor(h.status)} text-[10px]`}>{STATUS_OPP.find(s => s.v === h.status)?.l}</Badge>
                  {h.region && <Badge variant="outline" className="text-[10px]">{h.region}</Badge>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {(editing || creating) && (
        <HypeDialog
          hype={editing}
          companies={companies}
          workspaceId={workspaceId}
          userId={userId}
          userEmail={userEmail}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); onReload(); }}
        />
      )}
    </div>
  );
}

function HypeDialog({ hype, companies, workspaceId, userId, userEmail, onClose, onSaved }: {
  hype: Hype | null; companies: string[]; workspaceId: string | null; userId: string | null; userEmail: string;
  onClose: () => void; onSaved: () => void;
}) {
  const isNew = !hype;
  const [form, setForm] = useState<Partial<Hype>>(() => hype ?? {
    term: "", region: "BR", period: "30d", status: "monitor", priority: "medium",
    source: "manual", related_terms: [],
  });
  const [newRelated, setNewRelated] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!workspaceId || !form.term) { toast.error("Termo obrigatório"); return; }
    setSaving(true);
    const payload = {
      workspace_id: workspaceId, user_id: userId, owner_email: userEmail,
      term: form.term, description: form.description ?? null, region: form.region ?? "BR",
      period: form.period ?? "30d", category: form.category ?? null, source: form.source ?? "manual",
      growth: form.growth ?? null, related_terms: form.related_terms ?? [],
      status: form.status ?? "monitor", priority: form.priority ?? "medium",
      company: form.company ?? null, notes: form.notes ?? null, external_url: form.external_url ?? null,
    };
    const op = isNew
      ? (supabase as any).from("trends_hype").insert(payload)
      : (supabase as any).from("trends_hype").update(payload).eq("id", hype!.id);
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "Tendência salva" : "Atualizada");
    onSaved();
  };

  const remove = async () => {
    if (!hype) return;
    if (!confirm(`Excluir "${hype.term}"?`)) return;
    const { error } = await (supabase as any).from("trends_hype").delete().eq("id", hype.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída"); onSaved();
  };

  const toOpp = async () => {
    if (!workspaceId || !form.term) return;
    const { error } = await (supabase as any).from("trends_opportunities").insert({
      workspace_id: workspaceId, user_id: userId, owner_email: userEmail,
      title: form.term, reason: form.description ?? null,
      source_kind: "hype", source_id: hype?.id ?? null,
      company: form.company ?? null, priority: form.priority ?? "medium", status: "monitor",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Oportunidade criada");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova tendência" : "Editar tendência"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Termo *</Label>
            <Input value={form.term ?? ""} onChange={e => setForm({ ...form, term: e.target.value })} placeholder="Ex: impressão 3D" />
          </div>
          <div>
            <Label>Descrição / oportunidade</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Região</Label>
              <Input value={form.region ?? "BR"} onChange={e => setForm({ ...form, region: e.target.value })} />
            </div>
            <div>
              <Label>Período</Label>
              <Input value={form.period ?? "30d"} onChange={e => setForm({ ...form, period: e.target.value })} />
            </div>
            <div>
              <Label>Crescimento %</Label>
              <Input type="number" value={form.growth ?? ""} onChange={e => setForm({ ...form, growth: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Categoria</Label>
              <Input value={form.category ?? ""} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex: Tecnologia" />
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={form.company ?? "_none"} onValueChange={v => setForm({ ...form, company: v === "_none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority ?? "medium"} onValueChange={v => setForm({ ...form, priority: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "monitor"} onValueChange={v => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPP.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Termos relacionados</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {(form.related_terms ?? []).map((t, i) => (
                <Badge key={i} variant="outline" className="gap-1">
                  {t}
                  <button onClick={() => setForm({ ...form, related_terms: (form.related_terms ?? []).filter((_, j) => j !== i) })}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newRelated} onChange={e => setNewRelated(e.target.value)} placeholder="Adicionar termo..." onKeyDown={e => { if (e.key === "Enter" && newRelated.trim()) { setForm({ ...form, related_terms: [...(form.related_terms ?? []), newRelated.trim()] }); setNewRelated(""); } }} />
              <Button type="button" variant="outline" onClick={() => { if (newRelated.trim()) { setForm({ ...form, related_terms: [...(form.related_terms ?? []), newRelated.trim()] }); setNewRelated(""); } }}>+</Button>
            </div>
          </div>
          <div>
            <Label>Link externo (opcional)</Label>
            <Input value={form.external_url ?? ""} onChange={e => setForm({ ...form, external_url: e.target.value })} placeholder="https://trends.google.com/..." />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          {!isNew && (
            <div className="rounded-xl border border-border/40 bg-secondary/30 p-3">
              <Button type="button" size="sm" variant="outline" onClick={toOpp}>
                <Target className="h-3.5 w-3.5 mr-1" /> Transformar em oportunidade
              </Button>
            </div>
          )}
        </div>
        <DialogFooter className="flex !justify-between flex-wrap gap-2">
          {!isNew ? (
            <Button variant="ghost" size="sm" onClick={remove} className="text-rose-400">
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== Opps Panel ==============
function OppsPanel({ items, companies, onReload, workspaceId, userId, userEmail }: {
  items: Opportunity[]; companies: string[]; onReload: () => void;
  workspaceId: string | null; userId: string | null; userEmail: string;
}) {
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => items.filter(o => statusFilter === "all" || o.status === statusFilter), [items, statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[180px]"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {STATUS_OPP.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Nova oportunidade</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
          Nenhuma oportunidade. Transforme sazonalidades ou hypes em oportunidades.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(o => (
            <button key={o.id} onClick={() => setEditing(o)} className="text-left rounded-2xl border border-border/40 bg-card/40 hover:bg-card/60 p-4 transition">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="font-medium">{o.title}</div>
                <Badge variant="outline" className={`${priColor(o.priority)} text-[10px]`}>{PRIORITY.find(p => p.v === o.priority)?.l}</Badge>
              </div>
              {o.reason && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{o.reason}</p>}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className={`${statusColor(o.status)} text-[10px]`}>{STATUS_OPP.find(s => s.v === o.status)?.l}</Badge>
                {o.company && <span className="text-[10px] text-muted-foreground">{o.company}</span>}
                {o.source_kind && <span className="text-[10px] text-muted-foreground ml-auto">de: {o.source_kind}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <OppDialog
          opp={editing}
          companies={companies}
          workspaceId={workspaceId}
          userId={userId}
          userEmail={userEmail}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); onReload(); }}
        />
      )}
    </div>
  );
}

function OppDialog({ opp, companies, workspaceId, userId, userEmail, onClose, onSaved }: {
  opp: Opportunity | null; companies: string[]; workspaceId: string | null; userId: string | null; userEmail: string;
  onClose: () => void; onSaved: () => void;
}) {
  const isNew = !opp;
  const [form, setForm] = useState<Partial<Opportunity>>(() => opp ?? {
    title: "", priority: "medium", status: "monitor",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!workspaceId || !form.title) { toast.error("Título obrigatório"); return; }
    setSaving(true);
    const payload = {
      workspace_id: workspaceId, user_id: userId, owner_email: userEmail,
      title: form.title, reason: form.reason ?? null,
      source_kind: form.source_kind ?? null, source_id: form.source_id ?? null,
      company: form.company ?? null, status: form.status ?? "monitor",
      priority: form.priority ?? "medium", assignee: form.assignee ?? null,
      notes: form.notes ?? null,
    };
    const op = isNew
      ? (supabase as any).from("trends_opportunities").insert(payload)
      : (supabase as any).from("trends_opportunities").update(payload).eq("id", opp!.id);
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "Oportunidade criada" : "Atualizada"); onSaved();
  };
  const remove = async () => {
    if (!opp) return;
    if (!confirm(`Excluir "${opp.title}"?`)) return;
    const { error } = await (supabase as any).from("trends_opportunities").delete().eq("id", opp.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída"); onSaved();
  };
  const createTask = async () => {
    if (!workspaceId || !form.title) return;
    const company = form.company || companies[0] || "Geral";
    const { error } = await (supabase as any).from("checklist_tasks").insert({
      workspace_id: workspaceId, user_id: userId, owner_email: userEmail,
      company, title: form.title, description: form.reason ?? null,
      priority: form.priority === "high" ? "high" : form.priority === "low" ? "low" : "medium",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Tarefa criada");
  };
  const createCard = async () => {
    if (!workspaceId || !form.title) return;
    const company = form.company || companies[0] || "Geral";
    const { error } = await (supabase as any).from("kanban_cards").insert({
      workspace_id: workspaceId, user_id: userId, owner_email: userEmail,
      title: form.title, description: form.reason ?? null, company,
      priority: form.priority === "high" ? "Alta" : form.priority === "low" ? "Baixa" : "Média",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Card criado");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "Nova oportunidade" : "Editar oportunidade"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={form.title ?? ""} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Motivo / descrição</Label>
            <Textarea rows={3} value={form.reason ?? ""} onChange={e => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Empresa</Label>
              <Select value={form.company ?? "_none"} onValueChange={v => setForm({ ...form, company: v === "_none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.assignee ?? ""} onChange={e => setForm({ ...form, assignee: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority ?? "medium"} onValueChange={v => setForm({ ...form, priority: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "monitor"} onValueChange={v => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPP.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          {!isNew && (
            <div className="rounded-xl border border-border/40 bg-secondary/30 p-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={createTask}><ListChecks className="h-3.5 w-3.5 mr-1" /> Checklist</Button>
              <Button type="button" size="sm" variant="outline" onClick={createCard}><KanbanSquare className="h-3.5 w-3.5 mr-1" /> Kanban</Button>
            </div>
          )}
        </div>
        <DialogFooter className="flex !justify-between flex-wrap gap-2">
          {!isNew ? <Button variant="ghost" size="sm" onClick={remove} className="text-rose-400"><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button> : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
