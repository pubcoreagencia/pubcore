import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, ArrowRight, Lock, User, Clock, ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "signin" | "signup" | "reset" | "submitted";

function LoginPage() {
  const { user, signInPassword, signUp, signInGoogle, resetPassword, logout } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && mode === "signin") nav({ to: "/app" });
  }, [user, nav, mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signin") {
      const { error } = await signInPassword(email, password);
      if (error) toast.error(error); else { toast.success("Bem-vindo"); nav({ to: "/app" }); }
    } else if (mode === "signup") {
      const emailUsed = email;
      const { error } = await signUp(email, password, name || email.split("@")[0]);
      if (error) toast.error(error);
      else {
        setSubmittedEmail(emailUsed);
        setMode("submitted");
        setEmail(""); setPassword(""); setName("");
        try { await logout(); } catch {}
      }
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

  if (mode === "submitted") {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-background p-6">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-transparent to-info/10 blur-3xl" />
          <div className="rounded-2xl border border-border bg-card shadow-card p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Clock className="h-8 w-8" />
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">PUB CORE</div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Conta criada com sucesso!</h1>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Em Análise
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Sua solicitação de acesso foi recebida e está atualmente em análise por nossa equipe.
            </p>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              A aprovação normalmente ocorre em até <strong className="text-foreground">24 horas úteis</strong>. Você receberá uma notificação por e-mail assim que sua conta for aprovada e liberada para utilização.
            </p>
            {submittedEmail && (
              <div className="mt-6 rounded-xl border border-border bg-surface/50 px-4 py-3 text-left">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Conta</div>
                <div className="text-sm font-medium mt-0.5 truncate">{submittedEmail}</div>
              </div>
            )}
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span>Agradecemos seu interesse em utilizar a plataforma.</span>
            </div>
            <button
              onClick={() => setMode("signin")}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div className="relative flex items-center gap-4">
          <img src="/favicon.ico" alt="PUB" className="h-16 w-auto" />
          <div>
            <div className="font-display font-semibold text-xl tracking-tight">PUB <span className="text-primary">CORE</span></div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Operational OS</div>
          </div>
        </div>
        <div className="relative max-w-lg">
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">
            Sua plataforma de<br />
            <span className="text-primary">gestão empresarial</span>.
          </h1>
          <p className="mt-6 text-muted-foreground text-lg leading-relaxed">
            Kanban, checklists, calendário, CRM, finanças e estoque — uma só plataforma para você administrar uma ou várias empresas, do seu jeito.
          </p>
        </div>
        <div className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} PUB CORE</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/favicon.ico" alt="PUB" className="h-10 w-auto" />
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
