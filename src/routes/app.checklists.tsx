import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Check, Filter, Plus, Trash2, Pencil, GripVertical, X,
  Play, Pause, StopCircle, RotateCcw, ChevronRight,
  TrendingUp, CheckCircle2, AlertTriangle, ListTodo, Activity,
  Sparkles, History, Timer, BarChart3, Users, Settings2, Infinity as InfinityIcon,
} from "lucide-react";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import {
  COMPANY_COLORS, DEFAULT_COMPANY_COLOR, type Company,
} from "@/lib/mock-data";

import {
  useOperationalData, buildDailySeries, tasksByCompany, tasksByUser,
  type SessionRow, type SessionTaskRow,
} from "@/lib/operations";
import { CompanyTag } from "@/components/CompanyTag";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/lib/auth";
import { usePonto, fmtTime, onPontoEvent } from "@/lib/ponto";
import { useChecklist, type UserTask } from "@/lib/checklist-store";
import { useWorkspace } from "@/lib/workspace";
import { useChecklistCompanies, type ChecklistCompany } from "@/lib/checklist-companies";
import { EditPontoSessionDialog, type EditablePontoSession } from "@/components/EditPontoSessionDialog";


export const Route = createFileRoute("/app/checklists")({
  component: ChecklistsPage,
});

type Tab = "diario" | "historico" | "ponto" | "metricas";

const TABS: { id: Tab; label: string; icon: typeof ListTodo }[] = [
  { id: "diario", label: "Checklist Diário", icon: ListTodo },
  { id: "historico", label: "Histórico", icon: History },
  { id: "ponto", label: "Bater Ponto", icon: Timer },
  { id: "metricas", label: "Métricas", icon: BarChart3 },
];

function ChecklistsPage() {
  const [tab, setTab] = useState<Tab>("diario");
  const { totals } = useChecklist();
  const completionPct = totals.pct;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1600px] mx-auto">
      <header className="mb-5 md:mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Operação diária</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-1">Centro Operacional</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Crie, organize e acompanhe suas próprias tarefas por empresa.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card self-start md:self-auto">
          <div className="relative h-12 w-12">
            <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="oklch(0.28 0.014 240)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="url(#g1)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(completionPct / 100) * 94.25} 94.25`}
              />
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.16 65)" />
                  <stop offset="100%" stopColor="oklch(0.7 0.18 45)" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{completionPct}%</span>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Hoje</div>
            <div className="text-sm font-semibold">{totals.done}/{totals.total} tarefas</div>
          </div>
        </div>
      </header>

      {/* Tabs — scroll horizontal no mobile */}
      <div className="-mx-4 sm:mx-0 px-4 sm:px-0 mb-5 md:mb-6 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 p-1 rounded-xl border border-border bg-card shadow-card w-fit">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  active
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "diario" && <DailyTab />}
      {tab === "historico" && <HistoryTab />}
      {tab === "ponto" && <PontoTab />}
      {tab === "metricas" && <MetricsTab />}
    </div>
  );
}

/* =================== TAB: DIÁRIO =================== */

type StatusFilter = "Todos" | "Concluído" | "Pendente";

function DailyTab() {
  const { state } = useChecklist();
  const { companies, canManage, create, reorder } = useChecklistCompanies();
  const [companyFilter, setCompanyFilter] = useState<string>("Todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todos");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const companyNames = useMemo(() => companies.map((c) => c.name), [companies]);

  const visibleCompanies = useMemo(
    () => (companyFilter === "Todas" ? companyNames : [companyFilter]),
    [companyFilter, companyNames]
  );

  const totals = useMemo(() => {
    let total = 0, done = 0;
    const walk = (list: UserTask[]) => {
      for (const t of list) { total += 1; if (t.done) done += 1; walk(t.subtasks); }
    };
    for (const c of visibleCompanies) walk(state[c] ?? []);
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [state, visibleCompanies]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = await create(trimmed);
    if (created) { setNewName(""); setShowNew(false); }
  };

  return (
    <div className="space-y-8">
      {/* Toolbar: filtros (compartilhados entre Checklist e Kanban) */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-border bg-card shadow-card">
        <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
        <Select
          label="Empresa"
          value={companyFilter}
          onChange={(v) => setCompanyFilter(v)}
          options={["Todas", ...companyNames]}
        />
        <Select
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={["Todos", "Pendente", "Concluído"]}
        />
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-mono hidden sm:inline">{totals.done}/{totals.total} concluídas</span>
          <span className="text-muted-foreground font-mono sm:hidden">{totals.done}/{totals.total}</span>
          <span className="px-2 py-1 rounded-md bg-surface font-mono text-primary">{totals.pct}%</span>
        </div>
      </div>

      {/* Checklist Diário — verificações operacionais recorrentes (reset diário automático) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight">Checklist Diário</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              Reseta automaticamente a cada novo dia
            </span>
            {canManage && (
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary text-primary-foreground px-3 py-1.5 text-xs font-medium shadow-glow hover:opacity-90 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Nova Empresa
              </button>
            )}
          </div>
        </div>

        {showNew && canManage && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card shadow-card">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setShowNew(false); setNewName(""); }
              }}
              placeholder="Nome da empresa…"
              className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button onClick={handleCreate} disabled={!newName.trim()}
              className="inline-flex items-center justify-center h-9 px-3 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow disabled:opacity-40 transition">
              Criar
            </button>
            <button onClick={() => { setShowNew(false); setNewName(""); }}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {companies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
            {canManage ? "Nenhuma empresa cadastrada. Crie a primeira acima." : "Nenhuma empresa cadastrada ainda."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {(companyFilter === "Todas" ? companies : companies.filter((c) => c.name === companyFilter)).map((c) => (
              <CompanyChecklistCard
                key={c.id}
                companyRow={c}
                statusFilter={statusFilter}
                canManage={canManage}
                onReorder={reorder}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


/** Count {done, total} recursively across a task and its subtasks. */
function countTree(t: UserTask): { done: number; total: number } {
  let done = t.done ? 1 : 0;
  let total = 1;
  for (const c of t.subtasks) { const r = countTree(c); done += r.done; total += r.total; }
  return { done, total };
}

function CompanyChecklistCard({
  companyRow, statusFilter, canManage, onReorder,
}: {
  companyRow: ChecklistCompany;
  statusFilter: StatusFilter;
  canManage: boolean;
  onReorder: (fromId: string, toId: string) => Promise<void>;
}) {
  const { state, add, clearCompany } = useChecklist();
  const { rename, remove: removeCompany } = useChecklistCompanies();
  const company = companyRow.name as Company;
  const tasks = state[company] ?? [];
  const [draft, setDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(companyRow.name);
  const [dragOver, setDragOver] = useState(false);

  const color = companyRow.color ?? COMPANY_COLORS[company] ?? DEFAULT_COMPANY_COLOR;

  const filtered = tasks.filter((t) => {
    if (statusFilter === "Concluído") return t.done;
    if (statusFilter === "Pendente") return !t.done;
    return true;
  });

  const agg = tasks.reduce(
    (acc, t) => { const r = countTree(t); acc.done += r.done; acc.total += r.total; return acc; },
    { done: 0, total: 0 },
  );
  const pct = agg.total ? Math.round((agg.done / agg.total) * 100) : 0;

  const submitNew = () => {
    if (!draft.trim()) return;
    add(company, draft, null);
    setDraft("");
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === companyRow.name) { setEditingName(false); setNameDraft(companyRow.name); return; }
    const ok = await rename(companyRow.id, trimmed);
    setEditingName(false);
    if (!ok) setNameDraft(companyRow.name);
  };

  const handleDelete = async () => {
    const msg = tasks.length > 0
      ? `Excluir "${company}"?\n\nIsso removerá ${agg.total} tarefa(s) e o histórico vinculado.\nEsta ação é permanente.`
      : `Excluir "${company}"?\nEsta ação é permanente.`;
    if (!confirm(msg)) return;
    await removeCompany(companyRow.id);
  };

  return (
    <div
      draggable={canManage && !editingName}
      onDragStart={(e) => { if (!canManage) return; e.dataTransfer.setData("text/company-id", companyRow.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => {
        if (!canManage) return;
        const id = e.dataTransfer.types.includes("text/company-id");
        if (!id) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        const fromId = e.dataTransfer.getData("text/company-id");
        if (!fromId || fromId === companyRow.id) return;
        e.preventDefault(); e.stopPropagation();
        onReorder(fromId, companyRow.id);
      }}
      className={`rounded-xl border ${dragOver ? "border-primary ring-2 ring-primary/30" : "border-border"} bg-card shadow-card overflow-hidden flex flex-col transition`}
    >
      <div
        className="p-5 border-b border-border"
        style={{
          background: `linear-gradient(180deg, color-mix(in oklab, ${color} 12%, transparent), transparent)`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {canManage && !editingName && (
              <span className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition shrink-0" title="Arraste para reordenar">
                <GripVertical className="h-4 w-4" />
              </span>
            )}
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") { setEditingName(false); setNameDraft(companyRow.name); }
                }}
                className="rounded-md bg-background border border-border px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring max-w-[180px]"
              />
            ) : (
              <CompanyTag company={company} colorOverride={color} />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">{agg.done}/{agg.total}</span>
            {canManage && !editingName && (
              <>
                <button
                  onClick={() => { setEditingName(true); setNameDraft(companyRow.name); }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface transition"
                  title="Renomear empresa"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                  title="Excluir empresa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {tasks.length > 0 && !canManage && (
              <button
                onClick={() => {
                  if (confirm(`Limpar todas as tarefas de ${company}?`)) clearCompany(company);
                }}
                className="text-[10px] text-muted-foreground hover:text-destructive transition"
                title="Limpar tudo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full transition-all rounded-full"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs font-mono font-semibold" style={{ color }}>{pct}%</span>
        </div>
      </div>


      <div className="p-3 flex-1 flex flex-col">
        {/* Add input (top-level) */}
        <div className="flex items-center gap-2 mb-3 px-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitNew(); }}
            placeholder="Nova tarefa…"
            className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={submitNew}
            disabled={!draft.trim()}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none transition"
            aria-label="Adicionar tarefa"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center px-3 py-8">
            <div className="text-xs text-muted-foreground">
              {tasks.length === 0
                ? "Nenhuma tarefa ainda. Adicione a primeira acima."
                : "Nenhuma tarefa neste filtro."}
            </div>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                company={company}
                depth={0}
                color={color}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Recursive row. Supports drag-reorder among siblings (same parent). */
function TaskRow({
  task, company, depth, color,
}: { task: UserTask; company: Company; depth: number; color: string }) {
  const { add, edit, remove, toggle, reorder } = useChecklist();
  const [editing, setEditing] = useState(false);
  const [editingText, setEditingText] = useState(task.text);
  const [expanded, setExpanded] = useState(true);
  const [subDraft, setSubDraft] = useState("");
  const [showAddSub, setShowAddSub] = useState(false);

  const hasSubs = task.subtasks.length > 0;
  const agg = useMemo(() => countTree(task), [task]);
  // Show only own children's progress (exclude self)
  const subDone = agg.done - (task.done ? 1 : 0);
  const subTotal = agg.total - 1;
  const subPct = subTotal ? Math.round((subDone / subTotal) * 100) : 0;

  const saveEdit = () => {
    if (editingText.trim() && editingText !== task.text) edit(company, task.id, editingText);
    setEditing(false);
  };

  const submitSub = () => {
    if (!subDraft.trim()) return;
    add(company, subDraft, task.id);
    setSubDraft("");
    setExpanded(true);
  };

  return (
    <li>
      <div
        draggable={!editing}
        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/task-id", task.id); e.dataTransfer.setData("text/parent-id", task.parentId ?? ""); e.dataTransfer.effectAllowed = "move"; }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation();
          const fromId = e.dataTransfer.getData("text/task-id");
          const fromParent = e.dataTransfer.getData("text/parent-id") || null;
          if (fromId && fromId !== task.id && (fromParent || null) === (task.parentId ?? null)) {
            reorder(company, fromId, task.id, task.parentId ?? null);
          }
        }}
        className={`group flex items-start gap-2 rounded-lg p-2.5 transition ${
          task.done ? "bg-surface/40" : "hover:bg-surface/60"
        }`}
        style={{ marginLeft: depth * 18 }}
      >
        {hasSubs ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 text-muted-foreground/60 hover:text-foreground transition shrink-0"
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition shrink-0">
            <GripVertical className="h-4 w-4" />
          </span>
        )}

        <button
          onClick={() => toggle(company, task.id)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
            task.done ? "border-primary bg-gradient-primary" : "border-border bg-surface hover:border-primary/50"
          }`}
          aria-label={task.done ? "Desmarcar" : "Concluir"}
        >
          {task.done && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") { setEditing(false); setEditingText(task.text); }
                }}
                onBlur={saveEdit}
                className="flex-1 rounded-md bg-background border border-border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ) : (
            <>
              <button
                onClick={() => toggle(company, task.id)}
                className={`block text-left text-sm leading-snug w-full ${
                  task.done ? "line-through text-muted-foreground" : "font-medium"
                }`}
              >
                {task.text}
              </button>
              {hasSubs && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 max-w-[140px] h-1 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full transition-all rounded-full"
                      style={{ width: `${subPct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{subDone}/{subTotal}</span>
                </div>
              )}
              {task.done && task.doneAt && (
                <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-success font-mono">
                  <CheckCircle2 className="h-3 w-3" /> Concluída às {task.doneAt}
                </div>
              )}
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition shrink-0">
            {depth < 3 && (
              <button
                onClick={() => { setShowAddSub((v) => !v); setExpanded(true); }}
                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-surface"
                aria-label="Adicionar subtarefa"
                title="Adicionar subtarefa"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => { setEditing(true); setEditingText(task.text); }}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface"
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => remove(company, task.id)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Subtasks (animated reveal) */}
      {expanded && (hasSubs || showAddSub) && (
        <div className="mt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {hasSubs && (
            <ul
              className="space-y-0.5 border-l border-border/60 ml-3"
              style={{ marginLeft: depth * 18 + 12 }}
            >
              {task.subtasks.map((sub) => (
                <TaskRow key={sub.id} task={sub} company={company} depth={depth + 1} color={color} />
              ))}
            </ul>
          )}
          {showAddSub && (
            <div
              className="flex items-center gap-2 px-1 py-2"
              style={{ marginLeft: (depth + 1) * 18 }}
            >
              <input
                autoFocus
                value={subDraft}
                onChange={(e) => setSubDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { submitSub(); }
                  if (e.key === "Escape") { setShowAddSub(false); setSubDraft(""); }
                }}
                placeholder="Nova subtarefa…"
                className="flex-1 rounded-md bg-surface border border-border px-2 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={submitSub}
                disabled={!subDraft.trim()}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-gradient-primary text-primary-foreground disabled:opacity-40 transition"
                aria-label="Adicionar"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setShowAddSub(false); setSubDraft(""); }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}


function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md bg-surface border border-border px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

/* =================== TAB: HISTÓRICO =================== */

type TimelineEvent = {
  kind: "completed";
  id: string;
  ts: number;
  title: string;
  company: string | null;
  user_name: string | null;
};

function HistoryTab() {
  const { sessions, sessionTasks, loading } = useOperationalData();
  const { companies: checklistCompanies } = useChecklistCompanies();
  const [period, setPeriod] = useState<"diario" | "semanal" | "mensal">("semanal");
  const [companyFilter, setCompanyFilter] = useState<Company | "Todas">("Todas");
  const [userFilter, setUserFilter] = useState<string>("Todos");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditablePontoSession | null>(null);
  const PAGE_SIZE = 10;


  const days = period === "diario" ? 1 : period === "semanal" ? 7 : 30;
  const cutoff = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.getTime() - (days - 1) * 86400000;
  }, [days]);

  const periodSessions = useMemo(
    () => sessions.filter((s) => s.status === "ended" && new Date(s.started_at).getTime() >= cutoff),
    [sessions, cutoff]
  );
  const periodTasks = useMemo(
    () => sessionTasks.filter((t) => new Date(t.completed_at).getTime() >= cutoff),
    [sessionTasks, cutoff]
  );

  const userOptions = useMemo(() => {
    const s = new Set<string>();
    for (const x of sessions) if (x.user_name) s.add(x.user_name);
    for (const x of sessionTasks) if (x.user_name) s.add(x.user_name);
    return ["Todos", ...Array.from(s).sort()];
  }, [sessions, sessionTasks]);

  const filteredSessions = useMemo(() => {
    return periodSessions.filter((s) => {
      if (userFilter !== "Todos" && (s.user_name ?? "") !== userFilter) return false;
      if (companyFilter !== "Todas") {
        const ids = new Set(periodTasks.filter((t) => t.session_id === s.id && t.company === companyFilter).map((t) => t.id));
        if (ids.size === 0) return false;
      }
      return true;
    });
  }, [periodSessions, periodTasks, userFilter, companyFilter]);

  const filteredTimeline = useMemo<TimelineEvent[]>(() => {
    return periodTasks
      .filter((t) =>
        (companyFilter === "Todas" || t.company === companyFilter) &&
        (userFilter === "Todos" || (t.user_name ?? "") === userFilter)
      )
      .map((t) => ({
        kind: "completed" as const,
        id: `c-${t.id}`,
        ts: new Date(t.completed_at).getTime(),
        title: t.title,
        company: t.company,
        user_name: t.user_name,
      }))
      .sort((a, b) => b.ts - a.ts);
  }, [periodTasks, companyFilter, userFilter]);

  const series = useMemo(() => buildDailySeries(periodSessions, periodTasks, days), [periodSessions, periodTasks, days]);

  const totals = {
    completed: periodTasks.filter((t) =>
      (companyFilter === "Todas" || t.company === companyFilter) &&
      (userFilter === "Todos" || (t.user_name ?? "") === userFilter)
    ).length,
    sessions: filteredSessions.length,
    productiveMs: filteredSessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0),
    totalMs: filteredSessions.reduce((a, s) => a + (s.total_ms ?? 0), 0),
  };

  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const pageSessions = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [period, companyFilter, userFilter]);

  const fmtClock = (ts: string | null) =>
    ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtDate = (ts: string) =>
    new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-card">
        <div className="flex gap-1 p-1 rounded-lg bg-surface">
          {(["diario", "semanal", "mensal"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition ${
                period === p ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <Select label="Empresa" value={companyFilter} onChange={(v) => setCompanyFilter(v as Company | "Todas")} options={["Todas", ...checklistCompanies.map((c) => c.name)]} />
        <Select label="Usuário" value={userFilter} onChange={setUserFilter} options={userOptions} />
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {loading ? "Carregando…" : `${totals.completed} concluídas`}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Tarefas concluídas" value={totals.completed} icon={CheckCircle2} accent="success" hint="no período" />
        <StatCard label="Sessões encerradas" value={totals.sessions} icon={History} accent="info" hint="expedientes" />
        <StatCard label="Tempo produtivo" value={fmtTime(totals.productiveMs)} icon={Timer} accent="primary" hint="acumulado" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Produtividade no período</h3>
          <span className="text-xs text-muted-foreground">{series.length} dias</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="histG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="productivity" stroke="oklch(0.78 0.16 65)" strokeWidth={2} fill="url(#histG)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sessões encerradas com paginação */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Expedientes encerrados
          </h3>
          <span className="text-xs text-muted-foreground">{filteredSessions.length} no total</span>
        </div>
        {filteredSessions.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            Nenhum expediente encerrado neste filtro.
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface/40 overflow-hidden">
              {pageSessions.map((s) => {
                const tasks = periodTasks.filter((t) => t.session_id === s.id);
                const companies = Array.from(new Set(tasks.map((t) => t.company))) as Company[];
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-[140px]">
                      <div className="text-xs text-muted-foreground">{fmtDate(s.started_at)}</div>
                      <div className="font-mono text-xs">{fmtClock(s.started_at)} → {fmtClock(s.ended_at)}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs tabular-nums">{fmtTime(s.total_ms ?? 0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <span className="text-xs">{tasks.length} tarefas</span>
                    </div>
                    {s.user_name && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{s.user_name}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1 ml-auto">
                      {companies.map((c) => <CompanyTag key={c} company={c} />)}
                      {s.edited_at && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning">editado</span>
                      )}
                      <button
                        onClick={() => setEditing(s as EditablePontoSession)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-surface hover:bg-surface-elevated text-xs ml-1"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {pageCount > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-muted-foreground">Página {page} de {pageCount}</span>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-md border border-border bg-surface text-xs disabled:opacity-40 hover:bg-surface-elevated"
                  >Anterior</button>
                  <button
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    className="px-3 py-1.5 rounded-md border border-border bg-surface text-xs disabled:opacity-40 hover:bg-surface-elevated"
                  >Próxima</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Timeline operacional — concluídas + excluídas */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Timeline operacional
          </h3>
          <span className="text-xs text-muted-foreground">{filteredTimeline.length} eventos</span>
        </div>
        {filteredTimeline.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum evento neste filtro.
          </div>
        ) : (
          <ol className="relative border-l border-border ml-3 space-y-3 max-h-[480px] overflow-y-auto pr-2">
            {filteredTimeline.slice(0, 200).map((e) => (
              <li key={e.id} className="ml-5">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full shadow-glow bg-success" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(e.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-success/30 bg-success/10 text-success uppercase tracking-wider">
                    <CheckCircle2 className="h-3 w-3" /> Concluído
                  </span>
                  {e.company && <CompanyTag company={e.company as Company} />}
                  <span className="text-foreground">{e.title}</span>
                  {e.user_name && <span className="text-xs text-muted-foreground">— {e.user_name}</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <EditPontoSessionDialog session={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/* =================== TAB: BATER PONTO =================== */

interface DaySessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  total_ms: number | null;
  productive_ms: number | null;
  pause_ms: number | null;
  user_name: string | null;
  company: string | null;
  workspace_id?: string | null;
  pauses?: unknown;
  notes?: string | null;
  description?: string | null;
  edited_at?: string | null;
}



function PontoTab() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { companies: checklistCompanies, colorOf, setPontoLimit } = useChecklistCompanies();
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [limitDraftMin, setLimitDraftMin] = useState<string>("");
  const [limitDraftEnabled, setLimitDraftEnabled] = useState<boolean>(true);

  const {
    sessions: pontoSessions, activeCompany,
    computeFor, dailyProductiveMs, dailyTotalMs,
    startCompany, pauseCompany, resumeCompany, endCompany,
  } = usePonto();


  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const requestNotif = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try { const res = await Notification.requestPermission(); setPermission(res); } catch { /* noop */ }
  };

  const handleStart = (company: Company) => {
    startCompany(company, user?.name, user?.email, user?.id);
  };

  const [history, setHistory] = useState<DaySessionRow[]>([]);
  useEffect(() => {
    if (!user?.id || !activeWorkspaceId) { setHistory([]); return; }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("ponto_sessions")
        .select("id, started_at, ended_at, status, total_ms, productive_ms, pause_ms, user_name, company, workspace_id, pauses, notes, description, edited_at")
        .eq("workspace_id", activeWorkspaceId)
        .or(`user_id.eq.${user.id},owner_email.eq.${user.email}`)
        .eq("status", "ended")
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) console.error("[ponto] history error", error);
      if (!cancelled) setHistory((data ?? []) as DaySessionRow[]);
    };
    load();
    const offEvt = onPontoEvent((e) => { if (e.type === "ended" && e.ownerEmail === user.email) load(); });
    const ch = supabase
      .channel(`ponto_sessions_history_v3:${activeWorkspaceId}:${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ponto_sessions", filter: `workspace_id=eq.${activeWorkspaceId}` },
        () => load()
      )
      .subscribe();
    return () => { cancelled = true; offEvt(); supabase.removeChannel(ch); };
  }, [user?.id, user?.email, activeWorkspaceId]);

  // Resumo consolidado por dia + sessões individuais (subpontos por empresa)
  const grouped = useMemo(() => {
    const byDay = new Map<string, { day: string; total: number; productive: number; sessions: DaySessionRow[] }>();
    for (const s of history) {
      const day = new Date(s.started_at).toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { day, total: 0, productive: 0, sessions: [] };
      entry.total += s.total_ms ?? 0;
      entry.productive += s.productive_ms ?? 0;
      entry.sessions.push(s);
      byDay.set(day, entry);
    }
    return Array.from(byDay.values()).sort((a, b) => (a.day < b.day ? 1 : -1));
  }, [history]);

  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditablePontoSession | null>(null);
  const toggleDay = (day: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const fmtDateLabel = (day: string) => {
    const d = new Date(day + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-5">
      {permission === "default" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold">Ative as notificações nativas</div>
            <div className="text-xs text-muted-foreground">Você será avisado quando uma empresa cruzar 30min de expediente, mesmo com a aba minimizada.</div>
          </div>
          <button onClick={requestNotif} className="rounded-md bg-gradient-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-glow">
            Permitir
          </button>
        </div>
      )}
      {permission === "denied" && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Notificações nativas bloqueadas — você verá apenas alertas internos.
        </div>
      )}

      {checklistCompanies.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma empresa cadastrada. Adicione empresas em <strong>Empresas</strong> para liberar pontos.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {checklistCompanies.map((cc) => {
          const c = cc.name as Company;
          const s = pontoSessions[c];
          const m = computeFor(c);
          const dailyMs = dailyProductiveMs(c);
          const totalDay = dailyTotalMs(c);
          const status = s?.status ?? "off";
          const isActive = activeCompany === c && (status === "working" || status === "paused");
          const isWorking = status === "working";
          const isPaused = status === "paused";
          const limitEnabled = cc.ponto_limit_enabled !== false;
          const limitMinutes = Math.max(1, cc.ponto_daily_limit_minutes ?? 30);
          const limitMs = limitMinutes * 60 * 1000;
          const overLimit = limitEnabled && dailyMs >= limitMs;
          const color = colorOf(c);
          const pct = limitEnabled ? Math.min(100, Math.round((dailyMs / limitMs) * 100)) : 0;
          const isEditingLimit = editingLimitId === cc.id;

          return (
            <div key={c} className={`relative rounded-2xl border bg-card p-5 shadow-card overflow-hidden transition ${isActive ? "border-primary/40" : "border-border"}`}>
              <div className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: `radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, ${color} 18%, transparent), transparent 60%)` }} />
              <div className="relative flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: isWorking ? `0 0 12px ${color}` : undefined }} />
                    <span className="font-display font-bold tracking-tight">{c}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${
                      isWorking ? "border-success/40 bg-success/10 text-success" :
                      isPaused ? "border-warning/40 bg-warning/10 text-warning" :
                      status === "ended" ? "border-primary/30 bg-primary/10 text-primary" :
                      "border-border bg-surface text-muted-foreground"
                    }`}>
                      {isWorking ? "Ativo" : isPaused ? "Pausado" : status === "ended" ? "Encerrado" : "Parado"}
                    </span>
                    <button
                      onClick={() => {
                        setEditingLimitId(isEditingLimit ? null : cc.id);
                        setLimitDraftMin(String(limitMinutes));
                        setLimitDraftEnabled(limitEnabled);
                      }}
                      title="Editar limite diário"
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>

                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sessão atual</div>
                  <div className="font-display text-3xl sm:text-4xl font-bold tabular-nums">{fmtTime(m.liveWorkMs)}</div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>Total do dia</span>
                    <span className={overLimit ? "text-warning" : ""}>
                      {fmtTime(totalDay)}
                      {limitEnabled ? ` / ${limitMinutes}min` : (
                        <span className="inline-flex items-center gap-1 ml-1"><InfinityIcon className="h-3 w-3" /> sem limite</span>
                      )}
                    </span>
                  </div>
                  {limitEnabled && (
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface overflow-hidden">
                      <div className="h-full transition-all rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: overLimit ? "oklch(0.78 0.16 65)" : color }} />
                    </div>
                  )}
                  {overLimit && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-warning font-medium">
                      <AlertTriangle className="h-3 w-3" /> Limite diário excedido
                    </div>
                  )}
                </div>

                {isEditingLimit && (
                  <div className="rounded-xl border border-border/70 bg-surface/60 p-3 space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Limite diário deste ponto</div>
                    <label className="flex items-center justify-between gap-3 text-xs">
                      <span>Limite ativo</span>
                      <button
                        type="button"
                        onClick={() => setLimitDraftEnabled((v) => !v)}
                        className={`relative h-5 w-9 rounded-full transition ${limitDraftEnabled ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition ${limitDraftEnabled ? "left-4" : "left-0.5"}`} />
                      </button>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-xs">
                      <span>Minutos por dia</span>
                      <input
                        type="number" min={1} max={1440}
                        value={limitDraftMin}
                        onChange={(e) => setLimitDraftMin(e.target.value)}
                        disabled={!limitDraftEnabled}
                        className="w-24 rounded-md border border-border bg-card px-2 py-1 text-right font-mono disabled:opacity-50"
                      />
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditingLimitId(null)}
                        className="px-2.5 py-1 text-[11px] rounded-md border border-border hover:bg-surface-elevated"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          const n = Number(limitDraftMin);
                          const ok = await setPontoLimit(cc.id, Number.isFinite(n) && n > 0 ? n : 30, limitDraftEnabled);
                          if (ok) setEditingLimitId(null);
                        }}
                        className="px-2.5 py-1 text-[11px] rounded-md bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}


                <div className="flex flex-wrap gap-2">
                  {status === "off" || status === "ended" ? (
                    <button onClick={() => handleStart(c)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-gradient-primary text-primary-foreground shadow-glow">
                      <Play className="h-3.5 w-3.5" /> Iniciar expediente
                    </button>
                  ) : isWorking ? (
                    <>
                      <button onClick={() => pauseCompany(c)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25">
                        <Pause className="h-3.5 w-3.5" /> Pausar
                      </button>
                      <button onClick={() => endCompany(c)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25">
                        <StopCircle className="h-3.5 w-3.5" /> Encerrar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => resumeCompany(c)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-gradient-primary text-primary-foreground shadow-glow">
                        <Play className="h-3.5 w-3.5" /> Retomar
                      </button>
                      <button onClick={() => endCompany(c)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25">
                        <StopCircle className="h-3.5 w-3.5" /> Encerrar
                      </button>
                    </>
                  )}
                </div>

                {s?.startedAt && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Início {new Date(s.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · pausa {fmtTime(m.livePauseMs)} · prod {fmtTime(m.productiveMs)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Histórico diário
          </h3>
          <span className="text-xs text-muted-foreground">{grouped.length} dias</span>
        </div>
        {grouped.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Nenhum expediente encerrado ainda.</div>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-surface/30 overflow-hidden">
            {grouped.map((d) => {
              const productivity = d.total > 0 ? Math.round((d.productive / d.total) * 100) : 0;
              const isOpen = openDays.has(d.day);
              return (
                <li key={d.day} className="text-sm">
                  <button
                    type="button"
                    onClick={() => toggleDay(d.day)}
                    className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface/50 transition"
                  >
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    <div className="min-w-[180px]">
                      <div className="text-xs text-muted-foreground capitalize">{fmtDateLabel(d.day)}</div>
                      <div className="text-[10px] text-muted-foreground">{d.sessions.length} expediente(s)</div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Timer className="h-3.5 w-3.5 text-primary" />
                      <span className="font-mono text-sm font-semibold tabular-nums">{fmtTime(d.total)}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-1">trabalhado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-success" />
                      <span className="font-mono text-xs tabular-nums">{productivity}%</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-1">prod</span>
                    </div>
                  </button>
                  {isOpen && (
                    <ul className="divide-y divide-border/40 bg-surface/20">
                      {d.sessions.map((s) => {
                        const start = new Date(s.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                        const end = s.ended_at ? new Date(s.ended_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
                        return (
                          <li key={s.id} className="flex flex-wrap items-center gap-3 px-6 py-2.5 text-xs">
                            {s.company && <CompanyTag company={s.company as Company} />}
                            <span className="font-mono tabular-nums text-muted-foreground">{start} → {end}</span>
                            <span className="font-mono tabular-nums">{fmtTime(s.total_ms ?? 0)}</span>
                            {s.edited_at && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning">editado</span>
                            )}
                            {s.description && (
                              <span className="text-muted-foreground truncate max-w-[260px]">— {s.description}</span>
                            )}
                            <button
                              onClick={() => setEditing(s as EditablePontoSession)}
                              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-surface hover:bg-surface-elevated text-xs"
                            >
                              <Pencil className="h-3 w-3" /> Editar
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <EditPontoSessionDialog session={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/* =================== TAB: MÉTRICAS =================== */

function MetricsTab() {
  const { sessions, sessionTasks, checklist, loading } = useOperationalData();
  const { companies: checklistCompanies } = useChecklistCompanies();
  const [period, setPeriod] = useState<"diario" | "semanal" | "mensal">("semanal");
  const days = period === "diario" ? 1 : period === "semanal" ? 7 : 30;

  const cutoff = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.getTime() - (days - 1) * 86400000;
  }, [days]);

  const periodSessions = useMemo(
    () => sessions.filter((s) => new Date(s.started_at).getTime() >= cutoff),
    [sessions, cutoff]
  );
  const periodTasks = useMemo(
    () => sessionTasks.filter((t) => new Date(t.completed_at).getTime() >= cutoff),
    [sessionTasks, cutoff]
  );

  const totalMs = periodSessions.reduce((a, s) => a + (s.total_ms ?? 0), 0);
  const productiveMs = periodSessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0);
  const productivity = totalMs > 0 ? Math.round((productiveMs / totalMs) * 100) : 0;
  const tasksCount = periodTasks.length;
  const avgPerTaskMs = tasksCount > 0 ? Math.round(productiveMs / tasksCount) : 0;
  const hours = totalMs / 3600000;

  const checklistDone = checklist.filter((t) => t.status === "done").length;
  const checklistTotal = checklist.length;
  const completionRate = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const series = useMemo(() => buildDailySeries(periodSessions, periodTasks, days), [periodSessions, periodTasks, days]);
  const byCompany = useMemo(() => tasksByCompany(periodTasks), [periodTasks]);
  const byUser = useMemo(() => tasksByUser(periodTasks), [periodTasks]);

  // Heatmap: tasks por dia da semana × hora
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const t of periodTasks) {
      const d = new Date(t.completed_at);
      const dow = d.getDay();
      const h = d.getHours();
      grid[dow][h]++;
      if (grid[dow][h] > max) max = grid[dow][h];
    }
    return { grid, max };
  }, [periodTasks]);

  const activeCompanies = byCompany.filter((b) => b.completed > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-border bg-card shadow-card">
        <div className="flex gap-1 p-1 rounded-lg bg-surface">
          {(["diario","semanal","mensal"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition ${
                period === p ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              }`}
            >{p}</button>
          ))}
        </div>
        <span className="ml-auto text-[11px] sm:text-xs text-muted-foreground font-mono">
          {loading ? "Carregando…" : `${tasksCount} tarefas · ${hours.toFixed(1)}h`}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Produtividade" value={`${productivity}%`} icon={TrendingUp} accent="primary" hint={`período: ${period}`} />
        <StatCard label="Taxa de conclusão" value={`${completionRate}%`} icon={CheckCircle2} accent="success" hint={`${checklistDone}/${checklistTotal} checklist`} />
        <StatCard label="Tempo médio / tarefa" value={fmtTime(avgPerTaskMs)} icon={Timer} accent="info" hint="por execução" />
        <StatCard label="Empresas ativas" value={checklistCompanies.length > 0 ? `${activeCompanies}/${checklistCompanies.length}` : String(activeCompanies)} icon={Users} accent="warning" hint="com produção" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Produtividade ao longo do período</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="metG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="productivity" stroke="oklch(0.78 0.16 65)" strokeWidth={2} fill="url(#metG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Eficiência geral</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ name: "ef", value: productivity, fill: "oklch(0.78 0.16 65)" }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "oklch(0.28 0.014 240)" }} dataKey="value" cornerRadius={10} />
                <text x="50%" y="48%" textAnchor="middle" fontSize="32" fontWeight="700" fill="oklch(0.97 0.005 240)" fontFamily="Space Grotesk">
                  {productivity}%
                </text>
                <text x="50%" y="62%" textAnchor="middle" fontSize="11" fill="oklch(0.68 0.02 240)">
                  EFICIÊNCIA
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Tarefas por empresa</h3>
          {byCompany.every((b) => b.completed === 0) ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Sem tarefas concluídas no período.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCompany} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="company" type="category" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="completed" fill="oklch(0.78 0.16 65)" radius={[0, 4, 4, 0]} name="Concluídas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4">Tarefas por usuário</h3>
          {byUser.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Sem registros de usuários no período.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {byUser.slice(0, 8).map((u, i) => {
                const max = byUser[0].count;
                const pct = Math.round((u.count / max) * 100);
                return (
                  <li key={u.user}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium truncate">{i + 1}. {u.user}</span>
                      <span className="font-mono text-xs text-muted-foreground">{u.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-semibold mb-1">Heatmap de produção</h3>
        <p className="text-xs text-muted-foreground mb-4">Tarefas concluídas por dia da semana × hora</p>
        {heatmap.max === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sem dados suficientes para gerar o heatmap.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 text-[9px] text-muted-foreground mb-1">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center font-mono">{h % 3 === 0 ? String(h).padStart(2,"0") : ""}</div>
                ))}
              </div>
              {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((label, dow) => (
                <div key={label} className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 mb-0.5">
                  <div className="text-[10px] text-muted-foreground font-mono flex items-center">{label}</div>
                  {heatmap.grid[dow].map((v, h) => {
                    const intensity = v / heatmap.max;
                    return (
                      <div
                        key={h}
                        title={`${label} ${String(h).padStart(2,"0")}h: ${v} tarefa(s)`}
                        className="h-5 rounded-sm border border-border/30"
                        style={{
                          background: v === 0
                            ? "oklch(0.22 0.014 240)"
                            : `color-mix(in oklab, oklch(0.78 0.16 65) ${20 + intensity * 80}%, transparent)`,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display font-semibold mb-4">Progresso por empresa</h3>
        <div className="space-y-3">
          {byCompany.map((b) => {
            const max = Math.max(1, ...byCompany.map((x) => x.completed));
            const pct = Math.round((b.completed / max) * 100);
            return (
              <div key={b.company} className="flex items-center gap-4">
                <div className="w-28 shrink-0">
                  <CompanyTag company={b.company} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{b.completed} tarefas</span>
                    <span className="font-mono text-xs">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: COMPANY_COLORS[b.company] }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
