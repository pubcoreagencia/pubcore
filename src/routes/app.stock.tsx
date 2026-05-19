import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Boxes, Plus, Pencil, Trash2, Search, Settings2, GripVertical,
  ArrowDownToLine, History, LayoutGrid, Table as TableIcon, Eye, EyeOff,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/app/stock")({ component: StockPage });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

// ---------------- Types ----------------
type FieldType = "text" | "textarea" | "number" | "currency" | "select" | "date" | "boolean";

interface Company { id: string; workspace_id: string; name: string; slug: string; color: string; icon: string; position: number; }
interface Group { id: string; workspace_id: string; company_id: string; name: string; color: string; icon: string; position: number; }
interface Category { id: string; workspace_id: string; company_id: string | null; group_id: string | null; name: string; color: string; icon: string; position: number; }
interface FieldDef { id: string; workspace_id: string; company_id: string; key: string; label: string; type: FieldType; options: string[]; position: number; required: boolean; visible: boolean; is_system: boolean; }
interface Item {
  id: string; workspace_id: string; user_id: string; company_id: string | null;
  group_id: string | null; category_id: string | null;
  name: string; sku: string | null; description: string | null;
  quantity: number; min_quantity: number; cost: number; price: number;
  supplier: string | null; location: string | null; notes: string | null;
  status: string; data: Record<string, unknown>; position: number;
  updated_at: string;
  // legacy
  company?: string | null; category?: string | null;
}
type MoveKind = "entrada" | "saida" | "ajuste" | "transferencia" | "perda" | "manutencao";
interface Movement {
  id: string; workspace_id: string; company_id: string | null;
  item_id: string; item_name: string; kind: MoveKind;
  quantity: number; user_name: string | null; notes: string | null;
  occurred_at: string;
}

const DEFAULT_COMPANIES: Array<{ name: string; slug: string; color: string }> = [
  { name: "Pub 3D",      slug: "pub-3d",      color: "oklch(0.72 0.18 240)" },
  { name: "Pub IA",      slug: "pub-ia",      color: "oklch(0.72 0.20 290)" },
  { name: "Pub RECORDS", slug: "pub-records", color: "oklch(0.74 0.18 30)" },
  { name: "Pub Films",   slug: "pub-films",   color: "oklch(0.72 0.16 200)" },
  { name: "Bricks",      slug: "bricks",      color: "oklch(0.74 0.16 60)" },
  { name: "Têxtil",      slug: "textil",      color: "oklch(0.72 0.18 340)" },
];

const SYSTEM_FIELDS: Array<{ key: string; label: string; type: FieldType; position: number }> = [
  { key: "name", label: "Nome", type: "text", position: 0 },
  { key: "quantity", label: "Quantidade", type: "number", position: 1 },
  { key: "min_quantity", label: "Mínimo", type: "number", position: 2 },
  { key: "cost", label: "Custo", type: "currency", position: 3 },
  { key: "price", label: "Preço", type: "currency", position: 4 },
  { key: "sku", label: "SKU", type: "text", position: 5 },
  { key: "supplier", label: "Fornecedor", type: "text", position: 6 },
  { key: "location", label: "Localização", type: "text", position: 7 },
  { key: "notes", label: "Observações", type: "textarea", position: 8 },
];
const SYSTEM_KEYS = new Set(SYSTEM_FIELDS.map((f) => f.key));

// ---------------- Hook ----------------
function useStockData() {
  const { activeWorkspaceId } = useWorkspace();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const [co, gr, ca, fi, it, mv] = await Promise.all([
      sb.from("stock_companies").select("*").eq("workspace_id", activeWorkspaceId).order("position"),
      sb.from("stock_groups").select("*").eq("workspace_id", activeWorkspaceId).order("position"),
      sb.from("stock_categories").select("*").eq("workspace_id", activeWorkspaceId).order("position"),
      sb.from("stock_field_defs").select("*").eq("workspace_id", activeWorkspaceId).order("position"),
      sb.from("stock_items").select("*").eq("workspace_id", activeWorkspaceId).order("position"),
      sb.from("stock_movements").select("*").eq("workspace_id", activeWorkspaceId).order("occurred_at", { ascending: false }).limit(300),
    ]);
    setCompanies((co.data ?? []) as Company[]);
    setGroups((gr.data ?? []) as Group[]);
    setCategories((ca.data ?? []) as Category[]);
    setFields((fi.data ?? []) as FieldDef[]);
    setItems((it.data ?? []) as Item[]);
    setMovements((mv.data ?? []) as Movement[]);
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    refresh();
    const ch = supabase.channel(`stock-all:${activeWorkspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_companies", filter: `workspace_id=eq.${activeWorkspaceId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_groups", filter: `workspace_id=eq.${activeWorkspaceId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_categories", filter: `workspace_id=eq.${activeWorkspaceId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_field_defs", filter: `workspace_id=eq.${activeWorkspaceId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_items", filter: `workspace_id=eq.${activeWorkspaceId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements", filter: `workspace_id=eq.${activeWorkspaceId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeWorkspaceId, refresh]);

  return { companies, groups, categories, fields, items, movements, loading, refresh };
}

// ---------------- Seed ----------------
async function ensureSeed(workspaceId: string, userId: string, companies: Company[]) {
  if (companies.length > 0) return;
  const rows = DEFAULT_COMPANIES.map((c, i) => ({
    workspace_id: workspaceId, user_id: userId,
    name: c.name, slug: c.slug, color: c.color, icon: "Building2", position: i,
  }));
  const { data, error } = await sb.from("stock_companies").insert(rows).select();
  if (error) { console.error(error); return; }
  const created = (data ?? []) as Company[];
  // create system fields per company
  const fieldRows = created.flatMap((co) =>
    SYSTEM_FIELDS.map((f) => ({
      workspace_id: workspaceId, user_id: userId, company_id: co.id,
      key: f.key, label: f.label, type: f.type, position: f.position,
      required: f.key === "name", visible: true, is_system: true, options: [],
    }))
  );
  await sb.from("stock_field_defs").insert(fieldRows);
}

// ---------------- Page ----------------
function StockPage() {
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const data = useStockData();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const seedRef = useRef(false);

  // Seed default companies on first load
  useEffect(() => {
    if (!activeWorkspaceId || !user?.id || data.loading) return;
    if (seedRef.current) return;
    if (data.companies.length === 0) {
      seedRef.current = true;
      ensureSeed(activeWorkspaceId, user.id, data.companies).then(() => data.refresh());
    } else {
      seedRef.current = true;
    }
  }, [activeWorkspaceId, user?.id, data.loading, data.companies, data]);

  // Persist active company per workspace
  const storageKey = activeWorkspaceId ? `stock-active-co:${activeWorkspaceId}` : null;
  useEffect(() => {
    if (!storageKey || data.companies.length === 0) return;
    const stored = localStorage.getItem(storageKey);
    if (stored && data.companies.some((c) => c.id === stored)) {
      setActiveCompanyId(stored);
    } else {
      setActiveCompanyId(data.companies[0].id);
    }
  }, [storageKey, data.companies]);
  useEffect(() => {
    if (storageKey && activeCompanyId) localStorage.setItem(storageKey, activeCompanyId);
  }, [storageKey, activeCompanyId]);

  if (!activeWorkspaceId) {
    return <div className="p-10 text-muted-foreground">Selecione um workspace para gerenciar o estoque.</div>;
  }

  const activeCompany = data.companies.find((c) => c.id === activeCompanyId) ?? null;

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-[1700px] mx-auto">
      <header className="flex flex-wrap items-start sm:items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Boxes className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">Estoque · {activeWorkspace?.name}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mt-1">
            Central de Estoque
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">
            Cada empresa tem seu próprio inventário, grupos, categorias e campos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-2">
            <History className="h-4 w-4" /> <span className="hidden sm:inline">Histórico</span>
          </Button>
          {activeCompany && (
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="gap-2">
              <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Configurar empresa</span>
            </Button>
          )}
        </div>
      </header>

      <CompanyTabs
        companies={data.companies}
        activeId={activeCompanyId}
        onSelect={setActiveCompanyId}
        workspaceId={activeWorkspaceId}
        userId={user?.id ?? ""}
      />

      {activeCompany ? (
        <CompanyView
          company={activeCompany}
          data={data}
          workspaceId={activeWorkspaceId}
          userId={user?.id ?? ""}
          userName={user?.name ?? null}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card/40 p-12 text-center text-muted-foreground">
          {data.loading ? "Carregando…" : "Crie uma empresa para começar."}
        </div>
      )}

      {activeCompany && (
        <CompanyConfigDialog
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          company={activeCompany}
          data={data}
          workspaceId={activeWorkspaceId}
          userId={user?.id ?? ""}
        />
      )}
      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        movements={data.movements}
        companies={data.companies}
      />
    </div>
  );
}

// ---------------- Company Tabs ----------------
function CompanyTabs({
  companies, activeId, onSelect, workspaceId, userId,
}: {
  companies: Company[]; activeId: string | null; onSelect: (id: string) => void;
  workspaceId: string; userId: string;
}) {
  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = companies.findIndex((c) => c.id === e.active.id);
    const newIdx = companies.findIndex((c) => c.id === e.over!.id);
    const reordered = arrayMove(companies, oldIdx, newIdx);
    await Promise.all(reordered.map((c, i) =>
      sb.from("stock_companies").update({ position: i }).eq("id", c.id)
    ));
  };

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={companies.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-center gap-2">
              {companies.map((c) => (
                <CompanyChip
                  key={c.id} company={c}
                  active={activeId === c.id}
                  onSelect={() => onSelect(c.id)}
                  onEdit={() => setEditing(c)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button variant="outline" size="sm" onClick={() => setCreating(true)} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Empresa
        </Button>
      </div>

      <CompanyDialog
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        company={editing}
        workspaceId={workspaceId}
        userId={userId}
        nextPosition={companies.length}
      />
    </>
  );
}

function CompanyChip({ company, active, onSelect, onEdit }: {
  company: Company; active: boolean; onSelect: () => void; onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: company.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}
      className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all cursor-pointer shrink-0 ${
        active ? "border-2 shadow-sm" : "border-border bg-card/50 hover:bg-card text-muted-foreground"
      }`}
      onClick={onSelect}
      {...(active ? { style: { ...style, borderColor: company.color, backgroundColor: `color-mix(in oklab, ${company.color} 12%, transparent)`, color: company.color } } : {})}
    >
      <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab" aria-label="Reordenar">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: company.color }} />
      {company.name}
      <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="opacity-0 group-hover:opacity-60 hover:opacity-100" aria-label="Editar">
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

function CompanyDialog({ open, onClose, company, workspaceId, userId, nextPosition }: {
  open: boolean; onClose: () => void; company: Company | null;
  workspaceId: string; userId: string; nextPosition: number;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("oklch(0.74 0.16 60)");
  useEffect(() => {
    if (open) { setName(company?.name ?? ""); setColor(company?.color ?? "oklch(0.74 0.16 60)"); }
  }, [open, company]);

  const save = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    if (company) {
      const { error } = await sb.from("stock_companies").update({ name, color }).eq("id", company.id);
      if (error) return toast.error("Erro ao salvar");
      toast.success("Empresa atualizada");
    } else {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
      const { data, error } = await sb.from("stock_companies").insert({
        workspace_id: workspaceId, user_id: userId, name, slug, color, position: nextPosition,
      }).select().single();
      if (error || !data) return toast.error("Erro ao criar");
      // seed fields
      await sb.from("stock_field_defs").insert(SYSTEM_FIELDS.map((f) => ({
        workspace_id: workspaceId, user_id: userId, company_id: data.id,
        key: f.key, label: f.label, type: f.type, position: f.position,
        required: f.key === "name", visible: true, is_system: true, options: [],
      })));
      toast.success("Empresa criada");
    }
    onClose();
  };

  const remove = async () => {
    if (!company) return;
    if (!confirm(`Excluir a empresa "${company.name}" e todo seu inventário?`)) return;
    await sb.from("stock_items").delete().eq("company_id", company.id);
    await sb.from("stock_categories").delete().eq("company_id", company.id);
    await sb.from("stock_groups").delete().eq("company_id", company.id);
    await sb.from("stock_field_defs").delete().eq("company_id", company.id);
    await sb.from("stock_movements").delete().eq("company_id", company.id);
    await sb.from("stock_companies").delete().eq("id", company.id);
    toast.success("Empresa removida");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company ? "Editar empresa" : "Nova empresa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                "oklch(0.72 0.18 240)","oklch(0.72 0.20 290)","oklch(0.74 0.18 30)",
                "oklch(0.72 0.16 200)","oklch(0.74 0.16 60)","oklch(0.72 0.18 340)",
                "oklch(0.74 0.16 140)","oklch(0.72 0.16 100)",
              ].map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? "scale-110 border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {company && (
              <Button variant="ghost" onClick={remove} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Company View ----------------
function CompanyView({
  company, data, workspaceId, userId, userName,
}: {
  company: Company; data: ReturnType<typeof useStockData>;
  workspaceId: string; userId: string; userName: string | null;
}) {
  const groups = data.groups.filter((g) => g.company_id === company.id);
  const categories = data.categories.filter((c) => c.company_id === company.id);
  const fields = data.fields.filter((f) => f.company_id === company.id).sort((a, b) => a.position - b.position);
  const items = useMemo(
    () => data.items.filter((i) => i.company_id === company.id).sort((a, b) => a.position - b.position),
    [data.items, company.id]
  );

  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const effectiveView = isMobile ? "cards" : view;
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [movingItem, setMovingItem] = useState<Item | null>(null);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (groupFilter !== "all" && i.group_id !== groupFilter) return false;
      if (categoryFilter !== "all" && i.category_id !== categoryFilter) return false;
      if (q) {
        const hay = `${i.name} ${i.sku ?? ""} ${i.supplier ?? ""} ${i.location ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, groupFilter, categoryFilter, q]);

  // KPIs
  const totalUnits = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const totalValue = items.reduce((s, i) => s + Number(i.quantity) * Number(i.cost), 0);
  const critical = items.filter((i) => Number(i.quantity) <= Number(i.min_quantity)).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Itens" value={String(items.length)} accent={company.color} />
        <Kpi label="Unidades" value={totalUnits.toLocaleString("pt-BR")} accent={company.color} />
        <Kpi label="Valor total" value={BRL(totalValue)} accent={company.color} />
        <Kpi label="Críticos" value={String(critical)} accent={critical > 0 ? "oklch(0.65 0.22 25)" : company.color} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, SKU, fornecedor, local…" className="pl-9" />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Grupo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex rounded-md border border-border overflow-hidden">
          <button onClick={() => setView("table")} className={`px-2 py-1.5 ${view === "table" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
            <TableIcon className="h-4 w-4" />
          </button>
          <button onClick={() => setView("cards")} className={`px-2 py-1.5 ${view === "cards" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
        <Button onClick={() => { setEditingItem(null); setCreatingItem(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      {view === "table" ? (
        <ItemsTable
          items={filtered}
          allItems={items}
          fields={fields}
          groups={groups}
          categories={categories}
          onEdit={(i) => setEditingItem(i)}
          onMove={(i) => setMovingItem(i)}
        />
      ) : (
        <ItemsCards items={filtered} fields={fields} onEdit={setEditingItem} onMove={setMovingItem} accent={company.color} />
      )}

      {(editingItem || creatingItem) && (
        <ItemDialog
          open={!!editingItem || creatingItem}
          onClose={() => { setEditingItem(null); setCreatingItem(false); }}
          item={editingItem}
          company={company}
          fields={fields}
          groups={groups}
          categories={categories}
          workspaceId={workspaceId}
          userId={userId}
          nextPosition={items.length}
        />
      )}
      {movingItem && (
        <MovementDialog
          open={!!movingItem}
          onClose={() => setMovingItem(null)}
          item={movingItem}
          workspaceId={workspaceId}
          userId={userId}
          userName={userName}
          companyId={company.id}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-semibold mt-1.5 tracking-tight" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

// ---------------- Items table (inline edit + dnd) ----------------
function ItemsTable({
  items, allItems, fields, groups, categories, onEdit, onMove,
}: {
  items: Item[]; allItems: Item[]; fields: FieldDef[]; groups: Group[]; categories: Category[];
  onEdit: (i: Item) => void; onMove: (i: Item) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const visibleFields = fields.filter((f) => f.visible);

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = allItems.findIndex((i) => i.id === e.active.id);
    const newIdx = allItems.findIndex((i) => i.id === e.over!.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(allItems, oldIdx, newIdx);
    await Promise.all(reordered.map((it, i) =>
      sb.from("stock_items").update({ position: i }).eq("id", it.id)
    ));
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este item?")) return;
    const { error } = await sb.from("stock_items").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir"); else toast.success("Item removido");
  };

  if (items.length === 0) {
    return <div className="rounded-xl border border-border bg-card/30 py-16 text-center text-muted-foreground">Nenhum item — clique em "Novo item" para começar.</div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card/30 overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="w-8"></th>
              {visibleFields.map((f) => (
                <th key={f.id} className="px-3 py-2.5 font-medium">{f.label}</th>
              ))}
              <th className="px-3 py-2.5 font-medium">Grupo</th>
              <th className="px-3 py-2.5 font-medium">Categoria</th>
              <th className="px-3 py-2.5 w-24 text-right">Ações</th>
            </tr>
          </thead>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {items.map((it) => (
                <ItemRow
                  key={it.id} item={it} fields={visibleFields}
                  groups={groups} categories={categories}
                  onEdit={() => onEdit(it)}
                  onMove={() => onMove(it)}
                  onDelete={() => remove(it.id)}
                />
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  );
}

function ItemRow({ item, fields, groups, categories, onEdit, onMove, onDelete }: {
  item: Item; fields: FieldDef[]; groups: Group[]; categories: Category[];
  onEdit: () => void; onMove: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const lowStock = Number(item.quantity) <= Number(item.min_quantity);
  const group = groups.find((g) => g.id === item.group_id);
  const cat = categories.find((c) => c.id === item.category_id);

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 group">
      <td className="px-1.5 py-1">
        <button {...attributes} {...listeners}
          className="opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab p-1" aria-label="Reordenar">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      {fields.map((f) => (
        <td key={f.id} className="px-1 py-0.5 align-middle">
          <InlineCell item={item} field={f} lowStock={lowStock && f.key === "quantity"} />
        </td>
      ))}
      <td className="px-3 py-1 text-muted-foreground text-xs">
        {group ? <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: group.color }} />{group.name}</span> : "—"}
      </td>
      <td className="px-3 py-1 text-muted-foreground text-xs">
        {cat ? <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</span> : "—"}
      </td>
      <td className="px-3 py-1 text-right">
        <div className="flex items-center gap-0.5 justify-end opacity-60 group-hover:opacity-100">
          <Button size="sm" variant="ghost" onClick={onMove} title="Movimentar">
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} title="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} title="Excluir">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function InlineCell({ item, field, lowStock }: { item: Item; field: FieldDef; lowStock?: boolean }) {
  const isSystem = SYSTEM_KEYS.has(field.key);
  const initial = isSystem
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? ((item as any)[field.key] as unknown)
    : (item.data?.[field.key] as unknown);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(initial == null ? "" : String(initial));
  useEffect(() => { setValue(initial == null ? "" : String(initial)); }, [initial]);

  const save = async () => {
    setEditing(false);
    let parsed: unknown = value;
    if (field.type === "number" || field.type === "currency") parsed = value === "" ? 0 : Number(value);
    if (field.type === "boolean") parsed = value === "true";
    const original = initial == null ? "" : String(initial);
    if (String(value) === original) return;

    let payload: Record<string, unknown>;
    if (isSystem) {
      payload = { [field.key]: parsed };
    } else {
      payload = { data: { ...(item.data ?? {}), [field.key]: parsed } };
    }
    const { error } = await sb.from("stock_items").update(payload).eq("id", item.id);
    if (error) toast.error("Erro ao salvar");
  };

  if (editing) {
    if (field.type === "select") {
      return (
        <Select defaultValue={value} onValueChange={(v) => { setValue(v); setTimeout(save, 0); }}>
          <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        autoFocus value={value}
        type={field.type === "number" || field.type === "currency" ? "number" : field.type === "date" ? "date" : "text"}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setValue(String(initial ?? "")); setEditing(false); } }}
        className="h-8 text-sm"
      />
    );
  }

  let display = value || "—";
  if (field.type === "currency") display = BRL(Number(value || 0));
  if (field.type === "boolean") display = value === "true" ? "Sim" : "Não";

  return (
    <button onClick={() => setEditing(true)}
      className={`w-full text-left px-2 py-1.5 rounded hover:bg-secondary/60 truncate text-sm ${lowStock ? "text-destructive font-medium" : ""}`}>
      {display}
    </button>
  );
}

// ---------------- Cards view ----------------
function ItemsCards({ items, fields, onEdit, onMove, accent }: {
  items: Item[]; fields: FieldDef[]; onEdit: (i: Item) => void; onMove: (i: Item) => void; accent: string;
}) {
  if (items.length === 0) return <div className="rounded-xl border border-border bg-card/30 py-16 text-center text-muted-foreground">Nenhum item.</div>;
  const visibleFields = fields.filter((f) => f.visible && f.key !== "name").slice(0, 6);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map((i) => (
        <div key={i.id} className="rounded-xl border border-border bg-card/50 p-4 hover:border-primary/40 transition-colors group">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="font-medium leading-tight">{i.name}</div>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
              <Button size="sm" variant="ghost" onClick={() => onMove(i)}><ArrowDownToLine className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(i)}><Pencil className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="space-y-1 text-xs">
            {visibleFields.map((f) => {
              const isSystem = SYSTEM_KEYS.has(f.key);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const v = isSystem ? (i as any)[f.key] : i.data?.[f.key];
              const display = f.type === "currency" ? BRL(Number(v || 0)) : (v == null || v === "" ? "—" : String(v));
              return (
                <div key={f.id} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-medium" style={f.key === "quantity" && Number(v) <= Number(i.min_quantity) ? { color: "oklch(0.65 0.22 25)" } : undefined}>{display}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 text-[10px] uppercase tracking-wider" style={{ color: accent }}>
            {i.sku ?? "sem SKU"}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Item Dialog ----------------
function ItemDialog({
  open, onClose, item, company, fields, groups, categories, workspaceId, userId, nextPosition,
}: {
  open: boolean; onClose: () => void; item: Item | null; company: Company;
  fields: FieldDef[]; groups: Group[]; categories: Category[];
  workspaceId: string; userId: string; nextPosition: number;
}) {
  const sortedFields = [...fields].sort((a, b) => a.position - b.position);
  const [base, setBase] = useState<Record<string, unknown>>({});
  const [data, setData] = useState<Record<string, unknown>>({});
  const [groupId, setGroupId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setBase({
        name: item.name, sku: item.sku ?? "", quantity: item.quantity,
        min_quantity: item.min_quantity, cost: item.cost, price: item.price,
        supplier: item.supplier ?? "", location: item.location ?? "", notes: item.notes ?? "",
      });
      setData(item.data ?? {});
      setGroupId(item.group_id);
      setCategoryId(item.category_id);
    } else {
      setBase({ name: "", quantity: 0, min_quantity: 0, cost: 0, price: 0 });
      setData({});
      setGroupId(null);
      setCategoryId(null);
    }
  }, [open, item]);

  const setField = (key: string, value: unknown) => {
    if (SYSTEM_KEYS.has(key)) setBase((b) => ({ ...b, [key]: value }));
    else setData((d) => ({ ...d, [key]: value }));
  };

  const save = async () => {
    if (!String(base.name ?? "").trim()) return toast.error("Nome obrigatório");
    const payload = {
      ...base, data,
      company_id: company.id, group_id: groupId, category_id: categoryId,
      company: company.name, // keep legacy column populated
    };
    if (item) {
      const { error } = await sb.from("stock_items").update(payload).eq("id", item.id);
      if (error) return toast.error("Erro ao salvar");
      toast.success("Item atualizado");
    } else {
      const { error } = await sb.from("stock_items").insert({
        ...payload, workspace_id: workspaceId, user_id: userId, position: nextPosition,
      });
      if (error) return toast.error("Erro ao criar");
      toast.success("Item criado");
    }
    onClose();
  };

  const filteredCategories = categoryId
    ? categories
    : categories.filter((c) => !groupId || c.group_id === groupId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Grupo</Label>
              <Select value={groupId ?? "none"} onValueChange={(v) => { setGroupId(v === "none" ? null : v); setCategoryId(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem grupo —</SelectItem>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoryId ?? "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem categoria —</SelectItem>
                  {filteredCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {sortedFields.map((f) => {
              const value = SYSTEM_KEYS.has(f.key) ? base[f.key] : data[f.key];
              const wide = f.type === "textarea";
              return (
                <div key={f.id} className={wide ? "col-span-2" : ""}>
                  <Label>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
                  <FieldInput field={f} value={value} onChange={(v) => setField(f.key, v)} />
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const v = value == null ? "" : String(value);
  if (field.type === "textarea") return <Textarea value={v} onChange={(e) => onChange(e.target.value)} rows={3} />;
  if (field.type === "select") return (
    <Select value={v || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
      <SelectContent>
        {field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  if (field.type === "boolean") return (
    <div className="flex items-center h-10"><Switch checked={value === true || v === "true"} onCheckedChange={onChange} /></div>
  );
  if (field.type === "date") return <Input type="date" value={v} onChange={(e) => onChange(e.target.value)} />;
  if (field.type === "number" || field.type === "currency") return <Input type="number" step="0.01" value={v} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />;
  return <Input value={v} onChange={(e) => onChange(e.target.value)} />;
}

// ---------------- Movement Dialog ----------------
function MovementDialog({ open, onClose, item, workspaceId, userId, userName, companyId }: {
  open: boolean; onClose: () => void; item: Item;
  workspaceId: string; userId: string; userName: string | null; companyId: string;
}) {
  const [kind, setKind] = useState<MoveKind>("entrada");
  const [qty, setQty] = useState<number>(1);
  const [notes, setNotes] = useState("");

  useEffect(() => { if (open) { setKind("entrada"); setQty(1); setNotes(""); } }, [open]);

  const save = async () => {
    if (qty <= 0) return toast.error("Quantidade > 0");
    const signed = kind === "entrada" ? qty : kind === "saida" || kind === "perda" ? -qty : kind === "ajuste" ? qty : -qty;
    const newQty = Number(item.quantity) + signed;
    const [a, b] = await Promise.all([
      sb.from("stock_items").update({ quantity: newQty }).eq("id", item.id),
      sb.from("stock_movements").insert({
        workspace_id: workspaceId, user_id: userId, company_id: companyId,
        item_id: item.id, item_name: item.name, kind, quantity: signed,
        user_name: userName, notes: notes || null,
      }),
    ]);
    if (a.error || b.error) return toast.error("Erro");
    toast.success("Movimentação registrada");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Movimentar — {item.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as MoveKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="perda">Perda</SelectItem>
                <SelectItem value="manutencao">Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="text-xs text-muted-foreground">
            Estoque atual: <strong>{item.quantity}</strong>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Config Dialog (Groups, Categories, Fields) ----------------
function CompanyConfigDialog({ open, onClose, company, data, workspaceId, userId }: {
  open: boolean; onClose: () => void; company: Company;
  data: ReturnType<typeof useStockData>; workspaceId: string; userId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: company.color }} />
            Configurar — {company.name}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="groups">
          <TabsList>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="fields">Campos</TabsTrigger>
          </TabsList>
          <TabsContent value="groups" className="mt-4">
            <GroupsManager
              groups={data.groups.filter((g) => g.company_id === company.id).sort((a, b) => a.position - b.position)}
              workspaceId={workspaceId} userId={userId} companyId={company.id}
            />
          </TabsContent>
          <TabsContent value="categories" className="mt-4">
            <CategoriesManager
              categories={data.categories.filter((c) => c.company_id === company.id).sort((a, b) => a.position - b.position)}
              groups={data.groups.filter((g) => g.company_id === company.id)}
              workspaceId={workspaceId} userId={userId} companyId={company.id}
            />
          </TabsContent>
          <TabsContent value="fields" className="mt-4">
            <FieldsManager
              fields={data.fields.filter((f) => f.company_id === company.id).sort((a, b) => a.position - b.position)}
              workspaceId={workspaceId} userId={userId} companyId={company.id}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const PALETTE = [
  "oklch(0.72 0.18 240)","oklch(0.72 0.20 290)","oklch(0.74 0.18 30)",
  "oklch(0.72 0.16 200)","oklch(0.74 0.16 60)","oklch(0.72 0.18 340)",
  "oklch(0.74 0.16 140)","oklch(0.72 0.16 100)",
];

function GroupsManager({ groups, workspaceId, userId, companyId }: {
  groups: Group[]; workspaceId: string; userId: string; companyId: string;
}) {
  const [newName, setNewName] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const create = async () => {
    if (!newName.trim()) return;
    await sb.from("stock_groups").insert({
      workspace_id: workspaceId, user_id: userId, company_id: companyId,
      name: newName, color: PALETTE[groups.length % PALETTE.length], position: groups.length,
    });
    setNewName("");
  };
  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const o = groups.findIndex((g) => g.id === e.active.id);
    const n = groups.findIndex((g) => g.id === e.over!.id);
    const reordered = arrayMove(groups, o, n);
    await Promise.all(reordered.map((g, i) => sb.from("stock_groups").update({ position: i }).eq("id", g.id)));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Novo grupo…" onKeyDown={(e) => e.key === "Enter" && create()} />
        <Button onClick={create}><Plus className="h-4 w-4" /></Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {groups.map((g) => <ManagedRow key={g.id} id={g.id} name={g.name} color={g.color}
              onRename={async (n) => { await sb.from("stock_groups").update({ name: n }).eq("id", g.id); }}
              onColor={async (c) => { await sb.from("stock_groups").update({ color: c }).eq("id", g.id); }}
              onDelete={async () => { if (confirm(`Excluir grupo "${g.name}"?`)) await sb.from("stock_groups").delete().eq("id", g.id); }}
            />)}
            {groups.length === 0 && <div className="text-center text-muted-foreground text-sm py-4">Nenhum grupo</div>}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function CategoriesManager({ categories, groups, workspaceId, userId, companyId }: {
  categories: Category[]; groups: Group[]; workspaceId: string; userId: string; companyId: string;
}) {
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<string>("none");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const create = async () => {
    if (!newName.trim()) return;
    await sb.from("stock_categories").insert({
      workspace_id: workspaceId, user_id: userId, company_id: companyId,
      group_id: newGroup === "none" ? null : newGroup,
      name: newName, color: PALETTE[categories.length % PALETTE.length], position: categories.length,
    });
    setNewName("");
  };
  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const o = categories.findIndex((c) => c.id === e.active.id);
    const n = categories.findIndex((c) => c.id === e.over!.id);
    const reordered = arrayMove(categories, o, n);
    await Promise.all(reordered.map((c, i) => sb.from("stock_categories").update({ position: i }).eq("id", c.id)));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova categoria…" />
        <Select value={newGroup} onValueChange={setNewGroup}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Grupo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— sem grupo —</SelectItem>
            {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={create}><Plus className="h-4 w-4" /></Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {categories.map((c) => {
              const g = groups.find((x) => x.id === c.group_id);
              return <ManagedRow key={c.id} id={c.id} name={c.name} color={c.color} suffix={g?.name}
                onRename={async (n) => { await sb.from("stock_categories").update({ name: n }).eq("id", c.id); }}
                onColor={async (col) => { await sb.from("stock_categories").update({ color: col }).eq("id", c.id); }}
                onDelete={async () => { if (confirm(`Excluir categoria "${c.name}"?`)) await sb.from("stock_categories").delete().eq("id", c.id); }}
              />;
            })}
            {categories.length === 0 && <div className="text-center text-muted-foreground text-sm py-4">Nenhuma categoria</div>}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function ManagedRow({ id, name, color, suffix, onRename, onColor, onDelete }: {
  id: string; name: string; color: string; suffix?: string;
  onRename: (n: string) => Promise<void>; onColor: (c: string) => Promise<void>; onDelete: () => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  useEffect(() => setVal(name), [name]);

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-2 py-1.5 group">
      <button {...attributes} {...listeners} className="cursor-grab opacity-40 hover:opacity-100"><GripVertical className="h-4 w-4" /></button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <div className="grid grid-cols-4 gap-1 p-2">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => onColor(c)} className="h-6 w-6 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing ? (
        <Input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
          onBlur={() => { setEditing(false); if (val !== name) onRename(val); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="h-7" />
      ) : (
        <button onClick={() => setEditing(true)} className="flex-1 text-left text-sm truncate">
          {name}
          {suffix && <span className="text-muted-foreground ml-2 text-xs">· {suffix}</span>}
        </button>
      )}
      <Button size="sm" variant="ghost" onClick={onDelete} className="opacity-0 group-hover:opacity-100">
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

function FieldsManager({ fields, workspaceId, userId, companyId }: {
  fields: FieldDef[]; workspaceId: string; userId: string; companyId: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const o = fields.findIndex((f) => f.id === e.active.id);
    const n = fields.findIndex((f) => f.id === e.over!.id);
    const reordered = arrayMove(fields, o, n);
    await Promise.all(reordered.map((f, i) => sb.from("stock_field_defs").update({ position: i }).eq("id", f.id)));
  };

  const toggleVisible = async (f: FieldDef) => {
    await sb.from("stock_field_defs").update({ visible: !f.visible }).eq("id", f.id);
  };
  const remove = async (f: FieldDef) => {
    if (f.is_system) return toast.error("Campos do sistema não podem ser excluídos");
    if (!confirm(`Excluir campo "${f.label}"?`)) return;
    await sb.from("stock_field_defs").delete().eq("id", f.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">Campos exibidos como colunas. Arraste para reordenar.</p>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Campo
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {fields.map((f) => <FieldRow key={f.id} field={f}
              onToggle={() => toggleVisible(f)}
              onEdit={() => { setEditing(f); setOpen(true); }}
              onDelete={() => remove(f)} />)}
          </div>
        </SortableContext>
      </DndContext>
      <FieldDialog open={open} onClose={() => setOpen(false)} field={editing}
        workspaceId={workspaceId} userId={userId} companyId={companyId} nextPosition={fields.length} />
    </div>
  );
}

function FieldRow({ field, onToggle, onEdit, onDelete }: {
  field: FieldDef; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-2 py-1.5 group">
      <button {...attributes} {...listeners} className="cursor-grab opacity-40 hover:opacity-100"><GripVertical className="h-4 w-4" /></button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{field.label}{field.is_system && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">sistema</span>}</div>
        <div className="text-xs text-muted-foreground">{field.type} · {field.key}{field.required && " · obrigatório"}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={onToggle} title={field.visible ? "Ocultar" : "Mostrar"}>
        {field.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
      </Button>
      <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
      {!field.is_system && (
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      )}
    </div>
  );
}

function FieldDialog({ open, onClose, field, workspaceId, userId, companyId, nextPosition }: {
  open: boolean; onClose: () => void; field: FieldDef | null;
  workspaceId: string; userId: string; companyId: string; nextPosition: number;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  useEffect(() => {
    if (!open) return;
    setLabel(field?.label ?? "");
    setType(field?.type ?? "text");
    setRequired(field?.required ?? false);
    setOptionsText((field?.options ?? []).join("\n"));
  }, [open, field]);

  const save = async () => {
    if (!label.trim()) return toast.error("Rótulo obrigatório");
    const options = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (field) {
      const payload: Record<string, unknown> = { label, required, options };
      if (!field.is_system) payload.type = type;
      const { error } = await sb.from("stock_field_defs").update(payload).eq("id", field.id);
      if (error) return toast.error("Erro");
    } else {
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_" + Math.random().toString(36).slice(2, 5);
      const { error } = await sb.from("stock_field_defs").insert({
        workspace_id: workspaceId, user_id: userId, company_id: companyId,
        key, label, type, required, options, position: nextPosition, visible: true, is_system: false,
      });
      if (error) return toast.error("Erro");
    }
    toast.success("Campo salvo");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{field ? "Editar campo" : "Novo campo"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Rótulo</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as FieldType)} disabled={field?.is_system}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="textarea">Texto longo</SelectItem>
                <SelectItem value="number">Número</SelectItem>
                <SelectItem value="currency">Moeda (BRL)</SelectItem>
                <SelectItem value="select">Seleção</SelectItem>
                <SelectItem value="date">Data</SelectItem>
                <SelectItem value="boolean">Sim/Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "select" && (
            <div>
              <Label>Opções (uma por linha)</Label>
              <Textarea rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={required} onCheckedChange={setRequired} />
            <Label>Obrigatório</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- History ----------------
function HistoryDialog({ open, onClose, movements, companies }: {
  open: boolean; onClose: () => void; movements: Movement[]; companies: Company[];
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Histórico de movimentações</DialogTitle></DialogHeader>
        {movements.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">Sem movimentações ainda.</div>
        ) : (
          <div className="space-y-1">
            {movements.map((m) => {
              const co = companies.find((c) => c.id === m.company_id);
              return (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-xs text-muted-foreground w-32 shrink-0">{new Date(m.occurred_at).toLocaleString("pt-BR")}</div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.item_name}</div>
                      <div className="text-xs text-muted-foreground">{m.user_name ?? "—"}{co ? ` · ${co.name}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="capitalize">{m.kind}</Badge>
                    <span className={`font-medium tabular-nums ${m.quantity >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {m.quantity >= 0 ? "+" : ""}{m.quantity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
