import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { COMPANIES, type Company } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/calendar")({ component: CalendarPage });

const TYPES = ["Reunião", "Campanha", "Entrega", "Produção"] as const;
type EvType = typeof TYPES[number];

const TYPE_COLOR: Record<EvType, string> = {
  "Reunião": "bg-info/15 text-info border-info/30",
  "Campanha": "bg-warning/15 text-warning border-warning/30",
  "Entrega": "bg-success/15 text-success border-success/30",
  "Produção": "bg-primary/15 text-primary border-primary/30",
};

interface Ev {
  id: string;
  title: string;
  type: EvType;
  company: Company | null;
  event_date: string;
  event_time: string | null;
}

function CalendarPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [events, setEvents] = useState<Ev[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ title: string; type: EvType; company: Company; event_date: string; event_time: string }>({
    title: "", type: "Reunião", company: COMPANIES[0], event_date: today.toISOString().slice(0, 10), event_time: "09:00",
  });

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const end = `${month === 11 ? year + 1 : year}-${String(((month + 1) % 12) + 1).padStart(2, "0")}-01`;
      const { data } = await supabase.from("calendar_events").select("*")
        .eq("user_id", userId).gte("event_date", start).lt("event_date", end)
        .order("event_date").order("event_time");
      setEvents((data ?? []) as Ev[]);
    };
    load();
    const ch = supabase.channel(`cal:${userId}:${year}-${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, month, year]);

  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const monthName = new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const move = (d: number) => { const m = month + d; if (m < 0) { setMonth(11); setYear(year - 1); } else if (m > 11) { setMonth(0); setYear(year + 1); } else setMonth(m); };

  const create = async () => {
    if (!draft.title.trim() || !userId) return;
    const { error } = await supabase.from("calendar_events").insert({
      user_id: userId, title: draft.title.trim(), type: draft.type,
      company: draft.company, event_date: draft.event_date, event_time: draft.event_time,
    } as never);
    if (error) toast.error(error.message); else { setOpen(false); setDraft({ ...draft, title: "" }); }
  };

  const remove = async (id: string) => { await supabase.from("calendar_events").delete().eq("id", id); };

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Calendário</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(true)} className="rounded-lg bg-gradient-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-glow flex items-center gap-2"><Plus className="h-4 w-4" /> Evento</button>
          <button onClick={() => move(-1)} className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-elevated"><ChevronLeft className="h-4 w-4" /></button>
          <div className="px-4 py-2 rounded-lg border border-border bg-surface font-display font-semibold capitalize min-w-[180px] text-center">{monthName}</div>
          <button onClick={() => move(1)} className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-elevated"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface/50">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
              <div key={d} className="p-3 text-center text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const dayEvents = d ? events.filter((e) => parseInt(e.event_date.slice(8, 10), 10) === d) : [];
              return (
                <div key={i} className={`min-h-[110px] border-r border-b border-border p-2 ${!d ? "bg-surface/20" : "hover:bg-surface/30 transition"}`}>
                  {d && (
                    <>
                      <div className={`text-xs font-mono ${isToday ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}>{d}</div>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((e) => (
                          <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${TYPE_COLOR[e.type]}`}>{e.event_time?.slice(0,5)} {e.title}</div>
                        ))}
                        {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 2}</div>}
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
            {events.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Nenhum evento</div>}
            {events.map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-surface/40 p-3 group">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${TYPE_COLOR[e.type]}`}>{e.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{e.event_date.slice(8,10)} · {e.event_time?.slice(0,5)}</span>
                    <button onClick={() => remove(e.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
                <div className="mt-2 font-medium text-sm">{e.title}</div>
                {e.company && <div className="mt-2"><CompanyTag company={e.company} /></div>}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-elegant space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Novo evento</h2>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Título" className="w-full bg-surface rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="grid grid-cols-2 gap-3">
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as EvType })} className="bg-surface rounded-lg px-3 py-2 text-sm">
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value as Company })} className="bg-surface rounded-lg px-3 py-2 text-sm">
                {COMPANIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="date" value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} className="bg-surface rounded-lg px-3 py-2 text-sm" />
              <input type="time" value={draft.event_time} onChange={(e) => setDraft({ ...draft, event_time: e.target.value })} className="bg-surface rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={create} className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow">Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
