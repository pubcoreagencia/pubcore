import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Senha atualizada"); nav({ to: "/app" }); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-glow p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-8 shadow-card">
        <div>
          <h1 className="font-display text-2xl font-bold">Redefinir senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Defina sua nova senha de acesso.</p>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha"
            className="w-full rounded-lg border border-input bg-surface pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button disabled={loading} className="w-full rounded-lg bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">
          {loading ? "Salvando..." : "Atualizar senha"}
        </button>
      </form>
    </div>
  );
}
