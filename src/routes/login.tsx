import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Mail, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/mock-data";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const roles: { value: Role; desc: string }[] = [
  { value: "Executivo", desc: "Visão geral da holding, KPIs e decisões." },
  { value: "Marketing", desc: "Campanhas, conteúdo e CRM." },
  { value: "Logística/Comercial", desc: "Operação, entregas e pipeline." },
];

function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Executivo");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    login(email, role);
    nav({ to: "/app" });
  };

  return (
    <div className="min-h-screen flex bg-background bg-glow">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-bold text-xl tracking-tight">PUB CORE</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Holding Operating System</div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            A central operacional<br />
            <span className="text-gradient">executiva</span> da sua holding.
          </h1>
          <p className="mt-6 text-muted-foreground text-lg leading-relaxed">
            Kanban, checklists, calendário e CRM unificados — Pub 3D, Pub IA, Pub RECORDS, Pub Films, Bricks e Têxtil em uma única visão.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {["6 empresas", "5 fluxos", "1 visão"].map((s) => (
              <div key={s} className="rounded-xl border border-border bg-surface/50 p-4">
                <div className="font-display text-2xl font-bold text-gradient">{s.split(" ")[0]}</div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{s.split(" ")[1]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} PUB Holding · Todos os direitos reservados</div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-display font-bold">PUB CORE</span>
          </div>

          <h2 className="font-display text-3xl font-bold tracking-tight">Acesse o cockpit</h2>
          <p className="mt-2 text-sm text-muted-foreground">Entre com seu e-mail corporativo e selecione seu perfil.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">E-mail</label>
              <div className="mt-2 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@pub.com"
                  className="w-full rounded-lg border border-input bg-surface pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Perfil</label>
              <div className="mt-2 grid gap-2">
                {roles.map((r) => (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      role === r.value
                        ? "border-primary bg-primary/5 shadow-glow"
                        : "border-border bg-surface/40 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{r.value}</span>
                      <span className={`h-4 w-4 rounded-full border-2 ${role === r.value ? "border-primary bg-primary" : "border-border"}`} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="group w-full rounded-lg bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow hover:shadow-elegant transition-all flex items-center justify-center gap-2"
            >
              Entrar no PUB CORE
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>

          <p className="mt-6 text-[11px] text-center text-muted-foreground">
            Demo · qualquer e-mail válido funciona · sem cadastro
          </p>
        </div>
      </div>
    </div>
  );
}
