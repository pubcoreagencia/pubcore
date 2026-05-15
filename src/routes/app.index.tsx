import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, CheckCircle2, ListTodo, Factory, Clock, Timer,
  Activity, Calendar as CalendarIcon, Sparkles, ArrowRight,
  Boxes, Wallet, StickyNote, Zap, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { COMPANIES, COMPANY_COLORS, type Company } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { supabase } from "@/integrations/supabase/client";
import {
  useOperationalData, buildDailySeries, tasksByCompany,
} from "@/lib/operations";
import { fmtTime } from "@/lib/ponto";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

interface CalendarRow {
  id: string;
  title: string;
  type: string;
  company: string | null;
  event_date: string;
  event_time: string | null;
}

function Dashboard() {
  const { user } = useAuth();
  const { sessions, sessionTasks, checklist, loading } = useOperationalData();

  // Próximos eventos (calendar_events) com realtime
  const [events, setEvents] = useState<CalendarRow[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);
    const load = async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("id, title, type, company, event_date, event_time")
        .eq("user_id", user.id)
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(8);
      if (!cancelled) setEvents((data ?? []) as CalendarRow[]);
    };
    load();
    const ch = supabase
      .channel(`dash_calendar:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user?.id]);

  // KPIs derivados de dados reais
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const weekStart = todayStart - 6 * 86400000;

  const kpis = useMemo(() => {
    const completedTotal = checklist.filter((t) => t.status === "done").length;
    const pending = checklist.filter((t) => t.status !== "done").length;
    const weekSessions = sessions.filter((s) => new Date(s.started_at).getTime() >= weekStart);
    const totalMs = weekSessions.reduce((a, s) => a + (s.total_ms ?? 0), 0);
    const productiveMs = weekSessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0);
    const productivity = totalMs > 0 ? Math.round((productiveMs / totalMs) * 100) : 0;
    const hours = totalMs / 3600000;
    const companies = new Set(sessionTasks.filter((t) => new Date(t.completed_at).getTime() >= weekStart).map((t) => t.company)).size;
    return { completedTotal, pending, productivity, hours, companies, weekSessions: weekSessions.length };
  }, [checklist, sessions, sessionTasks, weekStart]);

  const series = useMemo(() => buildDailySeries(sessions, sessionTasks, 7), [sessions, sessionTasks]);
  const byCompany = useMemo(() => tasksByCompany(sessionTasks.filter((t) => new Date(t.completed_at).getTime() >= weekStart)), [sessionTasks, weekStart]);
  const recent = useMemo(() => sessionTasks.slice(0, 8), [sessionTasks]);

  const KPI_DEFS = [
    { label: "Tarefas concluídas", value: String(kpis.completedTotal), hint: "checklist atual", icon: CheckCircle2, accent: "text-success", to: "/app/checklists" as const },
    { label: "Tarefas pendentes", value: String(kpis.pending), hint: "aguardando ação", icon: ListTodo, accent: "text-warning", to: "/app/checklists" as const, filter: "pending" },
    { label: "Produtividade 7d", value: `${kpis.productivity}%`, hint: "produtivo / total", icon: TrendingUp, accent: "text-primary", to: "/app" as const },
    { label: "Horas trabalhadas", value: kpis.hours.toFixed(1) + "h", hint: "últimos 7 dias", icon: Timer, accent: "text-info", to: "/app" as const },
    { label: "Empresas operadas", value: `${kpis.companies}/${COMPANIES.length}`, hint: "na semana", icon: Factory, accent: "text-warning", to: "/app/kanban" as const },
    { label: "Sessões de ponto", value: String(kpis.weekSessions), hint: "últimos 7 dias", icon: Activity, accent: "text-info", to: "/app" as const },
  ];

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cockpit</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">
            Bem-vindo, <span className="text-gradient">{user?.name?.split(" ")[0] ?? "executivo"}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão consolidada da operação · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/checklists" className="rounded-lg border border-border bg-surface/60 px-4 py-2 text-sm font-medium hover:bg-surface transition">
            Abrir operação
          </Link>
          <Link to="/app/kanban" className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow inline-flex items-center gap-1.5">
            Kanban <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_DEFS.map((k) => (
          <Link
            key={k.label}
            to={k.to}
            className="group rounded-xl border border-border bg-card p-5 shadow-card hover:border-primary/40 hover:shadow-[0_0_20px_-5px_rgba(79,70,229,0.15)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-surface ${k.accent} group-hover:scale-110 transition-transform duration-300`}>
                <k.icon className="h-4 w-4" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
            <div className="mt-4 font-display text-2xl font-bold tracking-tight tabular-nums">{k.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{k.label}</div>
            <div className="text-[10px] text-muted-foreground/70 mt-0.5">{k.hint}</div>
          </Link>
        ))}
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Produtividade semanal */}
        <section className="lg:col-span-2 rounded-xl border border-border bg-card shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-bold">Produtividade semanal</h2>
              <p className="text-xs text-muted-foreground">Tempo produtivo vs. tempo total · últimos 7 dias</p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">{kpis.productivity}%</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="dashG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="productivity" stroke="oklch(0.78 0.16 65)" strokeWidth={2} fill="url(#dashG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Progresso por empresa */}
        <section className="rounded-xl border border-border bg-card shadow-card p-5">
          <h2 className="font-display text-lg font-bold">Tarefas por empresa</h2>
          <p className="text-xs text-muted-foreground">Concluídas na semana</p>
          <div className="mt-5 space-y-3">
            {byCompany.map((b) => {
              const max = Math.max(1, ...byCompany.map((x) => x.completed));
              const pct = Math.round((b.completed / max) * 100);
              const color = COMPANY_COLORS[b.company];
              return (
                <div key={b.company}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <CompanyTag company={b.company} />
                    <span className="text-muted-foreground font-mono">{b.completed}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Atividade recente + próximos eventos */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Atividade recente
            </h2>
            <span className="text-xs text-muted-foreground">{recent.length} eventos</span>
          </div>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              {loading ? "Carregando…" : "Nenhuma atividade ainda. Inicie um expediente e conclua tarefas."}
            </div>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-3">
              {recent.map((e) => (
                <li key={e.id} className="ml-5">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-success shadow-glow" />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(e.completed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <CompanyTag company={e.company as Company} />
                    <span className="text-foreground truncate">{e.title}</span>
                    {e.user_name && <span className="text-xs text-muted-foreground">— {e.user_name}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-info" /> Próximos eventos
            </h2>
            <Link to="/app/calendar" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              Nenhum evento agendado.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => {
                const d = new Date(e.event_date + "T00:00:00");
                return (
                  <div key={e.id} className="flex items-center gap-4 rounded-lg p-2.5 hover:bg-surface/50 transition">
                    <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-surface border border-border shrink-0">
                      <span className="text-[9px] uppercase text-muted-foreground tracking-wider">{d.toLocaleDateString("pt-BR",{month:"short"})}</span>
                      <span className="font-display font-bold text-lg leading-none">{d.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{e.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {e.event_time && <><Clock className="h-3 w-3" /> {e.event_time} · </>}{e.type}
                      </div>
                    </div>
                    {e.company && <CompanyTag company={e.company as Company} />}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Resumo operacional do dia */}
      <section className="rounded-xl border border-border bg-card shadow-card p-5">
        <h2 className="font-display text-lg font-bold mb-4">Resumo operacional de hoje</h2>
        <DailySummary />
      </section>
    </div>
  );
}

function DailySummary() {
  const { sessions, sessionTasks } = useOperationalData();
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const todayEnd = todayStart + 86400000;
  const todaySessions = sessions.filter((s) => { const t = new Date(s.started_at).getTime(); return t >= todayStart && t < todayEnd; });
  const todayTasks = sessionTasks.filter((t) => { const ts = new Date(t.completed_at).getTime(); return ts >= todayStart && ts < todayEnd; });
  const totalMs = todaySessions.reduce((a, s) => a + (s.total_ms ?? 0), 0);
  const productiveMs = todaySessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0);
  const companies = new Set(todayTasks.map((t) => t.company));

  const items = [
    { label: "Tarefas concluídas", value: String(todayTasks.length) },
    { label: "Tempo trabalhado", value: fmtTime(totalMs) },
    { label: "Tempo produtivo", value: fmtTime(productiveMs) },
    { label: "Empresas operadas", value: `${companies.size}` },
    { label: "Sessões de ponto", value: String(todaySessions.length) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border border-border bg-surface/40 px-3 py-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{i.label}</div>
          <div className="font-display text-2xl font-bold tabular-nums mt-1">{i.value}</div>
        </div>
      ))}
    </div>
  );
}
