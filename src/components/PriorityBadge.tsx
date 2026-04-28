import type { Priority } from "@/lib/mock-data";

const styles: Record<Priority, string> = {
  "Baixa": "bg-muted text-muted-foreground",
  "Média": "bg-info/15 text-info border border-info/30",
  "Alta": "bg-warning/15 text-warning border border-warning/30",
  "Crítica": "bg-destructive/15 text-destructive border border-destructive/40",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[priority]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {priority}
    </span>
  );
}
