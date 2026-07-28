import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

type FormatCurrency = (value: number) => string;

interface MonthlySeriesRow {
  month: string;
  income: number;
  expense: number;
  profit: number;
}

interface CompanyCostRow {
  company: string;
  total: number;
}

type FinanceChartsProps =
  | {
      kind: "dashboard";
      series: MonthlySeriesRow[];
      formatCurrency: FormatCurrency;
    }
  | {
      kind: "costs-by-company";
      byCompany: CompanyCostRow[];
      formatCurrency: FormatCurrency;
    }
  | {
      kind: "monthly-profit";
      series: MonthlySeriesRow[];
      formatCurrency: FormatCurrency;
    };

export default function FinanceCharts(props: FinanceChartsProps) {
  if (props.kind === "dashboard") {
    return <DashboardFinanceChart series={props.series} formatCurrency={props.formatCurrency} />;
  }

  if (props.kind === "costs-by-company") {
    return <CostsByCompanyChart byCompany={props.byCompany} formatCurrency={props.formatCurrency} />;
  }

  return <MonthlyProfitChart series={props.series} formatCurrency={props.formatCurrency} />;
}

function DashboardFinanceChart({
  series,
  formatCurrency,
}: {
  series: MonthlySeriesRow[];
  formatCurrency: FormatCurrency;
}) {
  return (
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
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickFormatter={(value) => `R$${(Number(value) / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(value) => formatCurrency(Number(value))}
        />
        <Area type="monotone" dataKey="income" name="Entradas" stroke="var(--success)" strokeWidth={2} fill="url(#gIncome)" />
        <Area type="monotone" dataKey="expense" name="Saídas" stroke="var(--destructive)" strokeWidth={2} fill="url(#gExpense)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CostsByCompanyChart({
  byCompany,
  formatCurrency,
}: {
  byCompany: CompanyCostRow[];
  formatCurrency: FormatCurrency;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={byCompany}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
        <XAxis dataKey="company" stroke="var(--muted-foreground)" fontSize={11} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickFormatter={(value) => `R$${(Number(value) / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(value) => formatCurrency(Number(value))}
        />
        <Bar dataKey="total" name="Custo mensal" fill="var(--primary)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MonthlyProfitChart({
  series,
  formatCurrency,
}: {
  series: MonthlySeriesRow[];
  formatCurrency: FormatCurrency;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={series}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
        <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickFormatter={(value) => `R$${(Number(value) / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(value) => formatCurrency(Number(value))}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="income" name="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Saídas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="profit" name="Lucro" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
