import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { useChecklistCompanies } from "@/lib/checklist-companies";
import { CompanyTag } from "@/components/CompanyTag";

import { Bell, Lock, Palette, Building } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { isMaster, activeWorkspace } = useWorkspace();
  const { companies } = useChecklistCompanies();

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-4xl mx-auto">
      <header className="mb-5 sm:mb-8">
        <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">Conta</div>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mt-1">Configurações</h1>
      </header>

      <div className="space-y-4 sm:space-y-6">
        <section className="rounded-xl border border-border bg-card shadow-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-primary"><Building className="h-4 w-4" /></div>
            <h2 className="font-display font-bold text-lg">Perfil</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Nome" value={user?.name ?? ""} />
            <Field label="E-mail" value={user?.email ?? ""} />
            <Field label="Perfil" value={isMaster ? "MASTER" : (user?.role ?? "")} />
            <Field label="Workspace" value={activeWorkspace?.name ?? ""} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-info"><Building className="h-4 w-4" /></div>
            <h2 className="font-display font-bold text-lg">Minhas empresas</h2>
          </div>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma empresa cadastrada ainda. Adicione suas empresas na aba <strong>Centro Operacional</strong>.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {companies.map((c) => <CompanyTag key={c.id} company={c.name} />)}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-warning"><Bell className="h-4 w-4" /></div>
            <h2 className="font-display font-bold text-lg">Notificações</h2>
          </div>
          <div className="space-y-3">
            <Toggle label="Resumo diário por e-mail" defaultOn />
            <Toggle label="Alertas de tarefas críticas" defaultOn />
            <Toggle label="Notificar entregas e campanhas" />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-success"><Palette className="h-4 w-4" /></div>
            <h2 className="font-display font-bold text-lg">Aparência</h2>
          </div>
          <div className="text-sm text-muted-foreground">PUB CORE usa tema dark premium otimizado para uso prolongado em ambientes executivos.</div>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-destructive"><Lock className="h-4 w-4" /></div>
            <h2 className="font-display font-bold text-lg">Segurança</h2>
          </div>
          <button className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface transition">Trocar senha</button>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</label>
      <div className="mt-1.5 rounded-lg border border-input bg-surface px-3 py-2.5 text-sm">{value}</div>
    </div>
  );
}

function Toggle({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  return (
    <label className="flex items-center justify-between cursor-pointer rounded-lg p-3 hover:bg-surface/40 transition">
      <span className="text-sm">{label}</span>
      <span className="relative inline-block">
        <input type="checkbox" defaultChecked={defaultOn} className="peer sr-only" />
        <span className="block h-6 w-11 rounded-full bg-surface border border-border peer-checked:bg-gradient-primary peer-checked:border-primary transition" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-foreground transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
