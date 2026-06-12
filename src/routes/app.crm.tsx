import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { type Company } from "@/lib/mock-data";
import { useChecklistCompanies } from "@/lib/checklist-companies";
import { CompanyTag } from "@/components/CompanyTag";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/app/crm")({ component: CRMPage });

const STAGES = ["Novo", "Qualificado", "Proposta", "Negociação", "Fechado"] as const;
type Stage = typeof STAGES[number];

const stageColor: Record<Stage, string> = {
  "Novo": "text-muted-foreground",
  "Qualificado": "text-info",
  "Proposta": "text-warning",
  "Negociação": "text-primary",
  "Fechado": "text-success",
};

interface Lead {
  id: string;
  name: string;
  company: string | null;
  owner: Company | null;
  stage: Stage;
  value: number;
}

function CRMPage() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const userId = user?.id;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [drag, setDrag] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ name: string; company: string; owner: Company; value: string }>({
    name: "", company: "", owner: (COMPANIES[0] ?? ""), value: "",
  });

  useEffect(() => {
    if (!userId || !activeWorkspaceId) return;
    const load = async () => {
      const { data } = await supabase.from("crm_leads").select("*").eq("workspace_id", activeWorkspaceId).order("created_at", { ascending: false });
      setLeads((data ?? []) as Lead[]);
    };
    load();
    const ch = supabase.channel(`crm:${activeWorkspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads", filter: `workspace_id=eq.${activeWorkspaceId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, activeWorkspaceId]);

  const onDrop = async (stage: Stage) => {
    if (!drag) return;
    setLeads((ls) => ls.map((l) => l.id === drag ? { ...l, stage } : l));
    await supabase.from("crm_leads").update({ stage }).eq("id", drag);
    setDrag(null);
  };

  const create = async () => {
    if (!draft.name.trim() || !userId || !activeWorkspaceId) return;
    const { error } = await supabase.from("crm_leads").insert({
      workspace_id: activeWorkspaceId,
      user_id: userId, name: draft.name.trim(), company: draft.company || null,
      owner: draft.owner, stage: "Novo", value: Number(draft.value) || 0,
    } as never);
    if (error) toast.error(error.message); else { setOpen(false); setDraft({ name: "", company: "", owner: (COMPANIES[0] ?? ""), value: "" }); }
  };

  const remove = async (id: string) => {
    const lead = leads.find((l) => l.id === id);
    await supabase.from("crm_leads").delete().eq("id", id);
    if (lead) await logActivity({
      entity_type: "crm_lead", entity_id: id, action: "deleted",
      title: lead.name, company: lead.owner ?? lead.company ?? null,
      payload: { stage: lead.stage, value: lead.value },
    });
  };

  const total = leads.reduce((s, l) => s + Number(l.value), 0);
  const closed = leads.filter((l) => l.stage === "Fechado").reduce((s, l) => s + Number(l.value), 0);

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="flex items-start sm:items-end justify-between mb-4 sm:mb-6 flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Pipeline comercial</div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mt-1">CRM</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{leads.length} oportunidades · R$ {(total/1000).toFixed(0)}k</p>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-lg bg-gradient-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-glow flex items-center gap-2 flex-shrink-0">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo lead</span><span className="sm:hidden">Lead</span>
        </button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-5 sm:mb-8">
        {[
          { l: "Pipeline total", v: `R$ ${(total/1000).toFixed(0)}k`, c: "text-primary" },
          { l: "Fechado", v: `R$ ${(closed/1000).toFixed(0)}k`, c: "text-success" },
          { l: "Em negociação", v: leads.filter((l) => l.stage === "Negociação").length, c: "text-warning" },
          { l: "Conversão", v: `${leads.length ? Math.round((leads.filter((l) => l.stage === "Fechado").length / leads.length) * 100) : 0}%`, c: "text-info" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-card min-w-0">
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground truncate">{k.l}</div>
            <div className={`mt-1.5 sm:mt-2 font-display text-lg sm:text-2xl font-bold truncate ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </section>

      <div className="flex md:grid md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none -mx-3 sm:mx-0 px-3 sm:px-0 pb-2">
        {STAGES.map((stage) => {
          const items = leads.filter((l) => l.stage === stage);
          const sum = items.reduce((s, l) => s + Number(l.value), 0);
          return (
            <div key={stage} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(stage)}
              className="snap-start flex-shrink-0 w-[85vw] max-w-[320px] md:w-auto md:max-w-none rounded-xl border border-border bg-surface/40 p-3 min-h-[280px] sm:min-h-[300px]">
              <div className="flex items-center justify-between px-1 py-2 mb-2">
                <h3 className={`font-semibold text-sm uppercase tracking-wider ${stageColor[stage]}`}>{stage}</h3>
                <span className="text-xs text-muted-foreground font-mono">{items.length}</span>
              </div>
              <div className="text-xs text-muted-foreground px-1 mb-3 font-mono">R$ {(sum/1000).toFixed(0)}k</div>
              <div className="space-y-2">
                {items.map((l) => (
                  <article key={l.id} draggable onDragStart={() => setDrag(l.id)}
                    className="group rounded-lg border border-border bg-card p-3 shadow-card hover:border-primary/40 transition cursor-grab">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-bold text-xs shrink-0">
                        {l.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{l.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0" /> {l.company || "—"}
                        </div>
                      </div>
                      <button onClick={() => remove(l.id)} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 -m-1 flex-shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {l.owner && <CompanyTag company={l.owner} />}
                      <span className="text-xs font-mono font-semibold">R$ {(Number(l.value)/1000).toFixed(0)}k</span>
                    </div>
                  </article>
                ))}
                {items.length === 0 && <div className="text-center text-xs text-muted-foreground py-6">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-elegant space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold">Novo lead</h2>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome do contato" className="w-full bg-surface rounded-lg px-3 py-2 text-sm" />
            <input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} placeholder="Empresa" className="w-full bg-surface rounded-lg px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <select value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value as Company })} className="bg-surface rounded-lg px-3 py-2 text-sm">
                {COMPANIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="number" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="Valor R$" className="bg-surface rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={create} className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow">Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
