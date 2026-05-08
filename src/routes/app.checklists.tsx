import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Check, Filter, Plus, Trash2, Pencil, GripVertical, X,
  Play, Pause, StopCircle, RotateCcw,
  TrendingUp, CheckCircle2, AlertTriangle, ListTodo, Activity,
  Target, Sparkles, History, Timer, BarChart3, Users,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import {
  COMPANIES, COMPANY_COLORS, ASSIGNEES,
  OPERATIONAL_HISTORY, TIMELINE, type Company,
} from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/lib/auth";
import { usePonto, fmtTime } from "@/lib/ponto";
import { useChecklist, type UserTask } from "@/lib/checklist-store";

export const Route = createFileRoute("/app/checklists")({
  component: ChecklistsPage,
});

type Tab = "diario" | "historico" | "ponto" | "metricas";

const TABS: { id: Tab; label: string; icon: typeof ListTodo }[] = [
  { id: "diario", label: "Checklist Diário", icon: ListTodo },
  { id: "historico", label: "Histórico", icon: History },
  { id: "ponto", label: "Bater Ponto", icon: Timer },
  { id: "metricas", label: "Métricas", icon: BarChart3 },
];

function ChecklistsPage() {
  const [tab, setTab] = useState<Tab>("diario");
  const { totals } = useChecklist();
  const completionPct = totals.pct;

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação diária</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Centro Operacional</h1>
          <p className="text-muted-foreground mt-1">
            Crie, organize e acompanhe suas próprias tarefas por empresa.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
          <div className="relative h-12 w-12">
            <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="oklch(0.28 0.014 240)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="url(#g1)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(completionPct / 100) * 94.25} 94.25`}
              />
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.16 65)" />
                  <stop offset="100%" stopColor="oklch(0.7 0.18 45)" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{completionPct}%</span>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Hoje</div>
            <div className="text-sm font-semibold">{totals.done}/{totals.total} tarefas</div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 mb-6 rounded-xl border border-border bg-card shadow-card w-fit">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "diario" && <DailyTab />}
      {tab === "historico" && <HistoryTab />}
      {tab === "ponto" && <PontoTab completionPct={completionPct} />}
      {tab === "metricas" && <MetricsTab />}
    </div>
  );
}

/* =================== TAB: DIÁRIO =================== */

type StatusFilter = "Todos" | "Concluído" | "Pendente";

function DailyTab() {
  const { state } = useChecklist();
  const [companyFilter, setCompanyFilter] = useState<Company | "Todas">("Todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");

  const visibleCompanies = useMemo(
    () => (companyFilter === "Todas" ? [...COMPANIES] : [companyFilter]),
    [companyFilter]
  );

  const totals = useMemo(() => {
    let total = 0, done = 0;
    for (const c of visibleCompanies) {
      const list = state[c];
      total += list.length;
      done += list.filter((t) => t.done).length;
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [state, visibleCompanies]);

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-card">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          label="Empresa"
          value={companyFilter}
          onChange={(v) => setCompanyFilter(v as Company | "Todas")}
          options={["Todas", ...COMPANIES]}
        />
        <Select
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={["Todos", "Pendente", "Concluído"]}
        />
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-muted-foreground font-mono">{totals.done}/{totals.total} concluídas</span>
          <span className="px-2 py-1 rounded-md bg-surface font-mono text-primary">{totals.pct}%</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {visibleCompanies.map((company) => (
          <CompanyChecklistCard
            key={company}
            company={company}
            statusFilter={statusFilter}
          />
        ))}
      </div>
    </div>
  );
}

function CompanyChecklistCard({
  company, statusFilter,
}: { company: Company; statusFilter: StatusFilter }) {
  const { state, add, edit, remove, toggle, reorder, clearCompany } = useChecklist();
  const tasks = state[company];
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const color = COMPANY_COLORS[company];

  const filtered = tasks.filter((t) => {
    if (statusFilter === "Concluído") return t.done;
    if (statusFilter === "Pendente") return !t.done;
    return true;
  });

  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const submitNew = () => {
    if (!draft.trim()) return;
    add(company, draft);
    setDraft("");
  };

  const startEdit = (t: UserTask) => {
    setEditingId(t.id);
    setEditingText(t.text);
  };
  const saveEdit = () => {
    if (editingId) edit(company, editingId, editingText);
    setEditingId(null);
    setEditingText("");
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
      <div
        className="p-5 border-b border-border"
        style={{
          background: `linear-gradient(180deg, color-mix(in oklab, ${color} 12%, transparent), transparent)`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <CompanyTag company={company} />
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{doneCount}/{tasks.length}</span>
            {tasks.length > 0 && (
              <button
                onClick={() => {
                  if (confirm(`Limpar todas as tarefas de ${company}?`)) clearCompany(company);
                }}
                className="text-[10px] text-muted-foreground hover:text-destructive transition"
                title="Limpar tudo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full transition-all rounded-full"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs font-mono font-semibold" style={{ color }}>{pct}%</span>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        {/* Add input */}
        <div className="flex items-center gap-2 mb-3 px-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
            }}
            placeholder="Nova tarefa…"
            className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={submitNew}
            disabled={!draft.trim()}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none transition"
            aria-label="Adicionar tarefa"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center px-3 py-8">
            <div className="text-xs text-muted-foreground">
              {tasks.length === 0
                ? "Nenhuma tarefa ainda. Adicione a primeira acima."
                : "Nenhuma tarefa neste filtro."}
            </div>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((t) => {
              const isEditing = editingId === t.id;
              const isDragging = dragId === t.id;
              const isOver = overId === t.id && dragId && dragId !== t.id;
              return (
                <li
                  key={t.id}
                  draggable={!isEditing}
                  onDragStart={(e) => {
                    setDragId(t.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnter={() => setOverId(t.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) reorder(company, dragId, t.id);
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  className={`group flex items-start gap-2 rounded-lg p-2.5 transition ${
                    t.done ? "bg-surface/40" : "hover:bg-surface/60"
                  } ${isDragging ? "opacity-40" : ""} ${
                    isOver ? "ring-2 ring-primary/50" : ""
                  }`}
                >
                  <span
                    className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition shrink-0"
                    aria-label="Arrastar"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>

                  <button
                    onClick={() => toggle(company, t.id)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                      t.done ? "border-primary bg-gradient-primary" : "border-border bg-surface hover:border-primary/50"
                    }`}
                    aria-label={t.done ? "Desmarcar" : "Concluir"}
                  >
                    {t.done && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") {
                              setEditingId(null);
                              setEditingText("");
                            }
                          }}
                          onBlur={saveEdit}
                          className="flex-1 rounded-md bg-background border border-border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={saveEdit}
                          className="text-success hover:text-success/80"
                          aria-label="Salvar"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setEditingId(null);
                            setEditingText("");
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => toggle(company, t.id)}
                          className={`block text-left text-sm leading-snug w-full ${
                            t.done ? "line-through text-muted-foreground" : "font-medium"
                          }`}
                        >
                          {t.text}
                        </button>
                        {t.done && t.doneAt && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-success font-mono">
                            <CheckCircle2 className="h-3 w-3" /> Concluída às {t.doneAt}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={() => startEdit(t)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(company, t.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md bg-surface border border-border px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

/* =================== TAB: HISTÓRICO =================== */

function HistoryTab() {
  const [period, setPeriod] = useState<"diario" | "semanal" | "mensal">("semanal");
  const [companyFilter, setCompanyFilter] = useState<Company | "Todas">("Todas");
  const [userFilter, setUserFilter] = useState<string>("Todos");

  const data = useMemo(() => {
    if (period === "diario") return OPERATIONAL_HISTORY.slice(-1);
    if (period === "semanal") return OPERATIONAL_HISTORY.slice(-7);
    return OPERATIONAL_HISTORY;
  }, [period]);

  const totals = data.reduce(
    (acc, d) => ({
      completed: acc.completed + d.completed,
      pending: acc.pending + d.pending,
      late: acc.late + d.late,
    }),
    { completed: 0, pending: 0, late: 0 }
  );
  const avgProd = Math.round(data.reduce((s, d) => s + d.productivity, 0) / data.length);

  const filteredTimeline = TIMELINE.filter(
    (e) =>
      (companyFilter === "Todas" || e.company === companyFilter) &&
      (userFilter === "Todos" || e.user === userFilter)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-card">
        <div className="flex gap-1 p-1 rounded-lg bg-surface">
          {(["diario", "semanal", "mensal"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition ${
                period === p ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <Select label="Empresa" value={companyFilter} onChange={(v) => setCompanyFilter(v as Company | "Todas")} options={["Todas", ...COMPANIES]} />
        <Select label="Usuário" value={userFilter} onChange={setUserFilter} options={["Todos", ...ASSIGNEES]} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Concluídas" value={totals.completed} icon={CheckCircle2} accent="success" hint="no período" />
        <StatCard label="Pendentes" value={totals.pending} icon={ListTodo} accent="warning" hint="aguardando ação" />
        <StatCard label="Atrasos" value={totals.late} icon={AlertTriangle} accent="destructive" hint="fora do SLA" />
        <StatCard label="Produtividade" value={`${avgProd}%`} icon={TrendingUp} accent="primary" hint="média" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Produtividade no período</h3>
            <span className="text-xs text-muted-foreground">{data.length} dias</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="prodG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "oklch(0.97 0.005 240)" }}
                />
                <Area type="monotone" dataKey="productivity" stroke="oklch(0.78 0.16 65)" strokeWidth={2} fill="url(#prodG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Status agregado</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="oklch(0.6 0.02 240)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="completed" stackId="a" fill="oklch(0.72 0.16 155)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending" stackId="a" fill="oklch(0.82 0.16 80)" />
                <Bar dataKey="late" stackId="a" fill="oklch(0.62 0.22 25)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Timeline operacional
          </h3>
          <span className="text-xs text-muted-foreground">{filteredTimeline.length} eventos</span>
        </div>
        <ol className="relative border-l border-border ml-3 space-y-4">
          {filteredTimeline.map((e) => {
            const dot =
              e.status === "completed" ? "bg-success" :
              e.status === "late" ? "bg-destructive" : "bg-warning";
            return (
              <li key={e.id} className="ml-5">
                <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${dot} shadow-glow`} />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{e.time}</span>
                  <CompanyTag company={e.company} />
                  <span className="text-foreground">{e.action}</span>
                  <span className="text-xs text-muted-foreground">— {e.user}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* =================== TAB: BATER PONTO =================== */

function PontoTab({ completionPct }: { completionPct: number }) {
  const { user } = useAuth();
  const {
    session, liveWorkMs: liveWork, livePauseMs: livePause, productiveMs, isLive,
    start: startPonto, pause, resume, end, reset,
  } = usePonto();
  const { state, totals } = useChecklist();
  const status = session.status;
  const start = () => startPonto(user?.name, user?.email);
  const startedAt = session.startedAt;

  // Tarefas concluídas vinculadas à sessão atual (histórico permanente)
  const [sessionTasks, setSessionTasks] = useState<
    { id: string; company: Company; title: string; completed_at: string; user_name: string | null }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const sid = session.sessionId;
    if (!sid) { setSessionTasks([]); return; }
    const load = async () => {
      const { data, error } = await supabase
        .from("ponto_session_tasks")
        .select("id, company, title, completed_at, user_name")
        .eq("session_id", sid)
        .order("completed_at", { ascending: true });
      if (!cancelled && !error && data) {
        setSessionTasks(data as typeof sessionTasks);
      }
    };
    load();
    const ch = supabase
      .channel(`ponto_session_tasks:${sid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ponto_session_tasks", filter: `session_id=eq.${sid}` },
        () => load()
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [session.sessionId]);

  const sessionCompaniesOperated = useMemo(
    () => Array.from(new Set(sessionTasks.map((t) => t.company))) as Company[],
    [sessionTasks]
  );

  const pendingTasks = useMemo(() => {
    const out: { company: Company; task: UserTask }[] = [];
    for (const c of COMPANIES) {
      for (const t of state[c]) {
        if (!t.done) out.push({ company: c, task: t });
      }
    }
    return out.slice(0, 6);
  }, [state]);

  return (
    <div className="space-y-5">
      {/* Top: Timer + status */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-8 shadow-card relative overflow-hidden">
          <div className="absolute inset-0 bg-glow opacity-50 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                isLive ? "border-success/30 bg-success/10 text-success" : "border-border bg-surface text-muted-foreground"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                {status === "working" ? "Online" : status === "paused" ? "Em pausa" : status === "ended" ? "Encerrado" : "Offline"}
              </span>
              <span className="text-xs text-muted-foreground">{user?.name} · {user?.role}</span>
            </div>

            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tempo de expediente</div>
              <div className="font-display text-6xl md:text-7xl font-bold tracking-tight tabular-nums mt-1">
                {fmtTime(liveWork)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span>Produtivo: <span className="text-success font-mono">{fmtTime(productiveMs)}</span></span>
                <span>Pausa: <span className="text-warning font-mono">{fmtTime(livePause)}</span></span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {status === "off" && (
                <PontoBtn onClick={start} icon={Play} variant="primary">Iniciar expediente</PontoBtn>
              )}
              {status === "working" && (
                <>
                  <PontoBtn onClick={pause} icon={Pause} variant="warning">Pausar</PontoBtn>
                  <PontoBtn onClick={end} icon={StopCircle} variant="destructive">Encerrar</PontoBtn>
                </>
              )}
              {status === "paused" && (
                <>
                  <PontoBtn onClick={resume} icon={Play} variant="primary">Retornar</PontoBtn>
                  <PontoBtn onClick={end} icon={StopCircle} variant="destructive">Encerrar</PontoBtn>
                </>
              )}
              {status === "ended" && (
                <PontoBtn onClick={reset} icon={RotateCcw} variant="ghost">Novo expediente</PontoBtn>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Metas do dia
          </h3>
          <div className="mt-4 space-y-4">
            <Goal label="Conclusão de tarefas" value={completionPct} target={90} />
            <Goal label="Tempo produtivo" value={Math.min(100, Math.round((productiveMs / (8 * 3600 * 1000)) * 100))} target={100} />
            <Goal label="Tarefas pendentes" value={Math.max(0, totals.total - totals.done)} target={Math.max(1, totals.total)} />
          </div>
        </div>
      </div>

      {/* Painel diário ao iniciar */}
      {(status === "working" || status === "paused") && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Próximas tarefas pendentes
            </h3>
            <span className="text-xs text-muted-foreground">{pendingTasks.length} itens</span>
          </div>
          {pendingTasks.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhuma tarefa pendente. Adicione itens na aba Checklist Diário.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingTasks.map(({ company, task }) => (
                <div key={task.id} className="rounded-lg border border-border bg-surface/40 p-4">
                  <CompanyTag company={company} />
                  <div className="mt-2 text-sm font-medium">{task.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resumo automático ao encerrar */}
      {status === "ended" && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold">Resumo automático do expediente</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Tempo total" value={fmtTime(liveWork)} icon={Timer} accent="primary" />
            <StatCard label="Tempo produtivo" value={fmtTime(productiveMs)} icon={TrendingUp} accent="success" />
            <StatCard label="Pausas" value={fmtTime(livePause)} icon={Pause} accent="warning" />
            <StatCard label="Tarefas concluídas" value={`${totals.done}/${totals.total}`} icon={CheckCircle2} accent="info" />
          </div>
          <div className="mt-4 grid sm:grid-cols-3 gap-3 text-xs">
            <SummaryRow label="Entrada" value={startedAt ? new Date(startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"} />
            <SummaryRow label="Saída" value={session.endedAt ? new Date(session.endedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"} />
            <SummaryRow label="Pausas" value={`${session.pauses.length}`} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Você completou <strong className="text-foreground">{completionPct}%</strong> das tarefas do dia
            em <strong className="text-foreground">{fmtTime(productiveMs)}</strong> de tempo produtivo.
            {completionPct >= 80 ? " Excelente performance — meta diária atingida." : " Algumas tarefas ficaram pendentes — considere revisar a priorização amanhã."}
          </p>
          <div className="mt-4">
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
              Iniciar novo expediente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function PontoBtn({
  children, onClick, icon: Icon, variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: typeof Play;
  variant: "primary" | "warning" | "destructive" | "ghost";
}) {
  const styles = {
    primary: "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90",
    warning: "bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25",
    destructive: "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25",
    ghost: "bg-surface text-foreground border border-border hover:bg-surface-elevated",
  };
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${styles[variant]}`}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function Goal({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}<span className="text-muted-foreground">/{target}</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
        <div className="h-full bg-gradient-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* =================== TAB: MÉTRICAS =================== */

function MetricsTab() {
  const { state, totals } = useChecklist();
  const completionPct = totals.pct;

  const byCompany = COMPANIES.map((c) => {
    const list = state[c];
    const completed = list.filter((t) => t.done).length;
    return {
      company: c,
      total: list.length,
      completed,
      pct: list.length ? Math.round((completed / list.length) * 100) : 0,
    };
  });

  const efficiency = Math.round(
    OPERATIONAL_HISTORY.slice(-7).reduce((s, d) => s + d.productivity, 0) / 7
  );

  const activeCompanies = byCompany.filter((b) => b.total > 0).length;

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Produtividade" value={`${completionPct}%`} icon={TrendingUp} accent="primary" hint="hoje" />
        <StatCard label="Taxa de conclusão" value={`${totals.done}/${totals.total}`} icon={CheckCircle2} accent="success" hint="tarefas/total" />
        <StatCard label="Eficiência operacional" value={`${efficiency}%`} icon={Activity} accent="info" hint="média 7 dias" />
        <StatCard label="Empresas ativas" value={`${activeCompanies}/${COMPANIES.length}`} icon={Users} accent="warning" hint="com tarefas" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Tarefas por empresa</h3>
          {totals.total === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              Sem dados ainda. Crie tarefas para visualizar métricas.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCompany} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="company" type="category" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="completed" fill="oklch(0.78 0.16 65)" radius={[0, 4, 4, 0]} name="Concluídas" />
                  <Bar dataKey="total" fill="oklch(0.32 0.04 230)" radius={[0, 4, 4, 0]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Eficiência geral</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ name: "ef", value: efficiency, fill: "oklch(0.78 0.16 65)" }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "oklch(0.28 0.014 240)" }} dataKey="value" cornerRadius={10} />
                <text x="50%" y="48%" textAnchor="middle" fontSize="32" fontWeight="700" fill="oklch(0.97 0.005 240)" fontFamily="Space Grotesk">
                  {efficiency}%
                </text>
                <text x="50%" y="62%" textAnchor="middle" fontSize="11" fill="oklch(0.68 0.02 240)">
                  EFICIÊNCIA 7D
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-semibold mb-4">Progresso por empresa</h3>
        <div className="space-y-3">
          {byCompany.map((b) => (
            <div key={b.company} className="flex items-center gap-4">
              <div className="w-28 shrink-0">
                <CompanyTag company={b.company} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{b.completed}/{b.total} tarefas</span>
                  <span className="font-mono text-xs">{b.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${b.pct}%`, backgroundColor: COMPANY_COLORS[b.company] }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
