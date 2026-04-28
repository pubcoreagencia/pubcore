import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Check, Filter, Clock, Play, Pause, StopCircle, RotateCcw,
  TrendingUp, CheckCircle2, AlertTriangle, ListTodo, Activity,
  Target, Sparkles, History, Timer, BarChart3, Users,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import {
  COMPANIES, COMPANY_COLORS, DAILY_TASKS, ASSIGNEES,
  OPERATIONAL_HISTORY, TIMELINE, type Company, type DailyTask,
} from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/lib/auth";
import { usePonto, fmtTime } from "@/lib/ponto";

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
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [doneAt, setDoneAt] = useState<Record<string, string>>({});

  const completionPct = Math.round(
    (Object.values(done).filter(Boolean).length / DAILY_TASKS.length) * 100
  );

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação diária</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Centro Operacional</h1>
          <p className="text-muted-foreground mt-1">
            Checklists, histórico, ponto e métricas — tudo em um só lugar.
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
            <div className="text-sm font-semibold">{Object.values(done).filter(Boolean).length}/{DAILY_TASKS.length} tarefas</div>
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

      {tab === "diario" && <DailyTab done={done} setDone={setDone} doneAt={doneAt} setDoneAt={setDoneAt} />}
      {tab === "historico" && <HistoryTab />}
      {tab === "ponto" && <PontoTab completionPct={completionPct} />}
      {tab === "metricas" && <MetricsTab done={done} />}
    </div>
  );
}

/* =================== TAB: DIÁRIO =================== */

type StatusFilter = "Todos" | "Concluído" | "Pendente";

function DailyTab({
  done, setDone, doneAt, setDoneAt,
}: {
  done: Record<string, boolean>;
  setDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  doneAt: Record<string, string>;
  setDoneAt: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const [companyFilter, setCompanyFilter] = useState<Company | "Todas">("Todas");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("Todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");

  const filtered = useMemo(
    () =>
      DAILY_TASKS.filter((t) => {
        if (companyFilter !== "Todas" && t.company !== companyFilter) return false;
        if (assigneeFilter !== "Todos" && t.assignee !== assigneeFilter) return false;
        if (statusFilter === "Concluído" && !done[t.id]) return false;
        if (statusFilter === "Pendente" && done[t.id]) return false;
        return true;
      }),
    [companyFilter, assigneeFilter, statusFilter, done]
  );

  const grouped = useMemo(() => {
    const m = new Map<Company, DailyTask[]>();
    filtered.forEach((t) => {
      if (!m.has(t.company)) m.set(t.company, []);
      m.get(t.company)!.push(t);
    });
    return Array.from(m.entries());
  }, [filtered]);

  const toggle = (id: string) => {
    setDone((s) => {
      const next = { ...s, [id]: !s[id] };
      return next;
    });
    setDoneAt((s) => {
      if (done[id]) {
        const { [id]: _omit, ...rest } = s;
        return rest;
      }
      const now = new Date();
      return { ...s, [id]: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` };
    });
  };

  const totalDone = filtered.filter((t) => done[t.id]).length;
  const overallPct = filtered.length ? Math.round((totalDone / filtered.length) * 100) : 0;

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
          label="Responsável"
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          options={["Todos", ...ASSIGNEES]}
        />
        <Select
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={["Todos", "Pendente", "Concluído"]}
        />
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-muted-foreground font-mono">{filtered.length} tarefas</span>
          <span className="px-2 py-1 rounded-md bg-surface font-mono text-primary">{overallPct}% do filtro</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {grouped.map(([company, tasks]) => {
          const doneCount = tasks.filter((t) => done[t.id]).length;
          const pct = Math.round((doneCount / tasks.length) * 100);
          const color = COMPANY_COLORS[company];

          // group tasks by category
          const byCategory = new Map<string, DailyTask[]>();
          tasks.forEach((t) => {
            if (!byCategory.has(t.category)) byCategory.set(t.category, []);
            byCategory.get(t.category)!.push(t);
          });

          return (
            <div key={company} className="rounded-xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
              <div
                className="p-5 border-b border-border"
                style={{
                  background: `linear-gradient(180deg, color-mix(in oklab, ${color} 12%, transparent), transparent)`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <CompanyTag company={company} />
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-surface text-muted-foreground">
                      <RotateCcw className="h-2.5 w-2.5" /> Diário
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{doneCount}/{tasks.length}</span>
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

                {/* mini histórico — últimos 7 dias */}
                <MiniHistory color={color} />
              </div>

              <div className="p-3 space-y-3 flex-1">
                {Array.from(byCategory.entries()).map(([cat, items]) => {
                  const cdone = items.filter((t) => done[t.id]).length;
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between px-2 mb-1">
                        <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground">{cat}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{cdone}/{items.length}</span>
                      </div>
                      <ul className="space-y-0.5">
                        {items.map((t) => {
                          const checked = !!done[t.id];
                          const at = doneAt[t.id];
                          return (
                            <li key={t.id}>
                              <button
                                onClick={() => toggle(t.id)}
                                className={`w-full flex items-start gap-3 rounded-lg p-2.5 text-left transition group ${
                                  checked ? "bg-surface/40" : "hover:bg-surface/60"
                                }`}
                              >
                                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                                  checked ? "border-primary bg-gradient-primary" : "border-border bg-surface"
                                }`}>
                                  {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm leading-snug ${checked ? "line-through text-muted-foreground" : "font-medium"}`}>
                                    {t.text}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <PriorityBadge priority={t.priority} />
                                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                                      <Clock className="h-3 w-3" />{t.dueTime}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">· {t.assignee}</span>
                                    {checked && at && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-success font-mono ml-auto">
                                        <CheckCircle2 className="h-3 w-3" /> {at}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {grouped.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            Nenhuma tarefa corresponde aos filtros aplicados.
          </div>
        )}
      </div>
    </div>
  );
}

function MiniHistory({ color }: { color: string }) {
  // pequena visualização determinística dos últimos 7 dias
  const bars = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const seed = (i * 37 + color.length * 13) % 100;
      return 35 + (seed % 60);
    });
  }, [color]);
  const labels = ["S", "T", "Q", "Q", "S", "S", "D"];
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Histórico 7d</span>
        <span className="text-[9px] text-muted-foreground font-mono">conclusão</span>
      </div>
      <div className="flex items-end gap-1 h-8">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-sm transition-all"
              style={{
                height: `${h}%`,
                backgroundColor: `color-mix(in oklab, ${color} ${30 + h / 2}%, transparent)`,
              }}
            />
            <span className="text-[8px] text-muted-foreground/60 font-mono">{labels[i]}</span>
          </div>
        ))}
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
  const status = session.status;
  const start = () => startPonto(user?.name);
  const startedAt = session.startedAt;

  const priorityTasks = DAILY_TASKS
    .filter((t) => t.priority === "Crítica" || t.priority === "Alta")
    .slice(0, 5);

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
            <Goal label="Tarefas críticas" value={50} target={100} />
          </div>
        </div>
      </div>

      {/* Painel diário ao iniciar */}
      {(status === "working" || status === "paused") && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Tarefas prioritárias do dia
            </h3>
            <span className="text-xs text-muted-foreground">{priorityTasks.length} itens</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {priorityTasks.map((t) => (
              <div key={t.id} className="rounded-lg border border-border bg-surface/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <CompanyTag company={t.company} />
                  <PriorityBadge priority={t.priority} />
                </div>
                <div className="mt-2 text-sm font-medium">{t.text}</div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                  <Clock className="h-3 w-3" />{t.dueTime} · {t.assignee}
                </div>
              </div>
            ))}
          </div>
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
            <StatCard label="Tarefas concluídas" value={`${Math.round(completionPct / 100 * DAILY_TASKS.length)}/${DAILY_TASKS.length}`} icon={CheckCircle2} accent="info" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Você completou <strong className="text-foreground">{completionPct}%</strong> das tarefas do dia
            em <strong className="text-foreground">{fmtTime(productiveMs)}</strong> de tempo produtivo.
            {completionPct >= 80 ? " Excelente performance — meta diária atingida." : " Algumas tarefas ficaram pendentes — considere revisar a priorização amanhã."}
          </p>
        </div>
      )}
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
        <span className="font-mono">{value}<span className="text-muted-foreground">/{target}%</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
        <div className="h-full bg-gradient-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* =================== TAB: MÉTRICAS =================== */

function MetricsTab({ done }: { done: Record<string, boolean> }) {
  const completionPct = Math.round(
    (Object.values(done).filter(Boolean).length / DAILY_TASKS.length) * 100
  );

  const byCompany = COMPANIES.map((c) => {
    const tasks = DAILY_TASKS.filter((t) => t.company === c);
    const completed = tasks.filter((t) => done[t.id]).length;
    return {
      company: c,
      total: tasks.length,
      completed,
      pct: Math.round((completed / Math.max(1, tasks.length)) * 100),
    };
  });

  const byUser = ASSIGNEES.map((u) => {
    const tasks = DAILY_TASKS.filter((t) => t.assignee === u);
    const completed = tasks.filter((t) => done[t.id]).length;
    return { user: u, total: tasks.length, completed };
  });

  const efficiency = Math.round(
    OPERATIONAL_HISTORY.slice(-7).reduce((s, d) => s + d.productivity, 0) / 7
  );

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Produtividade" value={`${completionPct}%`} icon={TrendingUp} accent="primary" hint="hoje" />
        <StatCard label="Taxa de conclusão" value={`${completionPct}%`} icon={CheckCircle2} accent="success" hint="tarefas/total" />
        <StatCard label="Eficiência operacional" value={`${efficiency}%`} icon={Activity} accent="info" hint="média 7 dias" />
        <StatCard label="Usuários ativos" value={ASSIGNEES.length} icon={Users} accent="warning" hint="hoje" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Tarefas por empresa</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCompany} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="company" type="category" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="completed" fill="oklch(0.78 0.16 65)" radius={[0, 4, 4, 0]} name="Concluídas" />
                <Bar dataKey="total" fill="oklch(0.32 0.04 230)" radius={[0, 4, 4, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
        <h3 className="font-display font-semibold mb-4">Tarefas por usuário</h3>
        <div className="space-y-3">
          {byUser.map((u) => {
            const pct = Math.round((u.completed / Math.max(1, u.total)) * 100);
            return (
              <div key={u.user} className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-bold text-sm shrink-0">
                  {u.user[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{u.user}</span>
                    <span className="font-mono text-xs text-muted-foreground">{u.completed}/{u.total} · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
