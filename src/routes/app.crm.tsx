import { createFileRoute } from "@tanstack/react-router";
import { Mail, Building2, Plus } from "lucide-react";
import { LEADS, type Lead } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";

export const Route = createFileRoute("/app/crm")({
  component: CRMPage,
});

const STAGES: Lead["stage"][] = ["Novo", "Qualificado", "Proposta", "Negociação", "Fechado"];

const stageColor: Record<Lead["stage"], string> = {
  "Novo": "text-muted-foreground",
  "Qualificado": "text-info",
  "Proposta": "text-warning",
  "Negociação": "text-primary",
  "Fechado": "text-success",
};

function CRMPage() {
  const total = LEADS.reduce((s, l) => s + l.value, 0);
  const closed = LEADS.filter((l) => l.stage === "Fechado").reduce((s, l) => s + l.value, 0);

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pipeline comercial</div>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">CRM</h1>
          <p className="text-muted-foreground mt-1">{LEADS.length} oportunidades · pipeline de R$ {(total/1000).toFixed(0)}k</p>
        </div>
        <button className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo lead
        </button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { l: "Pipeline total", v: `R$ ${(total/1000).toFixed(0)}k`, c: "text-primary" },
          { l: "Fechado", v: `R$ ${(closed/1000).toFixed(0)}k`, c: "text-success" },
          { l: "Em negociação", v: LEADS.filter((l) => l.stage === "Negociação").length, c: "text-warning" },
          { l: "Taxa de conversão", v: "37%", c: "text-info" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.l}</div>
            <div className={`mt-2 font-display text-2xl font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const items = LEADS.filter((l) => l.stage === stage);
          const sum = items.reduce((s, l) => s + l.value, 0);
          return (
            <div key={stage} className="rounded-xl border border-border bg-surface/40 p-3">
              <div className="flex items-center justify-between px-1 py-2 mb-2">
                <h3 className={`font-semibold text-sm uppercase tracking-wider ${stageColor[stage]}`}>{stage}</h3>
                <span className="text-xs text-muted-foreground font-mono">{items.length}</span>
              </div>
              <div className="text-xs text-muted-foreground px-1 mb-3 font-mono">R$ {(sum/1000).toFixed(0)}k</div>

              <div className="space-y-2">
                {items.map((l) => (
                  <article key={l.id} className="rounded-lg border border-border bg-card p-3 shadow-card hover:border-primary/40 transition cursor-pointer">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-bold text-xs shrink-0">
                        {l.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{l.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0" /> {l.company}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <CompanyTag company={l.owner} />
                      <span className="text-xs font-mono font-semibold text-foreground">R$ {(l.value/1000).toFixed(0)}k</span>
                    </div>
                  </article>
                ))}
                {items.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-6">Nenhum lead</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
