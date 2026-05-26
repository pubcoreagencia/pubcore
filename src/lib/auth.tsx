import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User as SupaUser } from "@supabase/supabase-js";
import type { Role } from "./mock-data";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export type AccountStatus = "pending" | "approved" | "rejected";

interface AuthCtx {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  accountStatus: AccountStatus | null;
  refreshAccountStatus: () => Promise<void>;
  signInPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signInGoogle: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function toAppUser(u: SupaUser | null | undefined, role: Role = "Executivo"): AppUser | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, string>;
  const name = meta.name || meta.full_name || (u.email ? u.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Usuário");
  return { id: u.id, email: u.email ?? "", name, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);

  const fetchStatus = async (uid: string | undefined) => {
    if (!uid) { setAccountStatus(null); return; }
    const { data } = await supabase.from("profiles").select("status").eq("id", uid).maybeSingle();
    const st = (data?.status as AccountStatus | undefined) ?? "approved";
    setAccountStatus(st);
  };

  const refreshAccountStatus = async () => {
    const { data } = await supabase.auth.getSession();
    await fetchStatus(data.session?.user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(toAppUser(s?.user));
      setTimeout(() => { fetchStatus(s?.user.id); }, 0);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(toAppUser(s?.user));
      fetchStatus(s?.user.id).finally(() => setLoading(false));
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name }, emailRedirectTo: redirectTo },
    });
    return { error: error?.message ?? null };
  };

  const signInGoogle = async () => {
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: typeof window !== "undefined" ? window.location.origin + "/app" : undefined,
    });
    if (result.error) return { error: result.error.message ?? "Falha no Google" };
    return { error: null };
  };

  const resetPassword = async (email: string) => {
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    // Limpa estado local sensível para não vazar entre usuários no mesmo navegador
    if (typeof window !== "undefined") {
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("pubcore")) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
        sessionStorage.removeItem("pubcore_calc_open");
      } catch {}
    }
  };

  return (
    <Ctx.Provider value={{ user, session, loading, accountStatus, refreshAccountStatus, signInPassword, signUp, signInGoogle, resetPassword, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
