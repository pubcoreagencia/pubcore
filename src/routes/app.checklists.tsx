import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Check, Filter, Plus, Trash2, Pencil, GripVertical, X,
  Play, Pause, StopCircle, RotateCcw,
  TrendingUp, CheckCircle2, AlertTriangle, ListTodo, Activity,
  Sparkles, History, Timer, BarChart3, Users, Trash,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import {
  COMPANIES, COMPANY_COLORS, type Company,
} from "@/lib/mock-data";
import {
  useOperationalData, buildDailySeries, tasksByCompany, tasksByUser,
  type SessionRow, type SessionTaskRow,
} from "@/lib/operations";
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
      {tab === "ponto" && <PontoTab />}
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

type TimelineEvent = {
  kind: "completed";
  id: string;
  ts: number;
  title: string;
  company: string | null;
  user_name: string | null;
};

function HistoryTab() {
  const { sessions, sessionTasks, loading } = useOperationalData();
  const [period, setPeriod] = useState<"diario" | "semanal" | "mensal">("semanal");
  const [companyFilter, setCompanyFilter] = useState<Company | "Todas">("Todas");
  const [userFilter, setUserFilter] = useState<string>("Todos");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const days = period === "diario" ? 1 : period === "semanal" ? 7 : 30;
  const cutoff = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.getTime() - (days - 1) * 86400000;
  }, [days]);

  const periodSessions = useMemo(
    () => sessions.filter((s) => s.status === "ended" && new Date(s.started_at).getTime() >= cutoff),
    [sessions, cutoff]
  );
  const periodTasks = useMemo(
    () => sessionTasks.filter((t) => new Date(t.completed_at).getTime() >= cutoff),
    [sessionTasks, cutoff]
  );

  const userOptions = useMemo(() => {
    const s = new Set<string>();
    for (const x of sessions) if (x.user_name) s.add(x.user_name);
    for (const x of sessionTasks) if (x.user_name) s.add(x.user_name);
    return ["Todos", ...Array.from(s).sort()];
  }, [sessions, sessionTasks]);

  const filteredSessions = useMemo(() => {
    return periodSessions.filter((s) => {
      if (userFilter !== "Todos" && (s.user_name ?? "") !== userFilter) return false;
      if (companyFilter !== "Todas") {
        const ids = new Set(periodTasks.filter((t) => t.session_id === s.id && t.company === companyFilter).map((t) => t.id));
        if (ids.size === 0) return false;
      }
      return true;
    });
  }, [periodSessions, periodTasks, userFilter, companyFilter]);

  const filteredTimeline = useMemo<TimelineEvent[]>(() => {
    return periodTasks
      .filter((t) =>
        (companyFilter === "Todas" || t.company === companyFilter) &&
        (userFilter === "Todos" || (t.user_name ?? "") === userFilter)
      )
      .map((t) => ({
        kind: "completed" as const,
        id: `c-${t.id}`,
        ts: new Date(t.completed_at).getTime(),
        title: t.title,
        company: t.company,
        user_name: t.user_name,
      }))
      .sort((a, b) => b.ts - a.ts);
  }, [periodTasks, companyFilter, userFilter]);

  const series = useMemo(() => buildDailySeries(periodSessions, periodTasks, days), [periodSessions, periodTasks, days]);

  const totals = {
    completed: periodTasks.filter((t) =>
      (companyFilter === "Todas" || t.company === companyFilter) &&
      (userFilter === "Todos" || (t.user_name ?? "") === userFilter)
    ).length,
    sessions: filteredSessions.length,
    productiveMs: filteredSessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0),
    totalMs: filteredSessions.reduce((a, s) => a + (s.total_ms ?? 0), 0),
  };

  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const pageSessions = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [period, companyFilter, userFilter]);

  const fmtClock = (ts: string | null) =>
    ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtDate = (ts: string) =>
    new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });

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
        <Select label="Usuário" value={userFilter} onChange={setUserFilter} options={userOptions} />
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {loading ? "Carregando…" : `${totals.completed} concluídas`}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Tarefas concluídas" value={totals.completed} icon={CheckCircle2} accent="success" hint="no período" />
        <StatCard label="Sessões encerradas" value={totals.sessions} icon={History} accent="info" hint="expedientes" />
        <StatCard label="Tempo produtivo" value={fmtTime(totals.productiveMs)} icon={Timer} accent="primary" hint="acumulado" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Produtividade no período</h3>
          <span className="text-xs text-muted-foreground">{series.length} dias</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="histG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="productivity" stroke="oklch(0.78 0.16 65)" strokeWidth={2} fill="url(#histG)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sessões encerradas com paginação */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Expedientes encerrados
          </h3>
          <span className="text-xs text-muted-foreground">{filteredSessions.length} no total</span>
        </div>
        {filteredSessions.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            Nenhum expediente encerrado neste filtro.
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface/40 overflow-hidden">
              {pageSessions.map((s) => {
                const tasks = periodTasks.filter((t) => t.session_id === s.id);
                const companies = Array.from(new Set(tasks.map((t) => t.company))) as Company[];
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-[140px]">
                      <div className="text-xs text-muted-foreground">{fmtDate(s.started_at)}</div>
                      <div className="font-mono text-xs">{fmtClock(s.started_at)} → {fmtClock(s.ended_at)}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs tabular-nums">{fmtTime(s.total_ms ?? 0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <span className="text-xs">{tasks.length} tarefas</span>
                    </div>
                    {s.user_name && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{s.user_name}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1 ml-auto">
                      {companies.map((c) => <CompanyTag key={c} company={c} />)}
                    </div>
                  </li>
                );
              })}
            </ul>
            {pageCount > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-muted-foreground">Página {page} de {pageCount}</span>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-md border border-border bg-surface text-xs disabled:opacity-40 hover:bg-surface-elevated"
                  >Anterior</button>
                  <button
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    className="px-3 py-1.5 rounded-md border border-border bg-surface text-xs disabled:opacity-40 hover:bg-surface-elevated"
                  >Próxima</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Timeline operacional — concluídas + excluídas */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Timeline operacional
          </h3>
          <span className="text-xs text-muted-foreground">{filteredTimeline.length} eventos</span>
        </div>
        {filteredTimeline.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum evento neste filtro.
          </div>
        ) : (
          <ol className="relative border-l border-border ml-3 space-y-3 max-h-[480px] overflow-y-auto pr-2">
            {filteredTimeline.slice(0, 200).map((e) => (
              <li key={e.id} className="ml-5">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full shadow-glow bg-success" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(e.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-success/30 bg-success/10 text-success uppercase tracking-wider">
                    <CheckCircle2 className="h-3 w-3" /> Concluído
                  </span>
                  {e.company && <CompanyTag company={e.company as Company} />}
                  <span className="text-foreground">{e.title}</span>
                  {e.user_name && <span className="text-xs text-muted-foreground">— {e.user_name}</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/* =================== TAB: BATER PONTO =================== */

interface PastSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  total_ms: number | null;
  productive_ms: number | null;
  pause_ms: number | null;
  user_name: string | null;
  task_count?: number;
  companies?: Company[];
}

function PontoTab() {
  const { user } = useAuth();
  const {
    session, liveWorkMs: liveWork, livePauseMs: livePause, productiveMs, isLive,
    start: startPonto, pause, resume, end, reset,
  } = usePonto();
  const status = session.status;
  const start = () => startPonto(user?.name, user?.email, user?.id);
  const startedAt = session.startedAt;

  // Tarefas concluídas vinculadas à sessão atual
  const [sessionTasks, setSessionTasks] = useState<
    { id: string; company: Company; title: string; completed_at: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const sid = session.sessionId;
    if (!sid) { setSessionTasks([]); return; }
    const load = async () => {
      const { data, error } = await supabase
        .from("ponto_session_tasks")
        .select("id, company, title, completed_at")
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

  const companiesOperated = useMemo(
    () => Array.from(new Set(sessionTasks.map((t) => t.company))) as Company[],
    [sessionTasks]
  );

  // Histórico de sessões anteriores
  const [history, setHistory] = useState<PastSession[]>([]);
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    const load = async () => {
      const { data: sessions } = await supabase
        .from("ponto_sessions")
        .select("id, started_at, ended_at, status, total_ms, productive_ms, pause_ms, user_name")
        .eq("owner_email", user.email)
        .eq("status", "ended")
        .order("started_at", { ascending: false })
        .limit(10);
      if (!sessions || cancelled) return;
      const ids = sessions.map((s) => s.id);
      let counts: Record<string, { count: number; companies: Set<string> }> = {};
      if (ids.length > 0) {
        const { data: tasks } = await supabase
          .from("ponto_session_tasks")
          .select("session_id, company")
          .in("session_id", ids);
        if (tasks) {
          for (const t of tasks) {
            const k = t.session_id as string;
            if (!counts[k]) counts[k] = { count: 0, companies: new Set() };
            counts[k].count++;
            counts[k].companies.add(t.company as string);
          }
        }
      }
      if (!cancelled) {
        setHistory(
          sessions.map((s) => ({
            ...s,
            task_count: counts[s.id]?.count ?? 0,
            companies: Array.from(counts[s.id]?.companies ?? []) as Company[],
          }))
        );
      }
    };
    load();
    const ch = supabase
      .channel(`ponto_sessions_history:${user.email}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ponto_sessions", filter: `owner_email=eq.${user.email}` },
        () => load()
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user?.email, session.status]);

  const fmtClock = (ts: number | string | null) =>
    ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

  const statusLabel =
    status === "working" ? "Em expediente" :
    status === "paused" ? "Pausado" :
    status === "ended" ? "Encerrado" : "Offline";

  const statusColor =
    status === "working" ? "border-success/30 bg-success/10 text-success" :
    status === "paused" ? "border-warning/30 bg-warning/10 text-warning" :
    status === "ended" ? "border-primary/30 bg-primary/10 text-primary" :
    "border-border bg-surface text-muted-foreground";

  return (
    <div className="space-y-5">
      {/* 1 + 2: Status + Timer Operacional */}
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card relative overflow-hidden">
        <div className="absolute inset-0 bg-glow opacity-50 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${statusColor}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-current animate-pulse" : "bg-current opacity-60"}`} />
              {statusLabel}
            </span>
            {user && <span className="text-xs text-muted-foreground">{user.name} · {user.role}</span>}
          </div>

          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tempo de expediente</div>
            <div className="font-display text-6xl md:text-7xl font-bold tracking-tight tabular-nums mt-1">
              {fmtTime(liveWork)}
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryRow label="Entrada" value={fmtClock(startedAt)} />
            <SummaryRow label="Tempo ativo" value={fmtTime(productiveMs)} />
            <SummaryRow label="Tempo pausado" value={fmtTime(livePause)} />
            <SummaryRow label="Saída" value={fmtClock(session.endedAt)} />
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

      {/* 3: Resumo Operacional do Dia */}
      {(isLive || status === "ended") && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold">
              {status === "ended" ? "Resumo operacional do dia" : "Resumo operacional"}
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Tarefas concluídas" value={`${sessionTasks.length}`} icon={CheckCircle2} accent="success" />
            <StatCard label="Empresas operadas" value={`${companiesOperated.length}`} icon={Users} accent="info" hint={`${COMPANIES.length} possíveis`} />
            <StatCard label="Tempo trabalhado" value={fmtTime(liveWork)} icon={Timer} accent="primary" />
            <StatCard label="Tempo produtivo" value={fmtTime(productiveMs)} icon={TrendingUp} accent="warning" />
          </div>

          {companiesOperated.length > 0 && (
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Empresas operadas</div>
              <div className="flex flex-wrap gap-2">
                {companiesOperated.map((c) => <CompanyTag key={c} company={c} />)}
              </div>
            </div>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Tarefas realizadas</div>
              <span className="text-xs text-muted-foreground">{sessionTasks.length} itens</span>
            </div>
            {sessionTasks.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center rounded-lg bg-surface/40 border border-border">
                Nenhuma tarefa concluída {status === "ended" ? "neste expediente." : "ainda."}
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface/40 overflow-hidden">
                {sessionTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-12 shrink-0">
                      {new Date(t.completed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <CompanyTag company={t.company} />
                    <span className="flex-1 truncate">{t.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 4: Histórico de Sessões */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Histórico de sessões
          </h3>
          <span className="text-xs text-muted-foreground">{history.length} sessões</span>
        </div>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma sessão encerrada ainda.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface/40 overflow-hidden">
            {history.map((s) => {
              const date = new Date(s.started_at);
              const dur = s.total_ms ?? 0;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-[120px]">
                    <div className="text-xs text-muted-foreground">
                      {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </div>
                    <div className="font-mono text-xs">
                      {fmtClock(s.started_at)} → {fmtClock(s.ended_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs tabular-nums">{fmtTime(dur)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <span className="text-xs">{s.task_count ?? 0} tarefas</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 ml-auto">
                    {(s.companies ?? []).map((c) => <CompanyTag key={c} company={c} />)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
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

/* =================== TAB: MÉTRICAS =================== */

function MetricsTab() {
  const { sessions, sessionTasks, checklist, loading } = useOperationalData();
  const [period, setPeriod] = useState<"diario" | "semanal" | "mensal">("semanal");
  const days = period === "diario" ? 1 : period === "semanal" ? 7 : 30;
  const cutoff = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.getTime() - (days - 1) * 86400000;
  }, [days]);

  const periodSessions = useMemo(
    () => sessions.filter((s) => new Date(s.started_at).getTime() >= cutoff),
    [sessions, cutoff]
  );
  const periodTasks = useMemo(
    () => sessionTasks.filter((t) => new Date(t.completed_at).getTime() >= cutoff),
    [sessionTasks, cutoff]
  );

  const totalMs = periodSessions.reduce((a, s) => a + (s.total_ms ?? 0), 0);
  const productiveMs = periodSessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0);
  const productivity = totalMs > 0 ? Math.round((productiveMs / totalMs) * 100) : 0;
  const tasksCount = periodTasks.length;
  const avgPerTaskMs = tasksCount > 0 ? Math.round(productiveMs / tasksCount) : 0;
  const hours = totalMs / 3600000;

  const checklistDone = checklist.filter((t) => t.status === "done").length;
  const checklistTotal = checklist.length;
  const completionRate = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const series = useMemo(() => buildDailySeries(periodSessions, periodTasks, days), [periodSessions, periodTasks, days]);
  const byCompany = useMemo(() => tasksByCompany(periodTasks), [periodTasks]);
  const byUser = useMemo(() => tasksByUser(periodTasks), [periodTasks]);

  // Heatmap: tasks por dia da semana × hora
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const t of periodTasks) {
      const d = new Date(t.completed_at);
      const dow = d.getDay();
      const h = d.getHours();
      grid[dow][h]++;
      if (grid[dow][h] > max) max = grid[dow][h];
    }
    return { grid, max };
  }, [periodTasks]);

  const activeCompanies = byCompany.filter((b) => b.completed > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-card">
        <div className="flex gap-1 p-1 rounded-lg bg-surface">
          {(["diario","semanal","mensal"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition ${
                period === p ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              }`}
            >{p}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {loading ? "Carregando…" : `${tasksCount} tarefas · ${hours.toFixed(1)}h trabalhadas`}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Produtividade" value={`${productivity}%`} icon={TrendingUp} accent="primary" hint={`período: ${period}`} />
        <StatCard label="Taxa de conclusão" value={`${completionRate}%`} icon={CheckCircle2} accent="success" hint={`${checklistDone}/${checklistTotal} checklist`} />
        <StatCard label="Tempo médio / tarefa" value={fmtTime(avgPerTaskMs)} icon={Timer} accent="info" hint="por execução" />
        <StatCard label="Empresas ativas" value={`${activeCompanies}/${COMPANIES.length}`} icon={Users} accent="warning" hint="com produção" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Produtividade ao longo do período</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="metG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="productivity" stroke="oklch(0.78 0.16 65)" strokeWidth={2} fill="url(#metG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Eficiência geral</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ name: "ef", value: productivity, fill: "oklch(0.78 0.16 65)" }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "oklch(0.28 0.014 240)" }} dataKey="value" cornerRadius={10} />
                <text x="50%" y="48%" textAnchor="middle" fontSize="32" fontWeight="700" fill="oklch(0.97 0.005 240)" fontFamily="Space Grotesk">
                  {productivity}%
                </text>
                <text x="50%" y="62%" textAnchor="middle" fontSize="11" fill="oklch(0.68 0.02 240)">
                  EFICIÊNCIA
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Tarefas por empresa</h3>
          {byCompany.every((b) => b.completed === 0) ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Sem tarefas concluídas no período.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCompany} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="company" type="category" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="completed" fill="oklch(0.78 0.16 65)" radius={[0, 4, 4, 0]} name="Concluídas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Tarefas por usuário</h3>
          {byUser.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Sem registros de usuários no período.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {byUser.slice(0, 8).map((u, i) => {
                const max = byUser[0].count;
                const pct = Math.round((u.count / max) * 100);
                return (
                  <li key={u.user}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium truncate">{i + 1}. {u.user}</span>
                      <span className="font-mono text-xs text-muted-foreground">{u.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-semibold mb-1">Heatmap de produção</h3>
        <p className="text-xs text-muted-foreground mb-4">Tarefas concluídas por dia da semana × hora</p>
        {heatmap.max === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sem dados suficientes para gerar o heatmap.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 text-[9px] text-muted-foreground mb-1">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center font-mono">{h % 3 === 0 ? String(h).padStart(2,"0") : ""}</div>
                ))}
              </div>
              {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((label, dow) => (
                <div key={label} className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 mb-0.5">
                  <div className="text-[10px] text-muted-foreground font-mono flex items-center">{label}</div>
                  {heatmap.grid[dow].map((v, h) => {
                    const intensity = v / heatmap.max;
                    return (
                      <div
                        key={h}
                        title={`${label} ${String(h).padStart(2,"0")}h: ${v} tarefa(s)`}
                        className="h-5 rounded-sm border border-border/30"
                        style={{
                          background: v === 0
                            ? "oklch(0.22 0.014 240)"
                            : `color-mix(in oklab, oklch(0.78 0.16 65) ${20 + intensity * 80}%, transparent)`,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-semibold mb-4">Progresso por empresa</h3>
        <div className="space-y-3">
          {byCompany.map((b) => {
            const max = Math.max(1, ...byCompany.map((x) => x.completed));
            const pct = Math.round((b.completed / max) * 100);
            return (
              <div key={b.company} className="flex items-center gap-4">
                <div className="w-28 shrink-0">
                  <CompanyTag company={b.company} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{b.completed} tarefas</span>
                    <span className="font-mono text-xs">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: COMPANY_COLORS[b.company] }}
                    />
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
