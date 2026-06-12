import { useState } from "react";
import { Building2, Loader2, Sparkles } from "lucide-react";
import { useChecklistCompanies } from "@/lib/checklist-companies";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DEFAULT_COMPANY_COLOR } from "@/lib/mock-data";

const SEGMENTS = ["Tecnologia", "Marketing", "Comércio", "Serviços", "Indústria", "Outro"];

const COLOR_SWATCHES = [
  "oklch(0.72 0.10 260)",
  "oklch(0.72 0.14 30)",
  "oklch(0.78 0.14 140)",
  "oklch(0.78 0.14 80)",
  "oklch(0.72 0.16 330)",
  "oklch(0.72 0.14 200)",
];

/**
 * Modal obrigatório de primeiro acesso: cria a primeira empresa do workspace.
 * Bloqueia o restante da aplicação enquanto não existir nenhuma empresa.
 */
export function FirstCompanyOnboarding() {
  const { companies, loading } = useChecklistCompanies();
  const { activeWorkspaceId } = useWorkspace();

  const [name, setName] = useState("");
  const [segment, setSegment] = useState<string>("");
  const [responsible, setResponsible] = useState("");
  const [color, setColor] = useState(DEFAULT_COMPANY_COLOR);
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (companies.length > 0) return null;
  if (!activeWorkspaceId) return null;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Informe o nome da empresa");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("checklist_companies").insert({
        workspace_id: activeWorkspaceId,
        name: trimmed,
        color,
        position: 0,
        segment: segment || null,
        responsible: responsible.trim() || null,
        status: "active",
      } as never);
      if (error) throw error;
      toast.success(`Empresa "${trimmed}" criada com sucesso`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Não foi possível criar a empresa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center overflow-y-auto bg-background/95 backdrop-blur-sm p-0 md:p-6 animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl my-auto md:my-6">
        <div className="relative rounded-none md:rounded-3xl border border-border/40 bg-card shadow-2xl overflow-hidden">
          <header className="px-6 md:px-10 pt-8 pb-6 text-center border-b border-border/30">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30 mb-4">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">
              Primeiro acesso
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-light tracking-tight">
              Vamos começar criando sua primeira empresa
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              A PUB CORE organiza todos os seus processos com base nas empresas cadastradas.
              Crie sua primeira empresa para começar a utilizar a plataforma.
            </p>
          </header>

          <div className="px-6 md:px-10 py-6 space-y-5 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="company-name">
                Nome da empresa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Minha Empresa"
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Segmento</Label>
                <Select value={segment} onValueChange={setSegment} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="responsible">Responsável</Label>
                <Input
                  id="responsible"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  placeholder="Opcional"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor identificadora</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-9 w-9 rounded-full ring-2 transition ${
                      color === c ? "ring-primary scale-110" : "ring-transparent hover:ring-border"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label="Escolher cor"
                  />
                ))}
              </div>
            </div>
          </div>

          <footer className="px-6 md:px-10 py-5 border-t border-border/30 bg-background/30 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Você poderá adicionar mais empresas depois.
            </p>
            <Button onClick={submit} disabled={saving || !name.trim()} className="min-w-[180px]">
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando…</>
              ) : (
                "Criar empresa e continuar"
              )}
            </Button>
          </footer>
        </div>
      </div>
    </div>
  );
}
