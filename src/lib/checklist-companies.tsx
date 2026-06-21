import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./workspace";
import { COMPANY_COLORS, DEFAULT_COMPANY_COLOR } from "./mock-data";

export interface ChecklistCompany {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  position: number;
  parent_company_id?: string | null;
  ponto_daily_limit_minutes?: number | null;
  ponto_limit_enabled?: boolean | null;
}

interface Ctx {
  companies: ChecklistCompany[];
  mainCompanies: ChecklistCompany[];
  loading: boolean;
  canManage: boolean;
  create: (name: string, color?: string) => Promise<ChecklistCompany | null>;
  rename: (id: string, newName: string) => Promise<boolean>;
  recolor: (id: string, color: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  reorder: (fromId: string, toId: string) => Promise<void>;
  setPontoLimit: (id: string, minutes: number, enabled: boolean) => Promise<boolean>;
  colorOf: (name: string) => string;
}


const CompaniesCtx = createContext<Ctx | null>(null);

export function ChecklistCompaniesProvider({ children }: { children: ReactNode }) {
  const { activeWorkspaceId, isWorkspaceAdmin } = useWorkspace();
  const [companies, setCompanies] = useState<ChecklistCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef<string | null>(null);

  const load = useCallback(async (wsId: string) => {
    const { data, error } = await supabase
      .from("checklist_companies")
      .select("*")
      .eq("workspace_id", wsId)
      .order("position", { ascending: true });
    if (error) { console.error("[companies] load", error); return [] as ChecklistCompany[]; }
    return (data ?? []) as ChecklistCompany[];
  }, []);

  // Novos workspaces começam SEM empresas pré-cadastradas — o usuário
  // adiciona suas próprias empresas pela tela de Checklists ou pelo
  // onboarding. Função mantida como no-op para compatibilidade.
  const seedDefaults = useCallback(async (_wsId: string) => {
    void _wsId;
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) { setCompanies([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const list = await load(activeWorkspaceId);
      if (!cancelled) { setCompanies(list); setLoading(false); }
    })();

    const ch = supabase
      .channel(`checklist_companies:${activeWorkspaceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "checklist_companies", filter: `workspace_id=eq.${activeWorkspaceId}` },
        async () => { const list = await load(activeWorkspaceId); if (!cancelled) setCompanies(list); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeWorkspaceId, load]);
  void seedDefaults; void isWorkspaceAdmin; void seededRef;

  const create = useCallback(async (name: string, color?: string) => {
    const trimmed = name.trim();
    if (!trimmed || !activeWorkspaceId) return null;
    const position = companies.length;
    const { data, error } = await supabase.from("checklist_companies")
      .insert({
        workspace_id: activeWorkspaceId, name: trimmed,
        color: color ?? DEFAULT_COMPANY_COLOR, position,
      } as never)
      .select().single();
    if (error) { console.error("[companies] create", error); return null; }
    const row = data as ChecklistCompany;
    setCompanies((prev) => [...prev, row]);
    return row;
  }, [activeWorkspaceId, companies.length]);

  const rename = useCallback(async (id: string, newName: string) => {
    const c = companies.find((x) => x.id === id);
    const trimmed = newName.trim();
    if (!c || !trimmed || !activeWorkspaceId || trimmed === c.name) return false;
    const { error } = await supabase.from("checklist_companies")
      .update({ name: trimmed }).eq("id", id);
    if (error) { console.error("[companies] rename", error); return false; }
    // Cascade rename on tasks + history
    const { error: rpcErr } = await supabase.rpc("rename_checklist_company", {
      _workspace_id: activeWorkspaceId, _old_name: c.name, _new_name: trimmed,
    });
    if (rpcErr) console.error("[companies] rename cascade", rpcErr);
    setCompanies((prev) => prev.map((x) => x.id === id ? { ...x, name: trimmed } : x));
    return true;
  }, [companies, activeWorkspaceId]);

  const recolor = useCallback(async (id: string, color: string) => {
    const { error } = await supabase.from("checklist_companies").update({ color }).eq("id", id);
    if (error) { console.error("[companies] recolor", error); return false; }
    setCompanies((prev) => prev.map((x) => x.id === id ? { ...x, color } : x));
    return true;
  }, []);

  const remove = useCallback(async (id: string) => {
    const c = companies.find((x) => x.id === id);
    if (!c || !activeWorkspaceId) return false;
    const { error } = await supabase.rpc("delete_checklist_company_cascade", {
      _workspace_id: activeWorkspaceId, _name: c.name,
    });
    if (error) { console.error("[companies] delete", error); return false; }
    setCompanies((prev) => prev.filter((x) => x.id !== id));
    return true;
  }, [companies, activeWorkspaceId]);

  const reorder = useCallback(async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const list = [...companies];
    const from = list.findIndex((x) => x.id === fromId);
    const to = list.findIndex((x) => x.id === toId);
    if (from === -1 || to === -1) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const next = list.map((c, i) => ({ ...c, position: i }));
    setCompanies(next);
    await Promise.all(next.map((c) =>
      supabase.from("checklist_companies").update({ position: c.position }).eq("id", c.id)
    ));
  }, [companies]);

  const colorOf = useCallback((name: string) => {
    const c = companies.find((x) => x.name === name);
    return c?.color ?? COMPANY_COLORS[name] ?? DEFAULT_COMPANY_COLOR;
  }, [companies]);

  const setPontoLimit = useCallback(async (id: string, minutes: number, enabled: boolean) => {
    const safe = Math.max(1, Math.min(24 * 60, Math.round(minutes)));
    const { error } = await supabase.rpc("set_company_ponto_limit" as never, {
      _company_id: id, _minutes: safe, _enabled: enabled,
    } as never);
    if (error) { console.error("[companies] setPontoLimit", error); return false; }
    setCompanies((prev) => prev.map((x) => x.id === id
      ? { ...x, ponto_daily_limit_minutes: safe, ponto_limit_enabled: enabled }
      : x));
    return true;
  }, []);


  const mainCompanies = useMemo(
    () => companies.filter((c) => !c.parent_company_id),
    [companies]
  );

  const value: Ctx = useMemo(() => ({
    companies, mainCompanies, loading, canManage: isWorkspaceAdmin,
    create, rename, recolor, remove, reorder, setPontoLimit, colorOf,
  }), [companies, mainCompanies, loading, isWorkspaceAdmin, create, rename, recolor, remove, reorder, setPontoLimit, colorOf]);


  return <CompaniesCtx.Provider value={value}>{children}</CompaniesCtx.Provider>;
}

export function useChecklistCompanies() {
  const ctx = useContext(CompaniesCtx);
  if (!ctx) throw new Error("useChecklistCompanies must be inside ChecklistCompaniesProvider");
  return ctx;
}
