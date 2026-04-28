import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, CheckCircle2, Megaphone, Factory, ArrowUpRight, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { INITIAL_CARDS, EVENTS, COMPANIES } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { PriorityBadge } from "@/components/PriorityBadge";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

const kpis = [
  { label: "Receita do mês", value: "R$ 2.84M", delta: "+12.4%", icon: TrendingUp, accent: "text-success" },
  { label: "Tarefas concluídas", value: "184", delta: "+8.1%", icon: CheckCircle2, accent: "text-info" },
  { label: "Campanhas ativas", value: "12", delta: "+3", icon: Megaphone, accent: "text-warning" },
  { label: "Produção (un.)", value: "9.412", delta: "+5.7%", icon: Factory, accent: "text-primary" },
];

function Dashboard() {
  const { user } = useAuth();
  const today = INITIAL_CARDS.filter((c) => c.column === "Hoje" || c.column === "Em andamento").slice(0, 5);
  const upcoming = [...EVENTS].sort((a, b) => a.day - b.day).slice(0, 5);

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cockpit</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">
            Bem-vindo, <span className="text-gradient">{user?.name?.split(" ")[0] ?? "executivo"}</span>
          </h1>
          <p className="text-muted-foreground mt-1">Visão consolidada da holding · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-border bg-surface/60 px-4 py-2 text-sm font-medium hover:bg-surface transition">Exportar</button>
          <button className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow">Nova tarefa</button>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="group rounded-xl border border-border bg-card p-5 shadow-card hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface ${k.accent}`}>
                <k.icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-semibold ${k.accent} flex items-center gap-0.5`}>
                <ArrowUpRight className="h-3 w-3" />{k.delta}
              </span>
            </div>
            <div className="mt-4 font-display text-3xl font-bold tracking-tight">{k.value}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{k.label}</div>
          </div>
        ))}
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tarefas do dia */}
        <section className="lg:col-span-2 rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="font-display text-lg font-bold">Tarefas do dia</h2>
              <p className="text-xs text-muted-foreground">Em andamento e prioritárias</p>
            </div>
            <span className="text-xs text-muted-foreground">{today.length} ativas</span>
          </div>
          <div className="divide-y divide-border">
            {today.map((t) => (
              <div key={t.id} className="p-4 hover:bg-surface/50 transition flex items-center gap-4">
                <div className="h-8 w-1 rounded-full bg-gradient-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <CompanyTag company={t.company} />
                    <PriorityBadge priority={t.priority} />
                    <span className="text-xs text-muted-foreground">· {t.assignee}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Produção por empresa */}
        <section className="rounded-xl border border-border bg-card shadow-card p-5">
          <h2 className="font-display text-lg font-bold">Produção por empresa</h2>
          <p className="text-xs text-muted-foreground">Carga operacional atual</p>
          <div className="mt-5 space-y-3">
            {COMPANIES.map((c) => {
              const count = INITIAL_CARDS.filter((card) => card.company === c).length;
              const pct = Math.min(100, count * 25 + 20);
              return (
                <div key={c}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <CompanyTag company={c} />
                    <span className="text-muted-foreground font-mono">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-gradient-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Campanhas + Calendário */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Campanhas em destaque</h2>
            <Megaphone className="h-4 w-4 text-warning" />
          </div>
          <div className="mt-4 space-y-3">
            {EVENTS.filter((e) => e.type === "Campanha").map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-surface/40 p-4 hover:bg-surface transition">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{c.title}</div>
                  <span className="text-xs text-muted-foreground font-mono">dia {c.day}</span>
                </div>
                <div className="mt-2"><CompanyTag company={c.company} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Próximos eventos</h2>
            <Clock className="h-4 w-4 text-info" />
          </div>
          <div className="mt-4 space-y-2">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center gap-4 rounded-lg p-2.5 hover:bg-surface/50 transition">
                <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-surface border border-border shrink-0">
                  <span className="text-[9px] uppercase text-muted-foreground tracking-wider">DIA</span>
                  <span className="font-display font-bold text-lg leading-none">{e.day}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{e.time} · {e.type}</div>
                </div>
                <CompanyTag company={e.company} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
