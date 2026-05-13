import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  // Produção / música
  "Produção": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Mixagem": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Master": "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "Distribuição": "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "Arte": "bg-pink-500/15 text-pink-400 border-pink-500/20",
  "Marketing": "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "Lançado": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  // Tarefas
  "Pendente": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Aprovado": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Em Revisão": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Finalizado": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Concluído": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Em andamento": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  // Comercial
  "Prospecção": "bg-slate-500/15 text-slate-400 border-slate-500/20",
  "Contato": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Negociação": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Proposta": "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "Fechado": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Perdido": "bg-red-500/15 text-red-400 border-red-500/20",
  // Prioridade
  "Alta": "bg-red-500/15 text-red-400 border-red-500/20",
  "Média": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Baixa": "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border",
        statusColors[status] || "bg-secondary text-secondary-foreground border-border",
        className,
      )}
    >
      {status}
    </span>
  );
}
