import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { logActivity } from "@/lib/activity-log";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle, Target, Plus,
  Trash2, Pencil, Search, PackageOpen, Receipt, Building2, Download, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";

export const Route = createFileRoute("/app/finance")({ component: FinancePage });

// ---------------- Types ----------------
type Kind = "income" | "expense";
type CostKind = "fixed" | "variable";
type Recurrence = "none" | "weekly" | "monthly" | "yearly";

interface Tx {
  id: string; workspace_id: string; user_id: string;
  kind: Kind; amount: number; description: string;
  category_id: string | null; category_name: string | null;
  company: string | null; occurred_on: string;
  recurrence: Recurrence; responsible: string | null; notes: string | null;
}
interface Cost {
  id: string; workspace_id: string; user_id: string;
  name: string; kind: CostKind; amount_monthly: number;
  company: string | null; category: string | null; notes: string | null; active: boolean;
}
interface Product {
  id: string; workspace_id: string; user_id: string;
  name: string; company: string;
  cost: number; price: number; avg_demand_monthly: number;
  stock: number; category: string | null; notes: string | null;
}

import { COMPANIES as HOLDING_COMPANIES } from "@/lib/mock-data";
const COMPANIES = [...HOLDING_COMPANIES];
const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/**
 * Robust monetary parser. Accepts "2000", "2.000", "2,000", "2.000,50",
 * "2,000.50", "R$ 2.000,50", "2000.50". Returns NaN for empty/invalid.
 * The last "," or "." encountered is treated as the decimal separator; any
 * earlier "." or "," are thousand separators and are stripped.
 */
function parseMoney(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return NaN;
  if (typeof input === "number") return input;
  const cleaned = String(input).replace(/[^\d.,-]/g, "");
  if (!cleaned) return NaN;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = cleaned;
  } else {
    const decIdx = Math.max(lastComma, lastDot);
    const intPart = cleaned.slice(0, decIdx).replace(/[.,]/g, "");
    const decPart = cleaned.slice(decIdx + 1).replace(/[.,]/g, "");
    // If "decimal" has more than 2 digits and the user only used one kind of
    // separator, treat it as a thousand separator (e.g. "2.000" → 2000).
    if (decPart.length > 2 && (lastComma === -1 || lastDot === -1)) {
      normalized = (intPart + decPart) || "0";
    } else {
      normalized = `${intPart || "0"}.${decPart || "0"}`;
    }
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

// ---------------- Data hook ----------------
function useFinanceData() {
  const { activeWorkspaceId } = useWorkspace();
  const [transactions, setTx] = useState<Tx[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!activeWorkspaceId) return;
    const [t, c, p] = await Promise.all([
      supabase.from("finance_transactions").select("*").eq("workspace_id", activeWorkspaceId).order("occurred_on", { ascending: false }),
      supabase.from("finance_costs").select("*").eq("workspace_id", activeWorkspaceId).order("created_at", { ascending: false }),
      supabase.from("finance_products").select("*").eq("workspace_id", activeWorkspaceId).order("created_at", { ascending: false }),
    ]);
    setTx((t.data ?? []) as Tx[]);
    setCosts((c.data ?? []) as Cost[]);
    setProducts((p.data ?? []) as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    refresh();
    const ch = supabase.channel(`finance:${activeWorkspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transactions", filter: `workspace_id=eq.${activeWorkspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_costs", filter: `workspace_id=eq.${activeWorkspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_products", filter: `workspace_id=eq.${activeWorkspaceId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  return { transactions, costs, products, loading, refresh };
}

// ---------------- Calculations ----------------
function calcKPIs(tx: Tx[], costs: Cost[]) {
  const now = new Date();
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const curMonth = ym(now);
  const prevMonth = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  let income = 0, expense = 0, incomeCur = 0, expenseCur = 0, incomePrev = 0, expensePrev = 0;
  for (const t of tx) {
    const m = t.occurred_on.slice(0, 7);
    if (t.kind === "income") {
      income += +t.amount;
      if (m === curMonth) incomeCur += +t.amount;
      if (m === prevMonth) incomePrev += +t.amount;
    } else {
      expense += +t.amount;
      if (m === curMonth) expenseCur += +t.amount;
      if (m === prevMonth) expensePrev += +t.amount;
    }
  }
  const fixedMonthly = costs.filter(c => c.active && c.kind === "fixed").reduce((a, c) => a + +c.amount_monthly, 0);
  const variableMonthly = costs.filter(c => c.active && c.kind === "variable").reduce((a, c) => a + +c.amount_monthly, 0);
  const totalCostsMonthly = fixedMonthly + variableMonthly;
  const profit = income - expense;
  const profitCur = incomeCur - expenseCur;
  const breakevenMonthly = totalCostsMonthly;
  const breakevenDaily = totalCostsMonthly / 30;
  return {
    income, expense, profit,
    incomeCur, expenseCur, profitCur, incomePrev, expensePrev,
    fixedMonthly, variableMonthly, totalCostsMonthly,
    breakevenMonthly, breakevenDaily,
    monthProgress: incomeCur,
    monthGap: Math.max(0, breakevenMonthly - incomeCur),
  };
}

function monthlySeries(tx: Tx[]) {
  const map = new Map<string, { month: string; income: number; expense: number; profit: number }>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, { month: d.toLocaleDateString("pt-BR", { month: "short" }), income: 0, expense: 0, profit: 0 });
  }
  for (const t of tx) {
    const k = t.occurred_on.slice(0, 7);
    const row = map.get(k);
    if (!row) continue;
    if (t.kind === "income") row.income += +t.amount;
    else row.expense += +t.amount;
    row.profit = row.income - row.expense;
  }
  return Array.from(map.values());
}

// ---------------- Page ----------------
function FinancePage() {
  const { activeWorkspace } = useWorkspace();
  const { transactions, costs, products, loading } = useFinanceData();
  const kpis = useMemo(() => calcKPIs(transactions, costs), [transactions, costs]);

  // Lista única de empresas: base canônica + valores observados nos dados.
  const companyOptions = useMemo(() => {
    const set = new Set<string>(COMPANIES);
    for (const t of transactions) if (t.company) set.add(t.company);
    for (const c of costs) if (c.company) set.add(c.company);
    for (const p of products) if (p.company) set.add(p.company);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [transactions, costs, products]);

  return (
    <div className="px-3 sm:px-6 lg:px-10 py-4 sm:py-8 max-w-[1500px] mx-auto">
      {/* Sugestões compartilhadas de empresa para inputs de texto livre */}
      <datalist id="finance-company-suggestions">
        {companyOptions.map(c => <option key={c} value={c} />)}
      </datalist>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 mb-5 sm:mb-8">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1 truncate">
            {activeWorkspace?.name ?? "Workspace"}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight flex items-center gap-2 sm:gap-3">
            <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            Finanças
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-2 max-w-xl hidden sm:block">
            Central financeira da holding — entradas, saídas, custos, produtos e breakeven em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
          <Activity className="h-3.5 w-3.5 text-success" /> <span className="hidden sm:inline">Sincronizado · </span>Realtime
        </div>
      </header>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="bg-card/60 border border-border/40 mb-4 sm:mb-6 h-auto p-1 w-full overflow-x-auto flex md:flex-wrap justify-start md:justify-center gap-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="dashboard" className="flex-shrink-0">Dashboard</TabsTrigger>
          <TabsTrigger value="tx" className="flex-shrink-0">Entradas/Saídas</TabsTrigger>
          <TabsTrigger value="costs" className="flex-shrink-0">Custos</TabsTrigger>
          <TabsTrigger value="products" className="flex-shrink-0">Produtos</TabsTrigger>
          <TabsTrigger value="breakeven" className="flex-shrink-0">Breakeven</TabsTrigger>
          <TabsTrigger value="reports" className="flex-shrink-0">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab kpis={kpis} tx={transactions} products={products} /></TabsContent>
        <TabsContent value="tx"><TransactionsTab tx={transactions} loading={loading} companyOptions={companyOptions} /></TabsContent>
        <TabsContent value="costs"><CostsTab costs={costs} /></TabsContent>
        <TabsContent value="products"><ProductsTab products={products} companyOptions={companyOptions} /></TabsContent>
        <TabsContent value="breakeven"><BreakevenTab kpis={kpis} tx={transactions} products={products} costs={costs} /></TabsContent>
        <TabsContent value="reports"><ReportsTab tx={transactions} products={products} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- KPI Card ----------------
function KpiCard({ label, value, sub, icon, tone = "default", glow = false }: {
  label: string; value: ReactNode; sub?: ReactNode;
  icon: ReactNode; tone?: "default" | "success" | "danger" | "primary"; glow?: boolean;
}) {
  const toneText =
    tone === "success" ? "text-success" :
    tone === "danger" ? "text-destructive" :
    tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className={`relative rounded-2xl border border-border/40 bg-card/60 p-3 sm:p-5 overflow-hidden min-w-0 ${glow ? "shadow-[0_0_60px_-20px_color-mix(in oklab, var(--primary) 40%, transparent)]" : ""}`}>
      {glow && <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />}
      <div className="relative flex items-start justify-between gap-2">
        <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-muted-foreground truncate">{label}</div>
        <div className="text-muted-foreground flex-shrink-0">{icon}</div>
      </div>
      <div className={`relative font-display text-xl sm:text-3xl font-semibold mt-2 sm:mt-3 truncate ${toneText}`}>{value}</div>
      {sub && <div className="relative text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-1.5 truncate">{sub}</div>}
    </div>
  );
}

// ---------------- Dashboard Tab ----------------
function DashboardTab({ kpis, tx, products }: { kpis: ReturnType<typeof calcKPIs>; tx: Tx[]; products: Product[] }) {
  const series = useMemo(() => monthlySeries(tx), [tx]);
  const profitDelta = kpis.profitCur - (kpis.incomePrev - kpis.expensePrev);

  // Top empresas (lucro = entradas - saídas no mês corrente)
  const byCompany = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>();
    const now = new Date(); const cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    for (const t of tx) {
      if (t.occurred_on.slice(0, 7) !== cur) continue;
      const k = t.company ?? "Sem empresa";
      const r = m.get(k) ?? { income: 0, expense: 0 };
      if (t.kind === "income") r.income += +t.amount; else r.expense += +t.amount;
      m.set(k, r);
    }
    return Array.from(m.entries())
      .map(([company, v]) => ({ company, profit: v.income - v.expense, income: v.income }))
      .sort((a, b) => b.profit - a.profit);
  }, [tx]);

  const topProducts = useMemo(() => [...products]
    .map(p => ({ ...p, unit: +p.price - +p.cost, monthly: (+p.price - +p.cost) * +p.avg_demand_monthly }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 6), [products]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Faturamento (mês)" value={BRL(kpis.incomeCur)} icon={<ArrowUpRight className="h-4 w-4 text-success" />}
          sub={<span>Total histórico: {BRL(kpis.income)}</span>} tone="success" glow />
        <KpiCard label="Despesas (mês)" value={BRL(kpis.expenseCur)} icon={<ArrowDownRight className="h-4 w-4 text-destructive" />}
          sub={<span>Total histórico: {BRL(kpis.expense)}</span>} />
        <KpiCard label="Lucro líquido (mês)" value={BRL(kpis.profitCur)} icon={<TrendingUp className="h-4 w-4" />}
          tone={kpis.profitCur >= 0 ? "success" : "danger"}
          sub={<span>Δ vs mês anterior: <span className={profitDelta >= 0 ? "text-success" : "text-destructive"}>{BRL(profitDelta)}</span></span>} />
        <KpiCard label="Saldo total" value={BRL(kpis.profit)} icon={<Wallet className="h-4 w-4" />}
          tone={kpis.profit >= 0 ? "success" : "danger"} sub={<span>Entradas − Saídas (todo o período)</span>} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Breakeven mensal" value={BRL(kpis.breakevenMonthly)} icon={<Target className="h-4 w-4" />} tone="primary"
          sub={<span>Custos fixos + variáveis</span>} />
        <KpiCard label="Breakeven diário" value={BRL(kpis.breakevenDaily)} icon={<Target className="h-4 w-4" />} tone="primary" />
        <KpiCard label="Custos fixos" value={BRL(kpis.fixedMonthly)} icon={<Receipt className="h-4 w-4" />} />
        <KpiCard label="Custos variáveis" value={BRL(kpis.variableMonthly)} icon={<Receipt className="h-4 w-4" />} />
      </div>

      {/* Health alert */}
      {kpis.monthGap > 0 ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-foreground">Faltam <span className="text-destructive">{BRL(kpis.monthGap)}</span> para atingir o breakeven do mês.</div>
            <div className="text-xs text-muted-foreground mt-1">Entradas atuais: {BRL(kpis.incomeCur)} · Meta: {BRL(kpis.breakevenMonthly)}</div>
            <Progress value={Math.min(100, (kpis.incomeCur / Math.max(1, kpis.breakevenMonthly)) * 100)} className="mt-3 h-2" />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-5 flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-foreground">Holding no azul este mês — superávit de {BRL(kpis.incomeCur - kpis.breakevenMonthly)}.</div>
            <div className="text-xs text-muted-foreground mt-1">Continue monitorando custos variáveis e entradas recorrentes.</div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Evolução financeira</h3>
            <p className="text-xs text-muted-foreground">Últimos 12 meses</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series}>
            <defs>
              <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => BRL(v)} />
            <Area type="monotone" dataKey="income" name="Entradas" stroke="var(--success)" strokeWidth={2} fill="url(#gIncome)" />
            <Area type="monotone" dataKey="expense" name="Saídas" stroke="var(--destructive)" strokeWidth={2} fill="url(#gExpense)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/40 bg-card/60 p-6">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Empresas mais lucrativas</h3>
          {byCompany.length === 0 ? <EmptyHint label="Sem dados no mês corrente." /> : (
            <ul className="space-y-2">
              {byCompany.map((c) => (
                <li key={c.company} className="flex items-center justify-between text-sm py-2 border-b border-border/30 last:border-0">
                  <span className="text-foreground">{c.company}</span>
                  <span className={`font-medium font-display ${c.profit >= 0 ? "text-success" : "text-destructive"}`}>{BRL(c.profit)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-border/40 bg-card/60 p-6">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2"><PackageOpen className="h-4 w-4 text-primary" /> Produtos mais rentáveis</h3>
          {topProducts.length === 0 ? <EmptyHint label="Cadastre produtos para ver o ranking." /> : (
            <ul className="space-y-2">
              {topProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-border/30 last:border-0">
                  <div className="min-w-0">
                    <div className="text-foreground truncate">{p.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.company}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium font-display text-foreground">{BRL(p.monthly)}</div>
                    <div className="text-[10px] text-muted-foreground">{p.avg_demand_monthly}/mês</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return <div className="text-xs text-muted-foreground py-6 text-center">{label}</div>;
}

// ---------------- Transactions Tab ----------------
function TransactionsTab({ tx, loading, companyOptions }: { tx: Tx[]; loading: boolean; companyOptions: string[] }) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [company, setCompany] = useState<string>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Tx | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => tx.filter(t => {
    if (filter !== "all" && t.kind !== filter) return false;
    if (company !== "all" && t.company !== company) return false;
    if (q.trim() && !`${t.description} ${t.category_name ?? ""} ${t.responsible ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [tx, filter, company, q]);

  const totalIn = filtered.filter(t => t.kind === "income").reduce((a, t) => a + +t.amount, 0);
  const totalOut = filtered.filter(t => t.kind === "expense").reduce((a, t) => a + +t.amount, 0);

  const handleDelete = async (t: Tx) => {
    await supabase.from("finance_transactions").delete().eq("id", t.id);
    await logActivity({ entity_type: "finance_transaction", entity_id: t.id, action: "deleted", title: t.description, company: t.company });
    toast.success("Transação removida");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full md:flex-1 md:min-w-[220px] order-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-9 bg-card/60" placeholder="Buscar descrição, categoria…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as never)}>
          <SelectTrigger className="flex-1 md:flex-none md:w-[140px] bg-card/60 order-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="income">Entradas</SelectItem>
            <SelectItem value="expense">Saídas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={company} onValueChange={setCompany}>
          <SelectTrigger className="flex-1 md:flex-none md:w-[160px] bg-card/60 order-3"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {companyOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 order-4 w-full md:w-auto"><Plus className="h-4 w-4" /> Nova transação</Button>
          </DialogTrigger>
          <TransactionDialog
            initial={editing} workspaceId={activeWorkspaceId} userId={user?.id ?? ""}
            onClose={() => { setOpen(false); setEditing(null); }}
          />
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border/40 bg-card/40 px-3 sm:px-4 py-2.5 sm:py-3 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">Entradas filtradas</div>
          <div className="font-display text-base sm:text-xl text-success truncate">{BRL(totalIn)}</div>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/40 px-3 sm:px-4 py-2.5 sm:py-3 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">Saídas filtradas</div>
          <div className="font-display text-base sm:text-xl text-destructive truncate">{BRL(totalOut)}</div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl border border-border/40 bg-card/40 overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_140px_120px_120px_100px_60px] gap-2 px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground border-b border-border/40">
          <div>Tipo</div><div>Descrição</div><div>Empresa</div><div>Categoria</div><div className="text-right">Valor</div><div>Data</div><div></div>
        </div>
        {loading ? <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div> :
          filtered.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma transação encontrada.</div> :
          filtered.map(t => (
            <div key={t.id} className="grid grid-cols-[80px_1fr_140px_120px_120px_100px_60px] gap-2 px-4 py-3 items-center text-sm border-b border-border/20 last:border-0 hover:bg-secondary/20 transition-colors">
              <Badge variant={t.kind === "income" ? "default" : "destructive"} className="w-fit text-[10px]">
                {t.kind === "income" ? "Entrada" : "Saída"}
              </Badge>
              <div className="min-w-0">
                <div className="truncate text-foreground">{t.description || "—"}</div>
                {t.recurrence !== "none" && <div className="text-[10px] text-muted-foreground">recorrente · {t.recurrence}</div>}
              </div>
              <div className="text-muted-foreground truncate">{t.company ?? "—"}</div>
              <div className="text-muted-foreground truncate">{t.category_name ?? "—"}</div>
              <div className={`text-right font-medium font-display ${t.kind === "income" ? "text-success" : "text-destructive"}`}>{BRL(+t.amount)}</div>
              <div className="text-muted-foreground text-xs">{new Date(t.occurred_on + "T00:00").toLocaleDateString("pt-BR")}</div>
              <div className="flex items-center justify-end gap-1">
                <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))
        }
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {loading ? <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div> :
          filtered.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground rounded-2xl border border-border/40 bg-card/40">Nenhuma transação encontrada.</div> :
          filtered.map(t => (
            <div key={t.id} className="rounded-xl border border-border/40 bg-card/50 p-3 active:bg-secondary/30 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Badge variant={t.kind === "income" ? "default" : "destructive"} className="text-[10px] flex-shrink-0">
                    {t.kind === "income" ? "Entrada" : "Saída"}
                  </Badge>
                  <div className="font-medium text-sm truncate">{t.description || "—"}</div>
                </div>
                <div className={`font-medium font-display text-sm flex-shrink-0 ${t.kind === "income" ? "text-success" : "text-destructive"}`}>{BRL(+t.amount)}</div>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {t.company && <span className="truncate">{t.company}</span>}
                  {t.category_name && <span className="opacity-60">· {t.category_name}</span>}
                  <span className="opacity-60">· {new Date(t.occurred_on + "T00:00").toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                  <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {t.recurrence !== "none" && <div className="text-[10px] text-muted-foreground mt-1">recorrente · {t.recurrence}</div>}
            </div>
          ))
        }
      </div>
    </div>
  );
}

function TransactionDialog({ initial, workspaceId, userId, onClose }: {
  initial: Tx | null; workspaceId: string | null; userId: string; onClose: () => void;
}) {
  const [form, setForm] = useState({
    kind: (initial?.kind ?? "income") as Kind,
    amount: initial?.amount?.toString() ?? "",
    description: initial?.description ?? "",
    company: initial?.company ?? "",
    category_name: initial?.category_name ?? "",
    occurred_on: initial?.occurred_on ?? new Date().toISOString().slice(0, 10),
    recurrence: (initial?.recurrence ?? "none") as Recurrence,
    responsible: initial?.responsible ?? "",
    notes: initial?.notes ?? "",
  });

  const submit = async () => {
    if (!workspaceId) return;
    const amount = parseMoney(form.amount);
    if (isNaN(amount) || amount < 0) { toast.error("Valor inválido"); return; }
    const payload = {
      workspace_id: workspaceId, user_id: userId,
      kind: form.kind, amount, description: form.description,
      company: form.company || null, category_name: form.category_name || null,
      occurred_on: form.occurred_on, recurrence: form.recurrence,
      responsible: form.responsible || null, notes: form.notes || null,
    };
    if (initial) {
      const { error } = await supabase.from("finance_transactions").update(payload).eq("id", initial.id);
      if (error) { toast.error(error.message); return; }
      await logActivity({ entity_type: "finance_transaction", entity_id: initial.id, action: "updated", title: form.description, company: form.company });
    } else {
      const { data, error } = await supabase.from("finance_transactions").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      await logActivity({ entity_type: "finance_transaction", entity_id: data?.id, action: "created", title: form.description, company: form.company });
    }
    toast.success(initial ? "Transação atualizada" : "Transação registrada");
    onClose();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{initial ? "Editar transação" : "Nova transação"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={form.kind} onValueChange={(v) => setForm(f => ({ ...f, kind: v as Kind }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Entrada</SelectItem>
              <SelectItem value="expense">Saída</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <Input value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" />
        </div>
        <div className="col-span-2">
          <Label>Descrição</Label>
          <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Venda de pacote 3D — Cliente X" />
        </div>
        <div>
          <Label>Empresa</Label>
          <Input
            value={form.company}
            onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
            placeholder="Ex: Pub 3D, Pub IA…"
            list="finance-company-suggestions"
          />
        </div>
        <div>
          <Label>Categoria</Label>
          <Input value={form.category_name} onChange={(e) => setForm(f => ({ ...f, category_name: e.target.value }))} placeholder="Ex: Vendas, Marketing…" />
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={form.occurred_on} onChange={(e) => setForm(f => ({ ...f, occurred_on: e.target.value }))} />
        </div>
        <div>
          <Label>Recorrência</Label>
          <Select value={form.recurrence} onValueChange={(v) => setForm(f => ({ ...f, recurrence: v as Recurrence }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Única</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Responsável</Label>
          <Input value={form.responsible} onChange={(e) => setForm(f => ({ ...f, responsible: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <Label>Observações</Label>
          <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit}>{initial ? "Salvar" : "Registrar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------------- Costs Tab ----------------
function CostsTab({ costs }: { costs: Cost[] }) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cost | null>(null);

  const fixed = costs.filter(c => c.kind === "fixed");
  const variable = costs.filter(c => c.kind === "variable");
  const totalFixed = fixed.filter(c => c.active).reduce((a, c) => a + +c.amount_monthly, 0);
  const totalVar = variable.filter(c => c.active).reduce((a, c) => a + +c.amount_monthly, 0);

  const byCompany = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of costs) if (c.active) m.set(c.company ?? "Sem empresa", (m.get(c.company ?? "Sem empresa") ?? 0) + +c.amount_monthly);
    return Array.from(m.entries()).map(([company, total]) => ({ company, total })).sort((a, b) => b.total - a.total);
  }, [costs]);

  const handleDelete = async (c: Cost) => {
    await supabase.from("finance_costs").delete().eq("id", c.id);
    await logActivity({ entity_type: "finance_cost", entity_id: c.id, action: "deleted", title: c.name, company: c.company });
    toast.success("Custo removido");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-3 gap-3 flex-1">
          <KpiCard label="Custos fixos / mês" value={BRL(totalFixed)} icon={<Receipt className="h-4 w-4" />} />
          <KpiCard label="Custos variáveis / mês" value={BRL(totalVar)} icon={<Receipt className="h-4 w-4" />} />
          <KpiCard label="Total operacional" value={BRL(totalFixed + totalVar)} icon={<TrendingUp className="h-4 w-4" />} tone="primary" />
        </div>
      </div>
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Novo custo</Button></DialogTrigger>
          <CostDialog initial={editing} workspaceId={activeWorkspaceId} userId={user?.id ?? ""} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CostList title="Custos fixos" items={fixed} onEdit={(c) => { setEditing(c); setOpen(true); }} onDelete={handleDelete} />
        <CostList title="Custos variáveis" items={variable} onEdit={(c) => { setEditing(c); setOpen(true); }} onDelete={handleDelete} />
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/60 p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Comparativo por empresa</h3>
        {byCompany.length === 0 ? <EmptyHint label="Sem custos cadastrados." /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byCompany}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis dataKey="company" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => BRL(v)} />
              <Bar dataKey="total" name="Custo mensal" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function CostList({ title, items, onEdit, onDelete }: { title: string; items: Cost[]; onEdit: (c: Cost) => void; onDelete: (c: Cost) => void }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
      <h3 className="font-display text-base font-semibold mb-3">{title}</h3>
      {items.length === 0 ? <EmptyHint label="Nada por aqui ainda." /> : (
        <ul className="space-y-1">
          {items.map(c => (
            <li key={c.id} className="flex items-center justify-between py-2.5 px-2 border-b border-border/20 last:border-0 hover:bg-secondary/20 rounded-md transition-colors group">
              <div className="min-w-0">
                <div className="text-sm text-foreground flex items-center gap-2">
                  {c.name}
                  {!c.active && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.company ?? "—"} · {c.category ?? "geral"}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-display text-sm text-foreground">{BRL(+c.amount_monthly)}</div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => onEdit(c)}><Pencil className="h-3.5 w-3.5" /></button>
                  <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => onDelete(c)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CostDialog({ initial, workspaceId, userId, onClose }: { initial: Cost | null; workspaceId: string | null; userId: string; onClose: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    kind: (initial?.kind ?? "fixed") as CostKind,
    amount_monthly: initial?.amount_monthly?.toString() ?? "",
    company: initial?.company ?? "",
    category: initial?.category ?? "",
    notes: initial?.notes ?? "",
    active: initial?.active ?? true,
  });

  const submit = async () => {
    if (!workspaceId) return;
    const amount_monthly = parseMoney(form.amount_monthly);
    if (!form.name.trim() || isNaN(amount_monthly)) { toast.error("Preencha nome e valor"); return; }
    const payload = {
      workspace_id: workspaceId, user_id: userId,
      name: form.name, kind: form.kind, amount_monthly,
      company: form.company || null, category: form.category || null,
      notes: form.notes || null, active: form.active,
    };
    if (initial) {
      const { error } = await supabase.from("finance_costs").update(payload).eq("id", initial.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("finance_costs").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(initial ? "Custo atualizado" : "Custo criado");
    onClose();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{initial ? "Editar custo" : "Novo custo"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div>
          <Label>Tipo</Label>
          <Select value={form.kind} onValueChange={(v) => setForm(f => ({ ...f, kind: v as CostKind }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="fixed">Fixo</SelectItem><SelectItem value="variable">Variável</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Valor mensal</Label><Input value={form.amount_monthly} onChange={(e) => setForm(f => ({ ...f, amount_monthly: e.target.value }))} placeholder="0,00" /></div>
        <div>
          <Label>Empresa</Label>
          <Input
            value={form.company}
            onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
            placeholder="Ex: Pub 3D, Pub IA…"
            list="finance-company-suggestions"
          />
        </div>
        <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Aluguel, software…" /></div>
        <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit}>{initial ? "Salvar" : "Criar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------------- Products Tab ----------------
function ProductsTab({ products, companyOptions }: { products: Product[]; companyOptions: string[] }) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const filtered = products.filter(p =>
    (filter === "all" || p.company === filter) &&
    (!q.trim() || `${p.name} ${p.category ?? ""}`.toLowerCase().includes(q.toLowerCase()))
  );

  const handleDelete = async (p: Product) => {
    await supabase.from("finance_products").delete().eq("id", p.id);
    await logActivity({ entity_type: "finance_product", entity_id: p.id, action: "deleted", title: p.name, company: p.company });
    toast.success("Produto removido");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-9 bg-card/60" placeholder="Buscar produto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px] bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {companyOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Novo produto</Button></DialogTrigger>
          <ProductDialog initial={editing} workspaceId={activeWorkspaceId} userId={user?.id ?? ""} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card/40 p-12 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <div className="text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const margin = +p.price > 0 ? ((+p.price - +p.cost) / +p.price) * 100 : 0;
            const markup = +p.cost > 0 ? ((+p.price - +p.cost) / +p.cost) * 100 : 0;
            const unit = +p.price - +p.cost;
            return (
              <div key={p.id} className="rounded-2xl border border-border/40 bg-card/60 p-5 group hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-primary">{p.company}</div>
                    <h3 className="font-display text-lg font-semibold truncate mt-0.5">{p.name}</h3>
                    {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(p)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-secondary/40 p-2"><div className="text-muted-foreground">Custo</div><div className="font-display text-sm">{BRL(+p.cost)}</div></div>
                  <div className="rounded-lg bg-secondary/40 p-2"><div className="text-muted-foreground">Preço</div><div className="font-display text-sm">{BRL(+p.price)}</div></div>
                  <div className="rounded-lg bg-success/10 p-2"><div className="text-muted-foreground">Lucro un.</div><div className="font-display text-sm text-success">{BRL(unit)}</div></div>
                  <div className="rounded-lg bg-primary/10 p-2"><div className="text-muted-foreground">Margem</div><div className="font-display text-sm text-primary">{margin.toFixed(1)}%</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Markup: <span className="text-foreground">{markup.toFixed(0)}%</span></span>
                  <span>Demanda: <span className="text-foreground">{+p.avg_demand_monthly}/mês</span></span>
                  <span>Estoque: <span className="text-foreground">{p.stock}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductDialog({ initial, workspaceId, userId, onClose }: { initial: Product | null; workspaceId: string | null; userId: string; onClose: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    company: initial?.company ?? COMPANIES[0],
    cost: initial?.cost?.toString() ?? "",
    price: initial?.price?.toString() ?? "",
    avg_demand_monthly: initial?.avg_demand_monthly?.toString() ?? "0",
    stock: initial?.stock?.toString() ?? "0",
    category: initial?.category ?? "",
    notes: initial?.notes ?? "",
  });

  const submit = async () => {
    if (!workspaceId || !form.name.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      workspace_id: workspaceId, user_id: userId,
      name: form.name, company: form.company,
      cost: parseMoney(form.cost) || 0,
      price: parseMoney(form.price) || 0,
      avg_demand_monthly: parseMoney(form.avg_demand_monthly) || 0,
      stock: parseInt(form.stock) || 0,
      category: form.category || null, notes: form.notes || null,
    };
    if (initial) {
      const { error } = await supabase.from("finance_products").update(payload).eq("id", initial.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("finance_products").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(initial ? "Produto atualizado" : "Produto criado");
    onClose();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{initial ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div>
          <Label>Empresa</Label>
          <Input
            value={form.company}
            onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
            placeholder="Ex: Pub 3D, Pub IA…"
            list="finance-company-suggestions"
          />
        </div>
        <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} /></div>
        <div><Label>Custo (R$)</Label><Input value={form.cost} onChange={(e) => setForm(f => ({ ...f, cost: e.target.value }))} /></div>
        <div><Label>Preço (R$)</Label><Input value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} /></div>
        <div><Label>Demanda média / mês</Label><Input value={form.avg_demand_monthly} onChange={(e) => setForm(f => ({ ...f, avg_demand_monthly: e.target.value }))} /></div>
        <div><Label>Estoque</Label><Input value={form.stock} onChange={(e) => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
        <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit}>{initial ? "Salvar" : "Criar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------------- Breakeven Tab ----------------
function BreakevenTab({ kpis, tx, products, costs }: {
  kpis: ReturnType<typeof calcKPIs>; tx: Tx[]; products: Product[]; costs: Cost[];
}) {
  const avgUnitProfit = useMemo(() => {
    if (products.length === 0) return 0;
    const sum = products.reduce((a, p) => a + (+p.price - +p.cost), 0);
    return sum / products.length;
  }, [products]);

  const minUnits = avgUnitProfit > 0 ? Math.ceil(kpis.breakevenMonthly / avgUnitProfit) : 0;
  const monthProgressPct = Math.min(100, (kpis.incomeCur / Math.max(1, kpis.breakevenMonthly)) * 100);

  // Empresas: lucro = entradas mês - (saídas mês + custos mensais alocados)
  const ranking = useMemo(() => {
    const now = new Date(); const cur = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const m = new Map<string, { income: number; expense: number; cost: number }>();
    for (const t of tx) {
      if (t.occurred_on.slice(0, 7) !== cur) continue;
      const k = t.company ?? "Sem empresa";
      const r = m.get(k) ?? { income: 0, expense: 0, cost: 0 }; m.set(k, r);
      if (t.kind === "income") r.income += +t.amount; else r.expense += +t.amount;
    }
    for (const c of costs) {
      if (!c.active) continue;
      const k = c.company ?? "Sem empresa";
      const r = m.get(k) ?? { income: 0, expense: 0, cost: 0 }; m.set(k, r);
      r.cost += +c.amount_monthly;
    }
    return Array.from(m.entries())
      .map(([company, v]) => ({ company, profit: v.income - v.expense - v.cost, ...v }))
      .sort((a, b) => b.profit - a.profit);
  }, [tx, costs]);

  const sustainers = ranking.filter(r => r.profit > 0);
  const losers = ranking.filter(r => r.profit < 0);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-card/60 p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in oklab, var(--primary) 15%, transparent),transparent_70%)] pointer-events-none" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Status do mês</div>
            <div className="flex items-baseline gap-3 mb-1">
              <div className="font-display text-5xl font-semibold">{monthProgressPct.toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">do breakeven</div>
            </div>
            <Progress value={monthProgressPct} className="h-2.5 mt-3 mb-4" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-muted-foreground text-xs">Entradas</div><div className="font-display text-lg text-success">{BRL(kpis.incomeCur)}</div></div>
              <div><div className="text-muted-foreground text-xs">Meta mensal</div><div className="font-display text-lg">{BRL(kpis.breakevenMonthly)}</div></div>
            </div>
            <div className={`mt-4 rounded-lg p-3 text-sm ${kpis.monthGap > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
              {kpis.monthGap > 0
                ? <>Faltam <strong>{BRL(kpis.monthGap)}</strong> para a holding ficar no azul este mês.</>
                : <>Holding no azul — superávit de <strong>{BRL(-kpis.monthGap || (kpis.incomeCur - kpis.breakevenMonthly))}</strong>.</>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Breakeven diário" value={BRL(kpis.breakevenDaily)} icon={<Target className="h-4 w-4" />} tone="primary" />
          <KpiCard label="Breakeven mensal" value={BRL(kpis.breakevenMonthly)} icon={<Target className="h-4 w-4" />} tone="primary" />
          <KpiCard label="Lucro unitário médio" value={BRL(avgUnitProfit)} icon={<PackageOpen className="h-4 w-4" />}
            sub={<span>Média entre {products.length} produto(s)</span>} />
          <KpiCard label="Vendas mínimas / mês" value={minUnits > 0 ? `${minUnits}` : "—"} icon={<TrendingUp className="h-4 w-4" />}
            sub={<span>Para cobrir custos operacionais</span>} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
          <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2 text-success">
            <ArrowUpRight className="h-4 w-4" /> Empresas sustentando a holding
          </h3>
          {sustainers.length === 0 ? <EmptyHint label="Nenhuma empresa positiva no mês." /> : (
            <ul className="space-y-2">
              {sustainers.map(r => (
                <li key={r.company} className="flex justify-between text-sm py-1.5 border-b border-success/10 last:border-0">
                  <span>{r.company}</span><span className="font-display text-success">{BRL(r.profit)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2 text-destructive">
            <ArrowDownRight className="h-4 w-4" /> Operações em prejuízo
          </h3>
          {losers.length === 0 ? <EmptyHint label="Nenhuma operação no vermelho — excelente." /> : (
            <ul className="space-y-2">
              {losers.map(r => (
                <li key={r.company} className="flex justify-between text-sm py-1.5 border-b border-destructive/10 last:border-0">
                  <span>{r.company}</span><span className="font-display text-destructive">{BRL(r.profit)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Reports Tab ----------------
function ReportsTab({ tx, products }: { tx: Tx[]; products: Product[] }) {
  const series = useMemo(() => monthlySeries(tx), [tx]);

  const byCompanyTotals = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>();
    for (const t of tx) {
      const k = t.company ?? "Sem empresa";
      const r = m.get(k) ?? { income: 0, expense: 0 }; m.set(k, r);
      if (t.kind === "income") r.income += +t.amount; else r.expense += +t.amount;
    }
    return Array.from(m.entries()).map(([company, v]) => ({
      company, income: v.income, expense: v.expense, profit: v.income - v.expense,
      margin: v.income > 0 ? ((v.income - v.expense) / v.income) * 100 : 0,
    })).sort((a, b) => b.profit - a.profit);
  }, [tx]);

  const exportCsv = () => {
    const rows = [["Tipo","Descrição","Empresa","Categoria","Valor","Data","Recorrência","Responsável"]];
    for (const t of tx) rows.push([
      t.kind === "income" ? "Entrada" : "Saída",
      t.description ?? "", t.company ?? "", t.category_name ?? "",
      String(t.amount), t.occurred_on, t.recurrence, t.responsible ?? "",
    ]);
    const csv = rows.map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `financas-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start sm:items-center gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">Relatórios e métricas</h3>
          <p className="text-xs text-muted-foreground">Exporte e analise o histórico financeiro completo.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 flex-shrink-0" onClick={exportCsv}><Download className="h-4 w-4" /> <span className="hidden sm:inline">Exportar </span>CSV</Button>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/60 p-6">
        <h3 className="font-display text-base font-semibold mb-4">Lucro mensal — 12 meses</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => BRL(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="income" name="Entradas" fill="var(--success)" radius={[4,4,0,0]} />
            <Bar dataKey="expense" name="Saídas" fill="var(--destructive)" radius={[4,4,0,0]} />
            <Bar dataKey="profit" name="Lucro" fill="var(--primary)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/40"><h3 className="font-display text-base font-semibold">Métricas por empresa</h3></div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[1fr_120px_120px_120px_100px] gap-2 px-5 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
              <div>Empresa</div><div className="text-right">Entradas</div><div className="text-right">Saídas</div><div className="text-right">Lucro</div><div className="text-right">Margem</div>
            </div>
            {byCompanyTotals.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Sem dados para reportar.</div> :
              byCompanyTotals.map(r => (
                <div key={r.company} className="grid grid-cols-[1fr_120px_120px_120px_100px] gap-2 px-5 py-3 text-sm border-b border-border/20 last:border-0">
                  <div className="truncate">{r.company}</div>
                  <div className="text-right text-success font-display">{BRL(r.income)}</div>
                  <div className="text-right text-destructive font-display">{BRL(r.expense)}</div>
                  <div className={`text-right font-display ${r.profit >= 0 ? "text-success" : "text-destructive"}`}>{BRL(r.profit)}</div>
                  <div className="text-right text-muted-foreground">{r.margin.toFixed(1)}%</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/40"><h3 className="font-display text-base font-semibold">Métricas por produto</h3></div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-2 px-5 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
              <div>Produto</div><div>Empresa</div><div className="text-right">Margem</div><div className="text-right">Demanda</div><div className="text-right">Lucro/mês</div>
            </div>
            {products.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Sem produtos cadastrados.</div> :
              [...products].sort((a, b) => ((+b.price-+b.cost)*+b.avg_demand_monthly) - ((+a.price-+a.cost)*+a.avg_demand_monthly)).map(p => {
                const margin = +p.price > 0 ? ((+p.price - +p.cost) / +p.price) * 100 : 0;
                const monthly = (+p.price - +p.cost) * +p.avg_demand_monthly;
                return (
                  <div key={p.id} className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-2 px-5 py-3 text-sm border-b border-border/20 last:border-0">
                    <div className="truncate">{p.name}</div>
                    <div className="text-muted-foreground text-xs truncate">{p.company}</div>
                    <div className="text-right text-primary">{margin.toFixed(1)}%</div>
                    <div className="text-right text-muted-foreground">{+p.avg_demand_monthly}</div>
                    <div className="text-right font-display text-success">{BRL(monthly)}</div>
                  </div>
                );
              })
            }
          </div>
        </div>
      </div>
    </div>
  );
}
