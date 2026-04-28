import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: "primary" | "success" | "warning" | "destructive" | "info";
}

const accentMap: Record<NonNullable<Props["accent"]>, string> = {
  primary: "text-primary bg-primary/10 border-primary/20",
  success: "text-success bg-success/10 border-success/20",
  warning: "text-warning bg-warning/10 border-warning/20",
  destructive: "text-destructive bg-destructive/10 border-destructive/20",
  info: "text-info bg-info/10 border-info/20",
};

export function StatCard({ label, value, hint, icon: Icon, accent = "primary" }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          {label}
        </div>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${accentMap[accent]}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
