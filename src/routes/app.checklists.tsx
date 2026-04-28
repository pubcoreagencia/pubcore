import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { COMPANIES, COMPANY_CHECKLISTS, COMPANY_COLORS } from "@/lib/mock-data";
import { CompanyTag } from "@/components/CompanyTag";

export const Route = createFileRoute("/app/checklists")({
  component: ChecklistsPage,
});

function ChecklistsPage() {
  const [state, setState] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setState((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação diária</div>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Checklists</h1>
        <p className="text-muted-foreground mt-1">Rotina diária de cada empresa da holding</p>
      </header>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {COMPANIES.map((company) => {
          const items = COMPANY_CHECKLISTS[company];
          const doneCount = items.filter((_, i) => state[`${company}-${i}`]).length;
          const pct = Math.round((doneCount / items.length) * 100);
          const color = COMPANY_COLORS[company];

          return (
            <div key={company} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="p-5 border-b border-border" style={{
                background: `linear-gradient(180deg, color-mix(in oklab, ${color} 8%, transparent), transparent)`,
              }}>
                <div className="flex items-center justify-between">
                  <CompanyTag company={company} />
                  <span className="font-mono text-xs text-muted-foreground">{doneCount}/{items.length}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full transition-all rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>

              <ul className="p-3 space-y-1">
                {items.map((text, i) => {
                  const key = `${company}-${i}`;
                  const checked = !!state[key];
                  return (
                    <li key={key}>
                      <button
                        onClick={() => toggle(key)}
                        className={`w-full flex items-start gap-3 rounded-lg p-3 text-left transition ${
                          checked ? "bg-surface/40" : "hover:bg-surface/50"
                        }`}
                      >
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                          checked ? "border-primary bg-gradient-primary" : "border-border bg-surface"
                        }`}>
                          {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                        </span>
                        <span className={`text-sm ${checked ? "line-through text-muted-foreground" : ""}`}>{text}</span>
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
}
