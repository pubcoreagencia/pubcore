import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Plus, TrendingUp, TrendingDown, Target, CreditCard,
  Tag, Trash2, Pencil, Copy, Check, X, PiggyBank, ArrowUpRight,
  ArrowDownRight, Calendar as CalendarIcon, Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/personal-finance")({
  component: PersonalFinancePage,
});

const sb = supabase as any;

type Account = {
  id: string;
  name: string;
  kind: string;
  initial_balance: number;
  color: string | null;
  icon: string | null;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  archived: boolean;
};
type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string | null;
  icon: string | null;
};
type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category_id: string | null;
  account_id: string | null;
  date: string;
  payment_method: string | null;
  status: "paid" | "pending" | "recurring";
  recurrence: "weekly" | "monthly" | "yearly" | null;
  notes: string | null;
};
type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  notes: string | null;
  color: string | null;
};

const KIND_LABEL: Record<string, string> = {
  bank: "Conta Bancária",
  wallet: "Carteira Física",
  digital: "Carteira Digital",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
};

const PAY_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit", label: "Crédito" },
  { value: "debit", label: "Débito" },
  { value: "transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "other", label: "Outro" },
];

function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function monthKey(iso: string) {
  return iso.slice(0, 7);
}
function currentMonth() {
  return todayISO().slice(0, 7);
}

function PersonalFinancePage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterAcc, setFilterAcc] = useState<string>("all");

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    const [a, c, t, g] = await Promise.all([
      sb.from("pfin_accounts").select("*").order("created_at", { ascending: true }),
      sb.from("pfin_categories").select("*").order("name"),
      sb.from("pfin_transactions").select("*").order("date", { ascending: false }),
      sb.from("pfin_goals").select("*").order("created_at", { ascending: false }),
    ]);
    setAccounts(a.data || []);
    setCategories(c.data || []);
    setTxs(t.data || []);
    setGoals(g.data || []);
    setLoading(false);

    if ((c.data || []).length === 0) {
      await sb.rpc("pfin_seed_default_categories");
      const c2 = await sb.from("pfin_categories").select("*").order("name");
      setCategories(c2.data || []);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ===== Dashboard calculations =====
  const monthTxs = useMemo(
    () => txs.filter((t) => monthKey(t.date) === month),
    [txs, month]
  );
  const income = monthTxs.filter((t) => t.type === "income" && t.status !== "pending").reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTxs.filter((t) => t.type === "expense" && t.status !== "pending").reduce((s, t) => s + Number(t.amount), 0);
  const diff = income - expense;

  const totalBalance = useMemo(() => {
    let bal = accounts.filter((a) => !a.archived).reduce((s, a) => s + Number(a.initial_balance || 0), 0);
    for (const t of txs) {
      if (t.status === "pending") continue;
      if (t.type === "income") bal += Number(t.amount);
      else bal -= Number(t.amount);
    }
    return bal;
  }, [accounts, txs]);

  const upcomingBills = useMemo(
    () =>
      txs
        .filter((t) => t.type === "expense" && t.status === "pending")
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5),
    [txs]
  );

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxs) {
      if (t.type !== "expense" || t.status === "pending") continue;
      const k = t.category_id || "uncat";
      map.set(k, (map.get(k) || 0) + Number(t.amount));
    }
    const arr = Array.from(map.entries())
      .map(([id, total]) => {
        const cat = categories.find((c) => c.id === id);
        return { id, name: cat?.name || "Sem categoria", total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    return arr;
  }, [monthTxs, categories]);

  const filteredTxs = useMemo(() => {
    return txs.filter((t) => {
      if (monthKey(t.date) !== month) return false;
      if (filterCat !== "all" && t.category_id !== filterCat) return false;
      if (filterAcc !== "all" && t.account_id !== filterAcc) return false;
      return true;
    });
  }, [txs, month, filterCat, filterAcc]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando finanças pessoais…</div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight">
              Finanças Pessoais
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Seu organizador financeiro privado · dados visíveis apenas para você
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="w-[160px]"
          />
        </div>
      </header>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs md:text-sm text-muted-foreground flex items-start gap-2">
        <PiggyBank className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
        <span>
          <strong className="text-foreground">Espaço privado.</strong> Suas Finanças Pessoais são vinculadas apenas à sua conta — não mudam ao trocar de workspace e nenhum outro usuário (nem o Master) consegue visualizá-las.
        </span>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-4">
          <TabsTrigger value="dashboard">Painel</TabsTrigger>
          <TabsTrigger value="tx">Lançamentos</TabsTrigger>
          <TabsTrigger value="accounts">Contas/Cartões</TabsTrigger>
          <TabsTrigger value="cats">Categorias</TabsTrigger>
          <TabsTrigger value="goals">Metas</TabsTrigger>
        </TabsList>

        {/* ============ DASHBOARD ============ */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<PiggyBank className="h-4 w-4" />}
              label="Saldo atual"
              value={brl(totalBalance)}
              accent="text-foreground"
            />
            <StatCard
              icon={<ArrowUpRight className="h-4 w-4" />}
              label="Receitas do mês"
              value={brl(income)}
              accent="text-emerald-500"
            />
            <StatCard
              icon={<ArrowDownRight className="h-4 w-4" />}
              label="Despesas do mês"
              value={brl(expense)}
              accent="text-rose-500"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Resultado"
              value={brl(diff)}
              accent={diff >= 0 ? "text-emerald-500" : "text-rose-500"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Próximas contas a pagar</h2>
                <Badge variant="secondary" className="text-xs">{upcomingBills.length}</Badge>
              </div>
              {upcomingBills.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma conta pendente.</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingBills.map((t) => {
                    const cat = categories.find((c) => c.id === t.category_id);
                    return (
                      <li key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{t.description || cat?.name || "Conta"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")} · {cat?.name || "—"}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-rose-500 whitespace-nowrap">{brl(Number(t.amount))}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="font-semibold text-sm mb-3">Principais categorias de gasto</h2>
              {expensesByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem despesas neste mês.</p>
              ) : (
                <ul className="space-y-3">
                  {expensesByCategory.map((c) => {
                    const pct = expense > 0 ? Math.round((c.total / expense) * 100) : 0;
                    return (
                      <li key={c.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground">{brl(c.total)} · {pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {goals.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="font-semibold text-sm mb-3">Progresso das metas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {goals.slice(0, 6).map((g) => {
                  const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
                  return (
                    <div key={g.id} className="rounded-xl border border-border/50 p-3">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span className="truncate">{g.name}</span>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {brl(g.current_amount)} / {brl(g.target_amount)}
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </TabsContent>

        {/* ============ TRANSACTIONS ============ */}
        <TabsContent value="tx" className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex-1 flex flex-wrap gap-2">
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-[180px]"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterAcc} onValueChange={setFilterAcc}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Conta/Cartão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas contas</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TxDialog
              categories={categories}
              accounts={accounts}
              onSaved={loadAll}
              trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo lançamento</Button>}
            />
          </div>

          {filteredTxs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhum lançamento neste mês.
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredTxs.map((t) => {
                const cat = categories.find((c) => c.id === t.category_id);
                const acc = accounts.find((a) => a.id === t.account_id);
                const isIn = t.type === "income";
                return (
                  <li key={t.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isIn ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                      {isIn ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.description || cat?.name || (isIn ? "Entrada" : "Saída")}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {cat ? ` · ${cat.name}` : ""}
                        {acc ? ` · ${acc.name}` : ""}
                        {t.status === "pending" ? " · Pendente" : t.status === "recurring" ? " · Recorrente" : ""}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold whitespace-nowrap ${isIn ? "text-emerald-500" : "text-rose-500"}`}>
                      {isIn ? "+" : "-"} {brl(Number(t.amount))}
                    </div>
                    <div className="flex items-center gap-1">
                      {t.status === "pending" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Marcar como pago"
                          onClick={async () => {
                            await sb.from("pfin_transactions").update({ status: "paid" }).eq("id", t.id);
                            toast.success("Marcado como pago");
                            loadAll();
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <TxDialog
                        categories={categories}
                        accounts={accounts}
                        onSaved={loadAll}
                        editing={t}
                        trigger={<Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Duplicar"
                        onClick={async () => {
                          const { id, ...rest } = t as any;
                          await sb.from("pfin_transactions").insert({ ...rest, user_id: user!.id, date: todayISO() });
                          toast.success("Duplicado");
                          loadAll();
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Excluir"
                        onClick={async () => {
                          if (!confirm("Excluir lançamento?")) return;
                          await sb.from("pfin_transactions").delete().eq("id", t.id);
                          toast.success("Excluído");
                          loadAll();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ============ ACCOUNTS ============ */}
        <TabsContent value="accounts" className="space-y-3">
          <div className="flex justify-end">
            <AccountDialog
              onSaved={loadAll}
              trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova conta/cartão</Button>}
            />
          </div>
          {accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Cadastre suas contas, carteiras e cartões.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map((a) => {
                const txBal = txs
                  .filter((t) => t.account_id === a.id && t.status !== "pending")
                  .reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
                const bal = Number(a.initial_balance || 0) + txBal;
                return (
                  <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">{KIND_LABEL[a.kind] || a.kind}</div>
                        <div className="font-semibold truncate">{a.name}</div>
                      </div>
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center"
                        style={{ background: (a.color || "#3B82F6") + "22", color: a.color || "#3B82F6" }}
                      >
                        <CreditCard className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 text-lg font-bold">{brl(bal)}</div>
                    {a.credit_limit ? (
                      <div className="text-xs text-muted-foreground">Limite: {brl(Number(a.credit_limit))}</div>
                    ) : null}
                    <div className="flex justify-end gap-1 mt-2">
                      <AccountDialog
                        editing={a}
                        onSaved={loadAll}
                        trigger={<Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm("Excluir esta conta?")) return;
                          await sb.from("pfin_accounts").delete().eq("id", a.id);
                          loadAll();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============ CATEGORIES ============ */}
        <TabsContent value="cats" className="space-y-3">
          <div className="flex justify-end">
            <CategoryDialog onSaved={loadAll} trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova categoria</Button>} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["income", "expense"] as const).map((type) => (
              <section key={type} className="rounded-2xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  {type === "income" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-rose-500" />}
                  {type === "income" ? "Entradas" : "Saídas"}
                </h2>
                <ul className="space-y-1">
                  {categories.filter((c) => c.type === type).map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50">
                      <div className="flex items-center gap-2 text-sm">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.name}
                      </div>
                      <div className="flex gap-1">
                        <CategoryDialog editing={c} onSaved={loadAll} trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={async () => {
                            if (!confirm("Excluir categoria?")) return;
                            await sb.from("pfin_categories").delete().eq("id", c.id);
                            loadAll();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                  {categories.filter((c) => c.type === type).length === 0 && (
                    <li className="text-xs text-muted-foreground py-4 text-center">Nenhuma categoria.</li>
                  )}
                </ul>
              </section>
            ))}
          </div>
        </TabsContent>

        {/* ============ GOALS ============ */}
        <TabsContent value="goals" className="space-y-3">
          <div className="flex justify-end">
            <GoalDialog onSaved={loadAll} trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova meta</Button>} />
          </div>
          {goals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Crie suas metas: reserva, viagem, equipamento, quitar dívida…
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {goals.map((g) => {
                const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
                return (
                  <div key={g.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{g.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <GoalDialog editing={g} onSaved={loadAll} trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={async () => {
                            if (!confirm("Excluir meta?")) return;
                            await sb.from("pfin_goals").delete().eq("id", g.id);
                            loadAll();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {brl(g.current_amount)} / {brl(g.target_amount)}
                      {g.deadline ? ` · até ${new Date(g.deadline + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                    </div>
                    <Progress value={pct} className="h-2 mt-2" />
                    <div className="text-xs text-right mt-1 text-muted-foreground">{pct}%</div>
                    {g.notes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{g.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">{icon}</span>
        {label}
      </div>
      <div className={`text-lg md:text-xl font-bold ${accent || ""}`}>{value}</div>
    </div>
  );
}

// =================== DIALOGS ===================

function TxDialog({
  trigger, onSaved, editing, categories, accounts,
}: {
  trigger: React.ReactNode;
  onSaved: () => void;
  editing?: Transaction;
  categories: Category[];
  accounts: Account[];
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">(editing?.type || "expense");
  const [amount, setAmount] = useState(String(editing?.amount ?? ""));
  const [desc, setDesc] = useState(editing?.description || "");
  const [catId, setCatId] = useState<string>(editing?.category_id || "none");
  const [accId, setAccId] = useState<string>(editing?.account_id || "none");
  const [date, setDate] = useState(editing?.date || todayISO());
  const [pay, setPay] = useState<string>(editing?.payment_method || "none");
  const [status, setStatus] = useState<"paid" | "pending" | "recurring">(editing?.status || "paid");
  const [recurrence, setRecurrence] = useState<string>(editing?.recurrence || "none");
  const [notes, setNotes] = useState(editing?.notes || "");

  useEffect(() => {
    if (open && editing) {
      setType(editing.type);
      setAmount(String(editing.amount));
      setDesc(editing.description || "");
      setCatId(editing.category_id || "none");
      setAccId(editing.account_id || "none");
      setDate(editing.date);
      setPay(editing.payment_method || "none");
      setStatus(editing.status);
      setRecurrence(editing.recurrence || "none");
      setNotes(editing.notes || "");
    } else if (open && !editing) {
      setType("expense"); setAmount(""); setDesc("");
      setCatId("none"); setAccId("none"); setDate(todayISO());
      setPay("none"); setStatus("paid"); setRecurrence("none"); setNotes("");
    }
  }, [open, editing]);

  async function save() {
    const v = parseFloat(amount.replace(",", "."));
    if (!v || v <= 0) { toast.error("Valor inválido"); return; }
    const payload: any = {
      user_id: user!.id,
      type, amount: v, description: desc.trim(),
      category_id: catId === "none" ? null : catId,
      account_id: accId === "none" ? null : accId,
      date, payment_method: pay === "none" ? null : pay,
      status,
      recurrence: status === "recurring" ? (recurrence === "none" ? "monthly" : recurrence) : null,
      notes: notes.trim() || null,
    };
    const { error } = editing
      ? await sb.from("pfin_transactions").update(payload).eq("id", editing.id)
      : await sb.from("pfin_transactions").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Atualizado" : "Lançamento criado");
    setOpen(false);
    onSaved();
  }

  const visibleCats = categories.filter((c) => c.type === type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              onClick={() => setType("income")}
              className={type === "income" ? "bg-emerald-500 hover:bg-emerald-600" : ""}
            >
              <TrendingUp className="h-4 w-4 mr-1" />Entrada
            </Button>
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              onClick={() => setType("expense")}
              className={type === "expense" ? "bg-rose-500 hover:bg-rose-600" : ""}
            >
              <TrendingDown className="h-4 w-4 mr-1" />Saída
            </Button>
          </div>
          <div>
            <Label className="text-xs">Valor</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" autoFocus />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Mercado, Salário…" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={catId} onValueChange={setCatId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem categoria —</SelectItem>
                  {visibleCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Conta/Cartão</Label>
              <Select value={accId} onValueChange={setAccId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Pagamento</Label>
              <Select value={pay} onValueChange={setPay}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Não definido —</SelectItem>
                  {PAY_METHODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="recurring">Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status === "recurring" && (
              <div>
                <Label className="text-xs">Frequência</Label>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}><X className="h-4 w-4 mr-1" />Cancelar</Button>
          <Button onClick={save}><Check className="h-4 w-4 mr-1" />Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountDialog({
  trigger, onSaved, editing,
}: { trigger: React.ReactNode; onSaved: () => void; editing?: Account }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(editing?.name || "");
  const [kind, setKind] = useState(editing?.kind || "bank");
  const [initial, setInitial] = useState(String(editing?.initial_balance ?? "0"));
  const [color, setColor] = useState(editing?.color || "#3B82F6");
  const [limit, setLimit] = useState(editing?.credit_limit?.toString() || "");
  const [closing, setClosing] = useState(editing?.closing_day?.toString() || "");
  const [due, setDue] = useState(editing?.due_day?.toString() || "");

  useEffect(() => {
    if (open && editing) {
      setName(editing.name); setKind(editing.kind);
      setInitial(String(editing.initial_balance));
      setColor(editing.color || "#3B82F6");
      setLimit(editing.credit_limit?.toString() || "");
      setClosing(editing.closing_day?.toString() || "");
      setDue(editing.due_day?.toString() || "");
    } else if (open && !editing) {
      setName(""); setKind("bank"); setInitial("0"); setColor("#3B82F6");
      setLimit(""); setClosing(""); setDue("");
    }
  }, [open, editing]);

  async function save() {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    const payload: any = {
      user_id: user!.id,
      name: name.trim(), kind,
      initial_balance: parseFloat(initial.replace(",", ".")) || 0,
      color,
      credit_limit: limit ? parseFloat(limit.replace(",", ".")) : null,
      closing_day: closing ? parseInt(closing) : null,
      due_day: due ? parseInt(due) : null,
    };
    const { error } = editing
      ? await sb.from("pfin_accounts").update(payload).eq("id", editing.id)
      : await sb.from("pfin_accounts").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    setOpen(false);
    onSaved();
  }

  const isCard = kind === "credit_card" || kind === "debit_card";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova conta/cartão"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Carteira" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Saldo inicial</Label>
              <Input inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Cor</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
            </div>
          </div>
          {isCard && (
            <>
              <div>
                <Label className="text-xs">Limite</Label>
                <Input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Fechamento (dia)</Label>
                  <Input inputMode="numeric" value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="Ex: 25" />
                </div>
                <div>
                  <Label className="text-xs">Vencimento (dia)</Label>
                  <Input inputMode="numeric" value={due} onChange={(e) => setDue(e.target.value)} placeholder="Ex: 10" />
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  trigger, onSaved, editing,
}: { trigger: React.ReactNode; onSaved: () => void; editing?: Category }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(editing?.name || "");
  const [type, setType] = useState<"income" | "expense">(editing?.type || "expense");

  useEffect(() => {
    if (open && editing) { setName(editing.name); setType(editing.type); }
    else if (open) { setName(""); setType("expense"); }
  }, [open, editing]);

  async function save() {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    const payload: any = { user_id: user!.id, name: name.trim(), type };
    const { error } = editing
      ? await sb.from("pfin_categories").update(payload).eq("id", editing.id)
      : await sb.from("pfin_categories").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalDialog({
  trigger, onSaved, editing,
}: { trigger: React.ReactNode; onSaved: () => void; editing?: Goal }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(editing?.name || "");
  const [target, setTarget] = useState(String(editing?.target_amount ?? ""));
  const [current, setCurrent] = useState(String(editing?.current_amount ?? "0"));
  const [deadline, setDeadline] = useState(editing?.deadline || "");
  const [notes, setNotes] = useState(editing?.notes || "");

  useEffect(() => {
    if (open && editing) {
      setName(editing.name);
      setTarget(String(editing.target_amount));
      setCurrent(String(editing.current_amount));
      setDeadline(editing.deadline || "");
      setNotes(editing.notes || "");
    } else if (open) {
      setName(""); setTarget(""); setCurrent("0"); setDeadline(""); setNotes("");
    }
  }, [open, editing]);

  async function save() {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    const payload: any = {
      user_id: user!.id,
      name: name.trim(),
      target_amount: parseFloat(target.replace(",", ".")) || 0,
      current_amount: parseFloat(current.replace(",", ".")) || 0,
      deadline: deadline || null,
      notes: notes.trim() || null,
    };
    const { error } = editing
      ? await sb.from("pfin_goals").update(payload).eq("id", editing.id)
      : await sb.from("pfin_goals").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Editar meta" : "Nova meta"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reserva de emergência" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Valor objetivo</Label>
              <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Valor atual</Label>
              <Input inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Prazo (opcional)</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
