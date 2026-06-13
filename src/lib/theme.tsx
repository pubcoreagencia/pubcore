import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemeMode = "system" | "dark" | "light";
type Resolved = "dark" | "light";

const LS_KEY = "pubcore:theme";

function readLocal(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(LS_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "dark";
}

function systemPref(): Resolved {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolve(mode: ThemeMode): Resolved {
  return mode === "system" ? systemPref() : mode;
}

function applyToDom(resolved: Resolved) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.toggle("light", resolved === "light");
  html.classList.toggle("dark", resolved === "dark");
  html.style.colorScheme = resolved;
}

type Ctx = {
  theme: ThemeMode;
  resolved: Resolved;
  setTheme: (m: ThemeMode) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readLocal());
  const [resolved, setResolved] = useState<Resolved>(() => resolve(readLocal()));

  // Apply on mount and whenever theme changes
  useEffect(() => {
    const r = resolve(theme);
    setResolved(r);
    applyToDom(r);
  }, [theme]);

  // React to system changes if mode = system
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const r = systemPref();
      setResolved(r);
      applyToDom(r);
    };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [theme]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && (e.newValue === "system" || e.newValue === "dark" || e.newValue === "light")) {
        setThemeState(e.newValue as ThemeMode);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Pull preference from Supabase profile after sign-in
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      const { data } = await supabase.from("profiles").select("theme_preference").eq("id", uid).maybeSingle();
      if (cancelled) return;
      const remote = (data as any)?.theme_preference as ThemeMode | undefined;
      if (remote && (remote === "system" || remote === "dark" || remote === "light")) {
        if (remote !== readLocal()) {
          window.localStorage.setItem(LS_KEY, remote);
          setThemeState(remote);
        }
      }
    };
    pull();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") pull();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setTheme = useCallback((m: ThemeMode) => {
    setThemeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, m);
    // Persist to Supabase (best-effort)
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid) return;
      supabase.from("profiles").update({ theme_preference: m } as any).eq("id", uid).then(() => {});
    });
  }, []);

  return <ThemeCtx.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
