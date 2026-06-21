import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { type Company } from "@/lib/mock-data";
import { useChecklistCompanies } from "@/lib/checklist-companies";
import { CompanyTag } from "@/components/CompanyTag";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity-log";
import { ShareButton } from "@/components/ShareButton";

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
  const { activeWorkspaceId } = useWorkspace();
  const userId = user?.id;
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const { companies } = useChecklistCompanies();
  const companyNames = companies.map((c) => c.name);
  const [events, setEvents] = useState<Ev[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ title: string; type: EvType; company: Company; event_date: string; event_time: string }>({
    title: "", type: "Reunião", company: "", event_date: today.toISOString().slice(0, 10), event_time: "09:00",
  });

  useEffect(() => {
    if (!userId || !activeWorkspaceId) return;
    const load = async () => {
      const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const end = `${month === 11 ? year + 1 : year}-${String(((month + 1) % 12) + 1).padStart(2, "0")}-01`;
      const { data } = await supabase.from("calendar_events").select("*")
        .eq("workspace_id", activeWorkspaceId).gte("event_date", start).lt("event_date", end)
        .order("event_date").order("event_time");
      setEvents((data ?? []) as Ev[]);
    };
    load();
    const ch = supabase.channel(`cal:${activeWorkspaceId}:${year}-${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events", filter: `workspace_id=eq.${activeWorkspaceId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, activeWorkspaceId, month, year]);

  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const monthName = new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const move = (d: number) => { const m = month + d; if (m < 0) { setMonth(11); setYear(year - 1); } else if (m > 11) { setMonth(0); setYear(year + 1); } else setMonth(m); };

  const create = async () => {
    if (!draft.title.trim() || !userId || !activeWorkspaceId) return;
    const { error } = await supabase.from("calendar_events").insert({
      workspace_id: activeWorkspaceId,
      user_id: userId, title: draft.title.trim(), type: draft.type,
      company: draft.company, event_date: draft.event_date, event_time: draft.event_time,
    } as never);
    if (error) toast.error(error.message); else { setOpen(false); setDraft({ ...draft, title: "" }); }
  };

  const remove = async (id: string) => {
    const ev = events.find((e) => e.id === id);
    await supabase.from("calendar_events").delete().eq("id", id);
    if (ev) await logActivity({
      entity_type: "calendar_event", entity_id: id, action: "deleted",
      title: ev.title, company: ev.company,
      payload: { type: ev.type, event_date: ev.event_date, event_time: ev.event_time },
    });
  };

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação</div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mt-1">Calendário</h1>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => move(-1)} className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-elevated flex-shrink-0"><ChevronLeft className="h-4 w-4" /></button>
          <div className="px-3 py-2 rounded-lg border border-border bg-surface font-display font-semibold capitalize text-sm sm:text-base flex-1 sm:flex-none sm:min-w-[180px] text-center truncate">{monthName}</div>
          <button onClick={() => move(1)} className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-elevated flex-shrink-0"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => setOpen(true)} className="rounded-lg bg-gradient-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-glow flex items-center gap-2 flex-shrink-0"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Evento</span></button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 sm:gap-6">
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface/50">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
              <div key={d} className="p-1.5 sm:p-3 text-center text-[9px] sm:text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                <span className="sm:hidden">{d.charAt(0)}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const dayEvents = d ? events.filter((e) => parseInt(e.event_date.slice(8, 10), 10) === d) : [];
              return (
                <div key={i} className={`min-h-[60px] sm:min-h-[110px] border-r border-b border-border p-1 sm:p-2 ${!d ? "bg-surface/20" : "hover:bg-surface/30 transition"}`}>
                  {d && (
                    <>
                      <div className={`text-[10px] sm:text-xs font-mono ${isToday ? "inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}>{d}</div>
                      <div className="mt-0.5 sm:mt-1 space-y-0.5 sm:space-y-1">
                        {/* Mobile: dots only */}
                        <div className="flex flex-wrap gap-0.5 sm:hidden">
                          {dayEvents.slice(0, 4).map((e) => (
                            <span key={e.id} className={`h-1.5 w-1.5 rounded-full border ${TYPE_COLOR[e.type]}`} />
                          ))}
                        </div>
                        {/* Desktop: text rows */}
                        <div className="hidden sm:block space-y-1">
                          {dayEvents.slice(0, 2).map((e) => (
                            <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${TYPE_COLOR[e.type]}`}>{e.event_time?.slice(0,5)} {e.title}</div>
                          ))}
                          {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 2}</div>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="rounded-xl border border-border bg-card shadow-card p-4 sm:p-5 h-fit">
          <h3 className="font-display font-bold text-base sm:text-lg">Agenda do mês</h3>
          <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 max-h-[400px] lg:max-h-[600px] overflow-auto pr-1">
            {events.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Nenhum evento</div>}
            {events.map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-surface/40 p-3 group">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${TYPE_COLOR[e.type]} truncate`}>{e.type}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">{e.event_date.slice(8,10)} · {e.event_time?.slice(0,5)}</span>
                    <ShareButton itemType="calendar_event" itemId={e.id} itemTitle={e.title} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-primary p-1 -m-1 inline-flex" />
                    <button onClick={() => remove(e.id)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 -m-1"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
                <div className="mt-2 font-medium text-sm break-words">{e.title}</div>
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
                <option value="">Sem empresa</option>
                {companyNames.map((c) => <option key={c}>{c}</option>)}
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
