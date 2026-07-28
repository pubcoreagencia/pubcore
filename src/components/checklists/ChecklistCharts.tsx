import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

interface DailySeriesRow {
  label: string;
  productivity: number;
}

interface TimeByCompanyRow {
  company: string;
  ms: number;
  hours: number;
}

interface TasksByCompanyRow {
  company: string;
  completed: number;
}

type ChecklistChartsProps =
  | {
      kind: "history-productivity";
      series: DailySeriesRow[];
    }
  | {
      kind: "time-by-company";
      timeByCompany: TimeByCompanyRow[];
    }
  | {
      kind: "metrics-productivity";
      series: DailySeriesRow[];
    }
  | {
      kind: "efficiency";
      productivity: number;
    }
  | {
      kind: "tasks-by-company";
      byCompany: TasksByCompanyRow[];
    };

export default function ChecklistCharts(props: ChecklistChartsProps) {
  if (props.kind === "history-productivity") {
    return <ProductivityAreaChart series={props.series} gradientId="histG" />;
  }

  if (props.kind === "time-by-company") {
    return <TimeByCompanyChart timeByCompany={props.timeByCompany} />;
  }

  if (props.kind === "metrics-productivity") {
    return <ProductivityAreaChart series={props.series} gradientId="metG" />;
  }

  if (props.kind === "efficiency") {
    return <EfficiencyChart productivity={props.productivity} />;
  }

  return <TasksByCompanyChart byCompany={props.byCompany} />;
}

function ProductivityAreaChart({
  series,
  gradientId,
}: {
  series: DailySeriesRow[];
  gradientId: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
        <Area type="monotone" dataKey="productivity" stroke="oklch(0.78 0.16 65)" strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TimeByCompanyChart({ timeByCompany }: { timeByCompany: TimeByCompanyRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={timeByCompany} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} unit="h" />
        <YAxis dataKey="company" type="category" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} width={100} />
        <Tooltip
          contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }}
          formatter={(value) => [`${Number(value).toFixed(2)} h`, "Tempo ativo"]}
        />
        <Bar dataKey="hours" fill="oklch(0.78 0.16 65)" radius={[0, 4, 4, 0]} name="Horas" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EfficiencyChart({ productivity }: { productivity: number }) {
  return (
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
  );
}

function TasksByCompanyChart({ byCompany }: { byCompany: TasksByCompanyRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={byCompany} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid stroke="oklch(0.28 0.014 240)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis dataKey="company" type="category" stroke="oklch(0.6 0.02 240)" fontSize={11} tickLine={false} axisLine={false} width={90} />
        <Tooltip contentStyle={{ background: "oklch(0.22 0.014 240)", border: "1px solid oklch(0.3 0.015 240)", borderRadius: 12, fontSize: 12 }} />
        <Bar dataKey="completed" fill="oklch(0.78 0.16 65)" radius={[0, 4, 4, 0]} name="Concluídas" />
      </BarChart>
    </ResponsiveContainer>
  );
}
