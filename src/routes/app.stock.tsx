import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Boxes, Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  Plus, Pencil, Trash2, Search, History, Settings2, TrendingUp, Building2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/app/stock")({ component: StockPage });

// ---------------- Types ----------------
type MoveKind = "entrada" | "saida" | "ajuste" | "transferencia" | "perda" | "manutencao";

interface Item {
  id: string; workspace_id: string; user_id: string;
  name: string; category: string | null; company: string;
  sku: string | null; description: string | null;
  quantity: number; min_quantity: number;
  cost: number; price: number;
  supplier: string | null; location: string | null;
  status: string; notes: string | null;
  updated_at: string;
}
interface Category {
  id: string; workspace_id: string; user_id: string;
  name: string; color: string; icon: string; position: number;
}
interface Movement {
  id: string; workspace_id: string; user_id: string;
  item_id: string; item_name: string; kind: MoveKind;
  quantity: number; user_name: string | null; notes: string | null;
  occurred_at: string;
}

const COMPANIES = ["Pub 3D", "Pub IA", "Pub RECORDS", "Pub Films", "Bricks", "Têxtil"];
const MOVE_LABELS: Record<MoveKind, string> = {
  entrada: "Entrada", saida: "Saída", ajuste: "Ajuste",
  transferencia: "Transferência", perda: "Perda", manutencao: "Manutenção",
};
const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ---------------- Hook ----------------
function useStockData() {
  const { activeWorkspaceId } = useWorkspace();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!activeWorkspaceId) return;
    const [i, c, m] = await Promise.all([
      sb.from("stock_items").select("*").eq("workspace_id", activeWorkspaceId).order("updated_at", { ascending: false }),
      sb.from("stock_categories").select("*").eq("workspace_id", activeWorkspaceId).order("position"),
      sb.from("stock_movements").select("*").eq("workspace_id", activeWorkspaceId).order("occurred_at", { ascending: false }).limit(200),
    ]);
    setItems((i.data ?? []) as Item[]);
    setCategories((c.data ?? []) as Category[]);
    setMovements((m.data ?? []) as Movement[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    refresh();
    const ch = supabase.channel(`stock:${activeWorkspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_items", filter: `workspace_id=eq.${activeWorkspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_categories", filter: `workspace_id=eq.${activeWorkspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements", filter: `workspace_id=eq.${activeWorkspaceId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  return { items, categories, movements, loading, refresh };
}

// ---------------- Page ----------------
function StockPage() {
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const data = useStockData();

  if (!activeWorkspaceId) {
    return (
      <div className="p-10 text-muted-foreground">Selecione um workspace para gerenciar o estoque.</div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Boxes className="h-3.5 w-3.5" /> Estoque · {activeWorkspace?.name}
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-1">
            Central de Estoque
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle operacional, movimentações e saúde do inventário da holding.
          </p>
        </div>
      </header>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="bg-card/50 border border-border">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="items">Itens</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6"><DashboardTab data={data} /></TabsContent>
        <TabsContent value="items" className="mt-6"><ItemsTab data={data} /></TabsContent>
        <TabsContent value="movements" className="mt-6"><MovementsTab data={data} /></TabsContent>
        <TabsContent value="categories" className="mt-6"><CategoriesTab data={data} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Dashboard ----------------
function Kpi({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5 backdrop-blur-sm hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10 text-primary"}`}>{icon}</div>
      </div>
      <div className="font-display text-2xl font-semibold mt-3 tracking-tight">{value}</div>
    </div>
  );
}

function DashboardTab({ data }: { data: ReturnType<typeof useStockData> }) {
  const { items, movements } = data;
  const totalItems = items.length;
  const totalUnits = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const totalValue = items.reduce((s, i) => s + Number(i.quantity) * Number(i.cost), 0);
  const critical = items.filter((i) => Number(i.quantity) <= Number(i.min_quantity));
  const byCompany = useMemo(() => {
    const map = new Map<string, { company: string; valor: number; itens: number }>();
    for (const i of items) {
      const c = i.company || "—";
      const cur = map.get(c) ?? { company: c, valor: 0, itens: 0 };
      cur.valor += Number(i.quantity) * Number(i.cost);
      cur.itens += 1;
      map.set(c, cur);
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total de itens" value={String(totalItems)} icon={<Package className="h-4 w-4" />} />
        <Kpi label="Unidades em estoque" value={totalUnits.toLocaleString("pt-BR")} icon={<Boxes className="h-4 w-4" />} />
        <Kpi label="Valor total" value={BRL(totalValue)} icon={<TrendingUp className="h-4 w-4" />} />
        <Kpi label="Itens críticos" value={String(critical.length)} icon={<AlertTriangle className="h-4 w-4" />} accent={critical.length ? "bg-destructive/15 text-destructive" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Valor por empresa</h3>
              <p className="text-xs text-muted-foreground">Distribuição do inventário</p>
            </div>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCompany}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklab, var(--border) 60%, transparent)" />
                <XAxis dataKey="company" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number) => BRL(v)}
                />
                <Bar dataKey="valor" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Itens críticos</h3>
              <p className="text-xs text-muted-foreground">Abaixo do estoque mínimo</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          {critical.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhum item crítico — estoque saudável.</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {critical.slice(0, 8).map((i) => (
                <div key={i.id} className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{i.company} · mín {i.min_quantity}</div>
                  </div>
                  <Badge variant="destructive">{i.quantity}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Movimentações recentes</h3>
            <p className="text-xs text-muted-foreground">Últimas operações de estoque</p>
          </div>
          <History className="h-4 w-4 text-muted-foreground" />
        </div>
        {movements.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Sem movimentações ainda.</div>
        ) : (
          <div className="space-y-1.5">
            {movements.slice(0, 8).map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <MovementIcon kind={m.kind} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.item_name}</div>
                    <div className="text-xs text-muted-foreground">{m.user_name ?? "—"} · {new Date(m.occurred_at).toLocaleString("pt-BR")}</div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="capitalize">{MOVE_LABELS[m.kind]}</Badge>
                  <div className="text-xs text-muted-foreground mt-0.5">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MovementIcon({ kind }: { kind: MoveKind }) {
  if (kind === "entrada") return <div className="h-7 w-7 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><ArrowDownToLine className="h-3.5 w-3.5" /></div>;
  if (kind === "saida") return <div className="h-7 w-7 rounded-md bg-rose-500/15 text-rose-400 flex items-center justify-center"><ArrowUpFromLine className="h-3.5 w-3.5" /></div>;
  return <div className="h-7 w-7 rounded-md bg-secondary text-muted-foreground flex items-center justify-center"><Settings2 className="h-3.5 w-3.5" /></div>;
}

// ---------------- Items ----------------
function ItemsTab({ data }: { data: ReturnType<typeof useStockData> }) {
  const { items, categories } = data;
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Item | null>(null);
  const [moving, setMoving] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (companyFilter !== "all" && i.company !== companyFilter) return false;
      if (q && !`${i.name} ${i.sku ?? ""} ${i.category ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, q, companyFilter]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este item?")) return;
    const { error } = await sb.from("stock_items").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir"); else toast.success("Item removido");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, SKU, categoria…" className="pl-9" />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {COMPANIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Mín</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead>Local</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">Nenhum item</TableCell></TableRow>
            ) : filtered.map((i) => {
              const low = Number(i.quantity) <= Number(i.min_quantity);
              return (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{i.sku ?? "—"}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{i.company}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{i.category ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={low ? "text-destructive" : ""}>{Number(i.quantity)}</span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{Number(i.min_quantity)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{BRL(Number(i.cost))}</TableCell>
                  <TableCell className="text-right">{BRL(Number(i.price))}</TableCell>
                  <TableCell className="text-muted-foreground">{i.location ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setMoving(i)} title="Movimentar">
                        <ArrowDownToLine className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(i.id)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ItemDialog
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        categories={categories}
        workspaceId={activeWorkspaceId!}
        userId={user?.id ?? ""}
      />
      {moving && (
        <MovementDialog
          item={moving}
          onClose={() => setMoving(null)}
          workspaceId={activeWorkspaceId!}
          userId={user?.id ?? ""}
          userName={user?.name ?? null}
        />
      )}
    </div>
  );
}

function ItemDialog({
  open, onClose, editing, categories, workspaceId, userId,
}: {
  open: boolean; onClose: () => void; editing: Item | null;
  categories: Category[]; workspaceId: string; userId: string;
}) {
  const [form, setForm] = useState<Partial<Item>>({});
  useEffect(() => {
    setForm(editing ?? {
      name: "", company: "Pub 3D", quantity: 0, min_quantity: 0,
      cost: 0, price: 0, status: "active",
    });
  }, [editing, open]);

  const save = async () => {
    if (!form.name?.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      workspace_id: workspaceId, user_id: userId,
      name: form.name.trim(),
      category: form.category ?? null,
      company: form.company ?? "Pub 3D",
      sku: form.sku ?? null,
      description: form.description ?? null,
      quantity: Number(form.quantity ?? 0),
      min_quantity: Number(form.min_quantity ?? 0),
      cost: Number(form.cost ?? 0),
      price: Number(form.price ?? 0),
      supplier: form.supplier ?? null,
      location: form.location ?? null,
      status: form.status ?? "active",
      notes: form.notes ?? null,
    };
    const res = editing
      ? await sb.from("stock_items").update(payload).eq("id", editing.id)
      : await sb.from("stock_items").insert(payload);
    if (res.error) toast.error("Erro ao salvar"); else { toast.success("Salvo"); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Empresa</Label>
            <Select value={form.company ?? "Pub 3D"} onValueChange={(v) => setForm({ ...form, company: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPANIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.category ?? ""} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>SKU</Label>
            <Input value={form.sku ?? ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <Label>Localização</Label>
            <Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" value={form.quantity ?? 0} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Mínima</Label>
            <Input type="number" value={form.min_quantity ?? 0} onChange={(e) => setForm({ ...form, min_quantity: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Custo</Label>
            <Input type="number" step="0.01" value={form.cost ?? 0} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Preço</Label>
            <Input type="number" step="0.01" value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <Label>Fornecedor</Label>
            <Input value={form.supplier ?? ""} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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

function MovementDialog({
  item, onClose, workspaceId, userId, userName,
}: {
  item: Item; onClose: () => void;
  workspaceId: string; userId: string; userName: string | null;
}) {
  const [kind, setKind] = useState<MoveKind>("entrada");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  const save = async () => {
    if (!qty || qty <= 0) { toast.error("Quantidade inválida"); return; }
    const signed =
      kind === "entrada" ? qty :
      kind === "saida" || kind === "perda" ? -qty :
      kind === "ajuste" ? qty : -qty; // transferencia / manutencao = saída
    const newQty = Number(item.quantity) + signed;
    const [mvRes, upRes] = await Promise.all([
      sb.from("stock_movements").insert({
        workspace_id: workspaceId, user_id: userId,
        item_id: item.id, item_name: item.name,
        kind, quantity: signed, user_name: userName, notes: notes || null,
      }),
      sb.from("stock_items").update({ quantity: newQty }).eq("id", item.id),
    ]);
    if (mvRes.error || upRes.error) toast.error("Erro ao registrar");
    else { toast.success("Movimentação registrada"); onClose(); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimentar — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as MoveKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MOVE_LABELS) as MoveKind[]).map((k) => (
                  <SelectItem key={k} value={k}>{MOVE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground">
            Estoque atual: <span className="text-foreground font-medium">{item.quantity}</span>
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

// ---------------- Movements tab ----------------
function MovementsTab({ data }: { data: ReturnType<typeof useStockData> }) {
  const { movements } = data;
  const [q, setQ] = useState("");
  const filtered = movements.filter((m) =>
    !q || `${m.item_name} ${m.user_name ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar movimentação…" className="pl-9" />
      </div>
      <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Observações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Sem registros</TableCell></TableRow>
            ) : filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.item_name}</TableCell>
                <TableCell><Badge variant="outline">{MOVE_LABELS[m.kind]}</Badge></TableCell>
                <TableCell className={`text-right font-medium ${m.quantity >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.user_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(m.occurred_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-muted-foreground text-xs max-w-[280px] truncate">{m.notes ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------- Categories tab ----------------
function CategoriesTab({ data }: { data: ReturnType<typeof useStockData> }) {
  const { categories } = data;
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const [name, setName] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await sb.from("stock_categories").insert({
      workspace_id: activeWorkspaceId, user_id: user?.id,
      name: name.trim(), position: categories.length,
    });
    if (error) toast.error("Erro"); else { toast.success("Categoria criada"); setName(""); }
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir categoria?")) return;
    await sb.from("stock_categories").delete().eq("id", id);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria (ex: Insumos, Embalagens)" />
        <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
      <div className="rounded-xl border border-border bg-card/30">
        {categories.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma categoria — crie a primeira acima.</div>
        ) : categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              <span className="font-medium">{c.name}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
