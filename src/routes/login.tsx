import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, ArrowRight, Lock, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "signin" | "signup" | "reset";

function LoginPage() {
  const { user, signInPassword, signUp, signInGoogle, resetPassword } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) nav({ to: "/app" });
  }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signin") {
      const { error } = await signInPassword(email, password);
      if (error) toast.error(error); else { toast.success("Bem-vindo"); nav({ to: "/app" }); }
    } else if (mode === "signup") {
      const { error } = await signUp(email, password, name || email.split("@")[0]);
      if (error) toast.error(error);
      else { toast.success("Conta criada — você já pode entrar"); setMode("signin"); }
    } else {
      const { error } = await resetPassword(email);
      if (error) toast.error(error); else toast.success("Link de redefinição enviado");
    }
    setLoading(false);
  };

  const onGoogle = async () => {
    setLoading(true);
    const { error } = await signInGoogle();
    if (error) { toast.error(error); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div className="relative flex items-center gap-4">
          <img src="/logo.png" alt="PUB" className="h-16 w-auto" />
          <div>
            <div className="font-display font-semibold text-xl tracking-tight">PUB <span className="text-primary">CORE</span></div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Operational OS</div>
          </div>
        </div>
        <div className="relative max-w-lg">
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">
            A central operacional<br />
            <span className="text-primary">executiva</span> da sua holding.
          </h1>
          <p className="mt-6 text-muted-foreground text-lg leading-relaxed">
            Kanban, checklists, calendário e CRM unificados — Pub 3D, Pub IA, Pub RECORDS, Pub Films, Bricks e Têxtil em uma única visão.
          </p>
        </div>
        <div className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} PUB Holding</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="PUB" className="h-10 w-auto" />
            <span className="font-display font-semibold">PUB <span className="text-primary">CORE</span></span>
          </div>

          <h2 className="font-display text-3xl font-bold tracking-tight">
            {mode === "signin" ? "Acesse o cockpit" : mode === "signup" ? "Crie sua conta" : "Recuperar senha"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin" ? "Entre com seu e-mail e senha." : mode === "signup" ? "Cadastre-se para começar a operar." : "Enviaremos um link de redefinição."}
          </p>

          <button
            type="button"
            onClick={onGoogle}
            disabled={loading}
            className="mt-6 w-full rounded-lg border border-border bg-surface hover:bg-surface-elevated transition py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.3 0 10-2 13.6-5.3l-6.3-5.2c-2 1.4-4.5 2.3-7.3 2.3-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.3 5.2C41 35.7 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continuar com Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground uppercase tracking-wider">
            <div className="flex-1 h-px bg-border" /> ou <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required
                  className="w-full rounded-lg border border-input bg-surface pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@pub.com"
                className="w-full rounded-lg border border-input bg-surface pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {mode !== "reset" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha (mín. 6)"
                  className="w-full rounded-lg border border-input bg-surface pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}

            <button type="submit" disabled={loading}
              className="group w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>

          <div className="mt-5 flex justify-between text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>
                <button onClick={() => setMode("reset")} className="hover:text-foreground">Esqueci a senha</button>
                <button onClick={() => setMode("signup")} className="hover:text-foreground">Criar conta</button>
              </>
            ) : (
              <button onClick={() => setMode("signin")} className="hover:text-foreground">← Voltar ao login</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
