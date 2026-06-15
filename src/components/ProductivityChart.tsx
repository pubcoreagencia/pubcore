import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function ProductivityChart({ series }: { series: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series}>
        <defs>
          <linearGradient id="dashG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="oklch(0.78 0.16 65)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="oklch(0.28 0.014 240)"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          stroke="oklch(0.6 0.02 240)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="oklch(0.6 0.02 240)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "oklch(0.22 0.014 240)",
            border: "1px solid oklch(0.3 0.015 240)",
            borderRadius: 12,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="productivity"
          stroke="oklch(0.78 0.16 65)"
          strokeWidth={2}
          fill="url(#dashG)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
