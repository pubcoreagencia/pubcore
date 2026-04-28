import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EVENTS, type CalendarEvent } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarPage,
});

const TYPE_COLOR: Record<CalendarEvent["type"], string> = {
  "Reunião": "bg-info/15 text-info border-info/30",
  "Campanha": "bg-warning/15 text-warning border-warning/30",
  "Entrega": "bg-success/15 text-success border-success/30",
  "Produção": "bg-primary/15 text-primary border-primary/30",
};

function CalendarPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  const monthName = new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const move = (dir: number) => {
    const m = month + dir;
    if (m < 0) { setMonth(11); setYear(year - 1); }
    else if (m > 11) { setMonth(0); setYear(year + 1); }
    else setMonth(m);
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Calendário</h1>
          <p className="text-muted-foreground mt-1">Reuniões · Campanhas · Entregas · Produção</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-elevated transition"><ChevronLeft className="h-4 w-4" /></button>
          <div className="px-4 py-2 rounded-lg border border-border bg-surface font-display font-semibold capitalize min-w-[180px] text-center">{monthName}</div>
          <button onClick={() => move(1)} className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-elevated transition"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface/50">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="p-3 text-center text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const dayEvents = d ? EVENTS.filter((e) => e.day === d) : [];
              return (
                <div key={i} className={`min-h-[110px] border-r border-b border-border p-2 ${!d ? "bg-surface/20" : "hover:bg-surface/30 transition"}`}>
                  {d && (
                    <>
                      <div className={`text-xs font-mono ${isToday ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}>{d}</div>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((e) => (
                          <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${TYPE_COLOR[e.type]}`}>
                            {e.time} {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="rounded-xl border border-border bg-card shadow-card p-5 h-fit">
          <h3 className="font-display font-bold text-lg">Agenda do mês</h3>
          <div className="mt-4 space-y-3 max-h-[600px] overflow-auto pr-1">
            {EVENTS.sort((a, b) => a.day - b.day).map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-surface/40 p-3 hover:bg-surface transition">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${TYPE_COLOR[e.type]}`}>{e.type}</span>
                  <span className="text-xs font-mono text-muted-foreground">dia {e.day} · {e.time}</span>
                </div>
                <div className="mt-2 font-medium text-sm">{e.title}</div>
                <div className="mt-2"><CompanyTag company={e.company} /></div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
