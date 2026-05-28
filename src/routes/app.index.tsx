import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  CheckCircle2,
  ListTodo,
  Factory,
  Clock,
  Timer,
  Activity,
  Calendar as CalendarIcon,
  Sparkles,
  ArrowRight,
  Boxes,
  Wallet,
  StickyNote,
  Zap,
  ChevronRight,
  BarChart3,
  KanbanSquare,
  ListChecks,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { COMPANIES, COMPANY_COLORS, type Company } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { supabase } from "@/integrations/supabase/client";
import { useOperationalData, buildDailySeries, tasksByCompany } from "@/lib/operations";
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

interface StockItemRow {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  company_id: string;
}

interface NoteRow {
  id: string;
  title: string;
  company: string | null;
  updated_at: string;
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  // Itens de estoque com baixa quantidade (<= 10)
  const [lowStock, setLowStock] = useState<StockItemRow[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("stock_items")
        .select("id, name, sku, quantity, company_id")
        .eq("workspace_id", user.id)
        .lte("quantity", 10)
        .order("quantity", { ascending: true })
        .limit(5);
      if (!cancelled) setLowStock((data ?? []) as StockItemRow[]);
    };
    load();
    const ch = supabase
      .channel(`dash_stock:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock_items",
          filter: `workspace_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  // Notas recentes
  const [recentNotes, setRecentNotes] = useState<NoteRow[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("notes")
        .select("id, title, company, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (!cancelled) setRecentNotes((data ?? []) as NoteRow[]);
    };
    load();
    const ch = supabase
      .channel(`dash_notes:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  // KPIs derivados de dados reais
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const weekStart = todayStart - 6 * 86400000;

  const kpis = useMemo(() => {
    const completedTotal = checklist.filter((t) => t.status === "done").length;
    const pending = checklist.filter((t) => t.status !== "done").length;
    const weekSessions = sessions.filter((s) => new Date(s.started_at).getTime() >= weekStart);
    const totalMs = weekSessions.reduce((a, s) => a + (s.total_ms ?? 0), 0);
    const productiveMs = weekSessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0);
    const productivity = totalMs > 0 ? Math.round((productiveMs / totalMs) * 100) : 0;
    const hours = totalMs / 3600000;
    const companies = new Set(
      sessionTasks
        .filter((t) => new Date(t.completed_at).getTime() >= weekStart)
        .map((t) => t.company),
    ).size;
    return {
      completedTotal,
      pending,
      productivity,
      hours,
      companies,
      weekSessions: weekSessions.length,
    };
  }, [checklist, sessions, sessionTasks, weekStart]);

  const series = useMemo(
    () => buildDailySeries(sessions, sessionTasks, 7),
    [sessions, sessionTasks],
  );
  const byCompany = useMemo(
    () =>
      tasksByCompany(sessionTasks.filter((t) => new Date(t.completed_at).getTime() >= weekStart)),
    [sessionTasks, weekStart],
  );
  const recent = useMemo(() => sessionTasks.slice(0, 8), [sessionTasks]);

  const KPI_DEFS = [
    {
      label: "Tarefas concluídas",
      value: String(kpis.completedTotal),
      hint: "checklist atual",
      icon: CheckCircle2,
      accent: "text-success",
      to: "/app/checklists" as const,
    },
    {
      label: "Tarefas pendentes",
      value: String(kpis.pending),
      hint: "aguardando ação",
      icon: ListTodo,
      accent: "text-warning",
      to: "/app/checklists" as const,
    },
    {
      label: "Produtividade 7d",
      value: `${kpis.productivity}%`,
      hint: "produtivo / total",
      icon: TrendingUp,
      accent: "text-primary",
      to: "/app" as const,
    },
    {
      label: "Horas trabalhadas",
      value: kpis.hours.toFixed(1) + "h",
      hint: "últimos 7 dias",
      icon: Timer,
      accent: "text-info",
      to: "/app" as const,
    },
    {
      label: "Empresas operadas",
      value: `${kpis.companies}/${COMPANIES.length}`,
      hint: "na semana",
      icon: Factory,
      accent: "text-warning",
      to: "/app/kanban" as const,
    },
    {
      label: "Sessões de ponto",
      value: String(kpis.weekSessions),
      hint: "últimos 7 dias",
      icon: Activity,
      accent: "text-info",
      to: "/app" as const,
    },
  ];

  const QUICK_CARDS = [
    {
      label: "Kanban",
      desc: "Visualize tarefas",
      icon: KanbanSquare,
      to: "/app/kanban" as const,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      label: "Checklists",
      desc: "Tarefas pendentes",
      icon: ListChecks,
      to: "/app/checklists" as const,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Notas",
      desc: `${recentNotes.length} recentes`,
      icon: StickyNote,
      to: "/app/notes" as const,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      label: "Estoque",
      desc: `${lowStock.length} itens baixos`,
      icon: Boxes,
      to: "/app/stock" as const,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
    {
      label: "Finanças",
      desc: "Controle financeiro",
      icon: Wallet,
      to: "/app/finance" as const,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
    },
    {
      label: "Calendário",
      desc: `${events.length} eventos`,
      icon: CalendarIcon,
      to: "/app/calendar" as const,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
  ];

  return (
    <div className="w-full min-w-0 max-w-[1600px] mx-auto p-3 sm:p-6 lg:p-10 space-y-5 md:space-y-8 overflow-x-hidden">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Cockpit
          </div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-1 leading-tight break-words">
            Bem-vindo,{" "}
            <span className="text-gradient">{user?.name?.split(" ")[0] ?? "executivo"}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Visão consolidada ·{" "}
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            to="/app/checklists"
            className="flex-1 md:flex-none text-center rounded-lg border border-border bg-surface/60 px-4 py-2 text-sm font-medium hover:bg-surface transition"
          >
            Abrir operação
          </Link>
          <Link
            to="/app/kanban"
            className="flex-1 md:flex-none justify-center rounded-lg bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow inline-flex items-center gap-1.5"
          >
            Kanban <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 md:gap-4 min-w-0">
        {KPI_DEFS.map((k) => (
          <Link
            key={k.label}
            to={k.to}
            className="group min-w-0 rounded-xl border border-border bg-card p-2.5 sm:p-4 md:p-5 shadow-card hover:border-primary/40 hover:shadow-[0_0_20px_-5px_rgba(79,70,229,0.15)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div
                className={`flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg bg-surface ${k.accent} group-hover:scale-110 transition-transform duration-300`}
              >
                <k.icon className="h-4 w-4" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
            <div className="mt-3 md:mt-4 font-display text-lg sm:text-xl md:text-2xl font-bold tracking-tight tabular-nums break-words leading-tight">
              {k.value}
            </div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground mt-1 leading-tight break-words">
              {k.label}
            </div>
            <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{k.hint}</div>
          </Link>
        ))}
      </section>

      {/* Quick Access Cards */}
      <section>
        <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Acesso rápido
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 md:gap-4 min-w-0">
          {QUICK_CARDS.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className={`group relative min-w-0 rounded-xl border ${c.border} ${c.bg} p-3 sm:p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden`}
            >
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                <c.icon className="h-10 w-10" />
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg bg-card/80 ${c.color} mb-3 group-hover:scale-105 transition-transform duration-300`}
              >
                <c.icon className="h-5 w-5" />
              </div>
              <div className="font-semibold text-sm">{c.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className={c.color}>Acessar</span>
                <ChevronRight
                  className={`h-3 w-3 ${c.color} group-hover:translate-x-0.5 transition-transform duration-300`}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6 min-w-0">
        {/* Produtividade semanal */}
        <Link
          to="/app"
          className="min-w-0 lg:col-span-2 rounded-xl border border-border bg-card shadow-card p-3 sm:p-5 block hover:border-primary/30 hover:shadow-[0_0_24px_-8px_rgba(79,70,229,0.12)] transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Produtividade semanal
              </h2>
              <p className="text-xs text-muted-foreground">
                Tempo produtivo vs. tempo total · últimos 7 dias
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">{kpis.productivity}%</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
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
                <CartesianGrid
                  stroke="oklch(0.28 0.014 240)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="oklch(0.6 0.02 240)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="oklch(0.6 0.02 240)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.014 240)",
                    border: "1px solid oklch(0.3 0.015 240)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="productivity"
                  stroke="oklch(0.78 0.16 65)"
                  strokeWidth={2}
                  fill="url(#dashG)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Link>

        {/* Progresso por empresa */}
        <Link
          to="/app/kanban"
          className="min-w-0 rounded-xl border border-border bg-card shadow-card p-3 sm:p-5 block hover:border-primary/30 hover:shadow-[0_0_24px_-8px_rgba(79,70,229,0.12)] transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-bold">Tarefas por empresa</h2>
              <p className="text-xs text-muted-foreground">Concluídas na semana</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all duration-300" />
          </div>
          <div className="mt-5 space-y-3">
            {byCompany.map((b) => {
              const max = Math.max(1, ...byCompany.map((x) => x.completed));
              const pct = Math.round((b.completed / max) * 100);
              const color = COMPANY_COLORS[b.company];
              return (
                <div key={b.company} className="group/bar">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <CompanyTag company={b.company} />
                    <span className="text-muted-foreground font-mono">{b.completed}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover/bar:brightness-110"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Link>
      </div>

      {/* Atividade recente + próximos eventos + estoque + notas */}
      <div className="grid lg:grid-cols-4 gap-4 md:gap-6 min-w-0">
        {/* Atividade recente */}
        <section className="min-w-0 lg:col-span-2 rounded-xl border border-border bg-card shadow-card p-3 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Atividade recente
            </h2>
            <div className="flex items-center gap-3">
              {recent.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                      title="Limpar histórico"
                    >
                      <Trash2 className="h-3 w-3" /> Limpar
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar histórico de atividade?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso remove permanentemente todas as tarefas concluídas registradas nas
                        sessões de ponto. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          if (!user?.id) return;
                          const { error } = await supabase
                            .from("ponto_session_tasks")
                            .delete()
                            .eq("user_id", user.id);
                          if (error) toast.error("Falha ao limpar histórico");
                          else toast.success("Histórico de atividade limpo");
                        }}
                      >
                        Limpar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Link
                to="/app/checklists"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Ver todos <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              {loading
                ? "Carregando…"
                : "Nenhuma atividade ainda. Inicie um expediente e conclua tarefas."}
            </div>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-3">
              {recent.map((e) => (
                <li key={e.id} className="ml-5 relative">
                  <span className="absolute -left-[21px] mt-1.5 h-2.5 w-2.5 rounded-full bg-success shadow-glow" />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(e.completed_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <CompanyTag company={e.company as Company} />
                    <span className="text-foreground truncate">{e.title}</span>
                    {e.user_name && (
                      <span className="text-xs text-muted-foreground">— {e.user_name}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Próximos eventos */}
        <Link
          to="/app/calendar"
          className="min-w-0 rounded-xl border border-border bg-card shadow-card p-3 sm:p-5 block hover:border-primary/30 hover:shadow-[0_0_24px_-8px_rgba(79,70,229,0.12)] transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-info" /> Próximos eventos
            </h2>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all duration-300" />
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
                  <div
                    key={e.id}
                    className="flex items-center gap-4 rounded-lg p-2.5 hover:bg-surface/50 transition"
                  >
                    <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-surface border border-border shrink-0">
                      <span className="text-[9px] uppercase text-muted-foreground tracking-wider">
                        {d.toLocaleDateString("pt-BR", { month: "short" })}
                      </span>
                      <span className="font-display font-bold text-lg leading-none">
                        {d.getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{e.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {e.event_time && (
                          <>
                            <Clock className="h-3 w-3" /> {e.event_time} ·{" "}
                          </>
                        )}
                        {e.type}
                      </div>
                    </div>
                    {e.company && <CompanyTag company={e.company as Company} />}
                  </div>
                );
              })}
            </div>
          )}
        </Link>

        {/* Estoque Baixo + Notas Recentes */}
        <div className="min-w-0 space-y-4 md:space-y-6">
          <Link
            to="/app/stock"
            className="min-w-0 rounded-xl border border-border bg-card shadow-card p-3 sm:p-5 block hover:border-rose-500/30 hover:shadow-[0_0_24px_-8px_rgba(244,63,94,0.12)] transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" /> Estoque baixo
              </h2>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
            {lowStock.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Nenhum item com estoque baixo.
              </div>
            ) : (
              <div className="space-y-2">
                {lowStock.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg p-2 hover:bg-rose-500/5 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-sm truncate">{item.name}</div>
                      {item.sku && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {item.sku}
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-bold text-rose-400 shrink-0">
                      {item.quantity} und
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Link>

          <Link
            to="/app/notes"
            className="min-w-0 rounded-xl border border-border bg-card shadow-card p-3 sm:p-5 block hover:border-amber-500/30 hover:shadow-[0_0_24px_-8px_rgba(245,158,11,0.12)] transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-amber-400" /> Notas recentes
              </h2>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
            {recentNotes.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma nota recente.
              </div>
            ) : (
              <div className="space-y-2">
                {recentNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center gap-2 rounded-lg p-2 hover:bg-amber-500/5 transition"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm truncate">{note.title}</div>
                    </div>
                    {note.company && <CompanyTag company={note.company as Company} />}
                  </div>
                ))}
              </div>
            )}
          </Link>
        </div>
      </div>

      {/* Resumo operacional do dia */}
      <section className="min-w-0 rounded-xl border border-border bg-card shadow-card p-3 sm:p-5 hover:border-primary/20 transition-colors duration-300">
        <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Resumo operacional de hoje
        </h2>
        <DailySummary />
      </section>
    </div>
  );
}

function DailySummary() {
  const { sessions, sessionTasks } = useOperationalData();
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const todayEnd = todayStart + 86400000;
  const todaySessions = sessions.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= todayStart && t < todayEnd;
  });
  const todayTasks = sessionTasks.filter((t) => {
    const ts = new Date(t.completed_at).getTime();
    return ts >= todayStart && ts < todayEnd;
  });
  const totalMs = todaySessions.reduce((a, s) => a + (s.total_ms ?? 0), 0);
  const productiveMs = todaySessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0);
  const companies = new Set(todayTasks.map((t) => t.company));

  const items = [
    {
      label: "Tarefas concluídas",
      value: String(todayTasks.length),
      to: "/app/checklists" as const,
    },
    { label: "Tempo trabalhado", value: fmtTime(totalMs), to: "/app" as const },
    { label: "Tempo produtivo", value: fmtTime(productiveMs), to: "/app" as const },
    { label: "Empresas operadas", value: `${companies.size}`, to: "/app/kanban" as const },
    { label: "Sessões de ponto", value: String(todaySessions.length), to: "/app" as const },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 min-w-0">
      {items.map((i) => (
        <Link
          key={i.label}
          to={i.to}
          className="group min-w-0 rounded-lg border border-border bg-surface/40 px-2.5 sm:px-3 py-3 hover:border-primary/30 hover:bg-surface/60 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
        >
          <div className="text-[9px] sm:text-[10px] uppercase tracking-wider sm:tracking-widest text-muted-foreground break-words leading-tight">
            {i.label}
          </div>
          <div className="font-display text-xl sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">
            {i.value}
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground/30 mt-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
        </Link>
      ))}
    </div>
  );
}
