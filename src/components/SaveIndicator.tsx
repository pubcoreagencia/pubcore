import { Check, Loader2, AlertCircle } from "lucide-react";
import type { SaveStatus } from "@/hooks/use-autosave";

export function SaveIndicator({ status, className = "" }: { status: SaveStatus; className?: string }) {
  if (status === "idle") return null;
  const base = `inline-flex items-center gap-1 text-[11px] ${className}`;
  if (status === "saving") {
    return (
      <span className={`${base} text-muted-foreground`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className={`${base} text-emerald-500`}>
        <Check className="h-3 w-3" /> Salvo
      </span>
    );
  }
  return (
    <span className={`${base} text-destructive`}>
      <AlertCircle className="h-3 w-3" /> Erro ao salvar
    </span>
  );
}
