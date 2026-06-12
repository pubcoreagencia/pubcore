import { useState } from "react";
import { Sparkles, Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChecklistCompanies } from "@/lib/checklist-companies";
import { toast } from "sonner";

/**
 * Banner de onboarding exibido quando o workspace ativo está vazio.
 * Permite criar a primeira empresa em um clique. Pode ser dispensado.
 */
export function OnboardingBanner() {
  const { companies, loading, canManage, create } = useChecklistCompanies();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (loading || companies.length > 0 || dismissed || !canManage) return null;

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const row = await create(trimmed);
    setBusy(false);
    if (row) {
      toast.success(`Empresa "${row.name}" criada`);
      setName("");
    } else {
      toast.error("Não foi possível criar a empresa");
    }
  };

  return (
    <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-card overflow-hidden">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary mb-2">
        <Sparkles className="h-3.5 w-3.5" /> Vamos começar
      </div>
      <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
        Cadastre sua primeira empresa
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
        Seu workspace está vazio. Crie a primeira empresa para começar a organizar processos, equipes, kanban, financeiro e estoque. Você pode adicionar quantas empresas quiser depois.
      </p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2 max-w-xl">
        <div className="relative flex-1">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ex: Minha Empresa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="pl-9"
            autoFocus
          />
        </div>
        <Button onClick={handleCreate} disabled={busy || !name.trim()}>
          {busy ? "Criando…" : "Criar empresa"}
        </Button>
      </div>
    </div>
  );
}
