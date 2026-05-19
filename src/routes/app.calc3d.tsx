import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Box, Save, Plus, Trash2, Copy, History, Sparkles,
  Zap, Wrench, Package, Clock, DollarSign, TrendingUp, Percent,
  ChevronDown, X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/app/calc3d")({
  component: Calc3DPage,
});

type Inputs = {
  weight: number;
  printHours: number;
  printMinutes: number;
  quantity: number;
  failureRate: number;
  complexity: number;
  filamentCostKg: number;
  filamentType: string;
  powerW: number;
  kwhPrice: number;
  machineHourCost: number;
  laborHourCost: number;
  laborMinutes: number;
  packaging: number;
  shipping: number;
  postProcessing: number;
  extras: number;
  marginPct: number;
  commissionPct: number;
  taxesPct: number;
};

type Project = {
  id: string;
  name: string;
  inputs: Inputs;
  createdAt: number;
  updatedAt: number;
};

const PRESETS: Record<string, { costKg: number; label: string }> = {
  PLA: { costKg: 110, label: "PLA" },
  "PLA+": { costKg: 130, label: "PLA+" },
  PETG: { costKg: 140, label: "PETG" },
  ABS: { costKg: 120, label: "ABS" },
  TPU: { costKg: 180, label: "TPU" },
  ASA: { costKg: 170, label: "ASA" },
  NYLON: { costKg: 260, label: "Nylon" },
  RESIN: { costKg: 320, label: "Resina" },
};

const DEFAULTS: Inputs = {
  weight: 50,
  printHours: 3,
  printMinutes: 30,
  quantity: 1,
  failureRate: 5,
  complexity: 2,
  filamentCostKg: 110,
  filamentType: "PLA",
  powerW: 180,
  kwhPrice: 0.95,
  machineHourCost: 2.5,
  laborHourCost: 30,
  laborMinutes: 15,
  packaging: 2,
  shipping: 0,
  postProcessing: 0,
  extras: 0,
  marginPct: 60,
  commissionPct: 0,
  taxesPct: 6,
};

const STORAGE_KEY = "pubcore:calc3d:projects";
const CURRENT_KEY = "pubcore:calc3d:current";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function computeResults(i: Inputs) {
  const totalHours = i.printHours + i.printMinutes / 60;
  const qty = Math.max(1, i.quantity);
  const grossWeight = i.weight * (1 + i.failureRate / 100);
  const materialPerUnit = (grossWeight / 1000) * i.filamentCostKg;
  const energyPerUnit = (i.powerW / 1000) * totalHours * i.kwhPrice;
  const machinePerUnit = totalHours * i.machineHourCost;
  const laborPerUnit = (i.laborMinutes / 60) * i.laborHourCost;
  const complexityMultiplier = 1 + (i.complexity - 1) * 0.08;

  const baseCostUnit =
    (materialPerUnit + energyPerUnit + machinePerUnit + laborPerUnit) *
      complexityMultiplier +
    i.postProcessing + i.packaging + i.extras;

  const costUnit = baseCostUnit;
  const costTotal = costUnit * qty + i.shipping;
  const marginMultiplier = 1 + i.marginPct / 100;
  const priceBeforeFees = costUnit * marginMultiplier;
  const feeFactor = 1 - (i.commissionPct + i.taxesPct) / 100;
  const idealPrice = feeFactor > 0.05 ? priceBeforeFees / feeFactor : priceBeforeFees;
  const minPrice = costUnit / (feeFactor > 0.05 ? feeFactor : 1);
  const markupPct = costUnit > 0 ? ((idealPrice - costUnit) / costUnit) * 100 : 0;
  const profitUnit = idealPrice * feeFactor - costUnit;
  const profitTotal = profitUnit * qty;
  const operationalMarginPct = idealPrice > 0 ? (profitUnit / idealPrice) * 100 : 0;
  const breakeven = profitUnit > 0 ? Math.ceil(i.shipping / profitUnit) : 0;

  return {
    materialPerUnit, energyPerUnit, machinePerUnit, laborPerUnit,
    costUnit, costTotal, idealPrice, minPrice, markupPct,
    profitUnit, profitTotal, operationalMarginPct, breakeven, totalHours,
  };
}

function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function Calc3DPage() {
  const [inputs, setInputs] = useState<Inputs>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const saved = localStorage.getItem(CURRENT_KEY);
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULTS;
  });
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [expandedMobile, setExpandedMobile] = useState(false);

  const r = useMemo(() => computeResults(inputs), [inputs]);

  useEffect(() => {
    try { localStorage.setItem(CURRENT_KEY, JSON.stringify(inputs)); } catch {}
  }, [inputs]);

  const update = <K extends keyof Inputs>(k: K, v: Inputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const applyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    setInputs((p) => ({ ...p, filamentType: key, filamentCostKg: preset.costKg }));
  };

  const saveProject = () => {
    const name = projectName.trim() || `Projeto ${projects.length + 1}`;
    const now = Date.now();
    if (currentId) {
      const next = projects.map((p) =>
        p.id === currentId ? { ...p, name, inputs, updatedAt: now } : p
      );
      setProjects(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      const proj: Project = { id: crypto.randomUUID(), name, inputs, createdAt: now, updatedAt: now };
      const next = [proj, ...projects];
      setProjects(next);
      setCurrentId(proj.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const loadProject = (p: Project) => {
    setInputs(p.inputs);
    setProjectName(p.name);
    setCurrentId(p.id);
    setShowHistory(false);
  };

  const duplicateProject = (p: Project) => {
    const proj: Project = {
      ...p, id: crypto.randomUUID(),
      name: `${p.name} (cópia)`,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const next = [proj, ...projects];
    setProjects(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const deleteProject = (id: string) => {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (currentId === id) { setCurrentId(null); setProjectName(""); }
  };

  const newProject = () => {
    setInputs(DEFAULTS);
    setCurrentId(null);
    setProjectName("");
  };

  return (
    <div className="flex-1 w-full min-w-0 max-w-[1600px] p-3 sm:p-4 md:p-8">
      {/* Header */}
      <header className="mb-3 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 grid place-items-center flex-shrink-0">
            <Box className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-2xl md:text-3xl text-foreground truncate">
              Calculadora 3D
            </h1>
            <p className="text-[11px] sm:text-sm text-muted-foreground truncate">
              Precificação profissional 3D
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex-1 sm:flex-initial h-10 sm:h-9 px-3 rounded-lg border border-border/60 bg-card/60 hover:bg-card active:scale-[0.98] text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <History className="h-3.5 w-3.5" /> Projetos ({projects.length})
          </button>
          <button
            onClick={newProject}
            className="flex-1 sm:flex-initial h-10 sm:h-9 px-3 rounded-lg border border-border/60 bg-card/60 hover:bg-card active:scale-[0.98] text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Novo
          </button>
        </div>
      </header>

      {/* Mobile sticky price summary */}
      <div className="lg:hidden sticky top-14 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 pb-2 pt-1 bg-background/85 backdrop-blur-md mb-3">
        <button
          onClick={() => setExpandedMobile((v) => !v)}
          className="w-full text-left rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-card/60 backdrop-blur p-3 shadow-lg shadow-primary/10 active:scale-[0.99] transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-primary/80">Preço ideal</div>
              <div className="text-2xl font-display tabular-nums text-foreground truncate">
                {brl(r.idealPrice)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Custo {brl(r.costUnit)} · Lucro <span className="text-emerald-400">{brl(r.profitUnit)}</span>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ${expandedMobile ? "rotate-180" : ""}`}
            />
          </div>
          {expandedMobile && (
            <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
              <Mini label="Preço mínimo" value={brl(r.minPrice)} />
              <Mini label="Markup" value={`${r.markupPct.toFixed(0)}%`} />
              <Mini label="Material" value={brl(r.materialPerUnit)} />
              <Mini label="Energia" value={brl(r.energyPerUnit)} />
              <Mini label="Máquina" value={brl(r.machinePerUnit)} />
              <Mini label="Mão de obra" value={brl(r.laborPerUnit)} />
              <Mini label="Custo total" value={brl(r.costTotal)} />
              <Mini label="Lucro total" value={brl(r.profitTotal)} />
              <Mini label="Margem op." value={`${r.operationalMarginPct.toFixed(1)}%`} />
              <Mini label="Tempo" value={`${r.totalHours.toFixed(2)}h`} />
            </div>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 md:gap-6">
        {/* Inputs */}
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <Section icon={<Clock className="h-4 w-4" />} title="Impressão" defaultOpen>
            <Grid>
              <NumField label="Peso (g)" value={inputs.weight} onChange={(v) => update("weight", v)} step={1} />
              <NumField label="Qtd." value={inputs.quantity} onChange={(v) => update("quantity", v)} step={1} min={1} />
              <NumField label="Horas" value={inputs.printHours} onChange={(v) => update("printHours", v)} step={1} min={0} />
              <NumField label="Minutos" value={inputs.printMinutes} onChange={(v) => update("printMinutes", v)} step={1} min={0} max={59} />
            </Grid>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <SliderField label="Taxa de falha" value={inputs.failureRate} onChange={(v) => update("failureRate", v)} min={0} max={50} step={1} suffix="%" />
              <SliderField label="Complexidade" value={inputs.complexity} onChange={(v) => update("complexity", v)} min={1} max={5} step={1} suffix="/5" />
            </div>
          </Section>

          <Section icon={<Sparkles className="h-4 w-4" />} title="Filamento" defaultOpen>
            <div className="-mx-1 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mb-3">
              <div className="flex gap-1.5 min-w-min">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition active:scale-95 ${
                      inputs.filamentType === key
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-secondary/40 border-border/40 text-muted-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <Grid>
              <NumField label="Custo kg (R$)" value={inputs.filamentCostKg} onChange={(v) => update("filamentCostKg", v)} step={5} />
              <ReadField label="Consumo est." value={`${(inputs.weight * (1 + inputs.failureRate / 100)).toFixed(1)} g`} />
            </Grid>
          </Section>

          <Section icon={<Zap className="h-4 w-4" />} title="Máquina & Energia">
            <Grid>
              <NumField label="Potência (W)" value={inputs.powerW} onChange={(v) => update("powerW", v)} step={10} />
              <NumField label="kWh (R$)" value={inputs.kwhPrice} onChange={(v) => update("kwhPrice", v)} step={0.05} />
              <NumField label="Custo/h máq." value={inputs.machineHourCost} onChange={(v) => update("machineHourCost", v)} step={0.5} />
            </Grid>
          </Section>

          <Section icon={<Wrench className="h-4 w-4" />} title="Operacional">
            <Grid>
              <NumField label="M.obra (R$/h)" value={inputs.laborHourCost} onChange={(v) => update("laborHourCost", v)} step={5} />
              <NumField label="M.obra (min)" value={inputs.laborMinutes} onChange={(v) => update("laborMinutes", v)} step={5} />
              <NumField label="Embalagem" value={inputs.packaging} onChange={(v) => update("packaging", v)} step={0.5} />
              <NumField label="Pós-proc." value={inputs.postProcessing} onChange={(v) => update("postProcessing", v)} step={0.5} />
              <NumField label="Frete" value={inputs.shipping} onChange={(v) => update("shipping", v)} step={1} />
              <NumField label="Extras" value={inputs.extras} onChange={(v) => update("extras", v)} step={1} />
            </Grid>
          </Section>

          <Section icon={<Percent className="h-4 w-4" />} title="Financeiro" defaultOpen>
            <div className="space-y-3">
              <SliderField label="Margem de lucro" value={inputs.marginPct} onChange={(v) => update("marginPct", v)} min={0} max={300} step={5} suffix="%" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SliderField label="Comissão" value={inputs.commissionPct} onChange={(v) => update("commissionPct", v)} min={0} max={30} step={0.5} suffix="%" />
                <SliderField label="Impostos / taxas" value={inputs.taxesPct} onChange={(v) => update("taxesPct", v)} min={0} max={30} step={0.5} suffix="%" />
              </div>
            </div>
          </Section>

          {/* Save card (visible on mobile too, at bottom of inputs) */}
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-3 space-y-2">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Nome do projeto"
              className="w-full h-11 sm:h-10 px-3 rounded-lg bg-background/60 border border-border/40 text-sm focus:outline-none focus:border-primary/60"
            />
            <button
              onClick={saveProject}
              className="w-full h-11 sm:h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" /> {currentId ? "Atualizar projeto" : "Salvar projeto"}
            </button>
          </div>
        </div>

        {/* Desktop results panel */}
        <aside className="hidden lg:block lg:sticky lg:top-4 self-start space-y-4">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-card/40 backdrop-blur p-4 shadow-xl shadow-primary/10">
            <div className="text-[11px] uppercase tracking-wider text-primary/80 mb-1">Preço ideal</div>
            <div className="text-3xl sm:text-4xl font-display text-foreground tabular-nums">{brl(r.idealPrice)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              por peça · markup {r.markupPct.toFixed(0)}%
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Mini label="Preço mínimo" value={brl(r.minPrice)} />
              <Mini label="Custo unitário" value={brl(r.costUnit)} />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-4 space-y-2.5">
            <Row icon={<Package className="h-3.5 w-3.5" />} label="Material" value={brl(r.materialPerUnit)} />
            <Row icon={<Zap className="h-3.5 w-3.5" />} label="Energia" value={brl(r.energyPerUnit)} />
            <Row icon={<Wrench className="h-3.5 w-3.5" />} label="Máquina" value={brl(r.machinePerUnit)} />
            <Row icon={<Clock className="h-3.5 w-3.5" />} label="Mão de obra" value={brl(r.laborPerUnit)} />
            <div className="border-t border-border/40 pt-2.5 space-y-2.5">
              <Row icon={<DollarSign className="h-3.5 w-3.5" />} label="Custo total" value={brl(r.costTotal)} bold />
              <Row icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />} label="Lucro/peça" value={brl(r.profitUnit)} bold accent />
              <Row icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />} label="Lucro total" value={brl(r.profitTotal)} accent />
              <Row icon={<Percent className="h-3.5 w-3.5" />} label="Margem operacional" value={`${r.operationalMarginPct.toFixed(1)}%`} />
              <Row icon={<Clock className="h-3.5 w-3.5" />} label="Tempo total" value={`${r.totalHours.toFixed(2)} h`} />
            </div>
          </div>
        </aside>
      </div>

      {/* Projects sheet (mobile + desktop) */}
      {showHistory && (
        <>
          <div
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          <div
            className="fixed z-50 left-0 right-0 bottom-0 sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md w-full bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 max-h-[85dvh] flex flex-col"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Projetos salvos
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                Nenhum projeto salvo ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border/40 overflow-y-auto -mx-1 px-1">
                {projects.map((p) => (
                  <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                    <button onClick={() => loadProject(p)} className="flex-1 text-left min-w-0 py-1">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {brl(computeResults(p.inputs).idealPrice)} ·{" "}
                        {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => duplicateProject(p)}
                        className="h-9 w-9 grid place-items-center rounded-lg hover:bg-secondary/60 text-muted-foreground"
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteProject(p.id)}
                        className="h-9 w-9 grid place-items-center rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function Section({
  icon, title, children, defaultOpen = false,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-4 lg:cursor-default"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <span className="h-6 w-6 rounded-md bg-primary/15 grid place-items-center text-primary">{icon}</span>
          {title}
        </h3>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform lg:hidden ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`px-4 pb-4 ${open ? "block" : "hidden"} lg:block`}>
        {children}
      </div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>;
}

function NumField({
  label, value, onChange, step = 1, min, max,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number;
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-1 truncate">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onFocus={(e) => e.target.select()}
        className="w-full h-11 sm:h-10 px-3 rounded-lg bg-background/60 border border-border/40 text-sm tabular-nums focus:outline-none focus:border-primary/60"
      />
    </label>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-1 truncate">{label}</span>
      <div className="w-full h-11 sm:h-10 px-3 rounded-lg bg-background/30 border border-border/30 text-sm tabular-nums flex items-center text-muted-foreground truncate">
        {value}
      </div>
    </div>
  );
}

function SliderField({
  label, value, onChange, min, max, step, suffix,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; suffix?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground truncate">{label}</span>
        <span className="text-xs font-medium tabular-nums text-foreground flex-shrink-0">
          {value}{suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="py-1.5 touch-none"
      />
    </div>
  );
}

function Row({
  icon, label, value, bold, accent,
}: {
  icon: React.ReactNode; label: string; value: string;
  bold?: boolean; accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm gap-2">
      <span className="flex items-center gap-2 text-muted-foreground min-w-0 truncate">
        {icon}{label}
      </span>
      <span className={`tabular-nums flex-shrink-0 ${bold ? "font-semibold" : ""} ${accent ? "text-emerald-400" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/40 border border-border/40 p-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
      <div className="text-sm font-medium tabular-nums text-foreground truncate">{value}</div>
    </div>
  );
}
