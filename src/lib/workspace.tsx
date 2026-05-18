import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type WorkspaceMemberRole = "admin" | "member";
export type AppRole = "master" | "user";

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMembership extends Workspace {
  member_role: WorkspaceMemberRole;
}

interface Ctx {
  loading: boolean;
  workspaces: WorkspaceMembership[];
  activeWorkspace: WorkspaceMembership | Workspace | null;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  refresh: () => Promise<void>;
  isMaster: boolean;
  isWorkspaceAdmin: boolean;
}

const WorkspaceCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "pubcore_active_workspace";

let _activeWorkspaceId: string | null = null;
export function getActiveWorkspaceId(): string | null {
  if (_activeWorkspaceId) return _activeWorkspaceId;
  if (typeof window !== "undefined") {
    return localStorage.getItem(STORAGE_KEY);
  }
  return null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [externalWorkspace, setExternalWorkspace] = useState<Workspace | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const initRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setWorkspaces([]); setIsMaster(false); setLoading(false); return;
    }
    setLoading(true);
    const [{ data: members }, { data: roles }] = await Promise.all([
      supabase.from("workspace_members")
        .select("role, workspace:workspaces(id,name,slug,owner_id,created_at)")
        .eq("user_id", userId),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const master = ((roles ?? []) as Array<{ role: AppRole }>).some((r) => r.role === "master");
    let list: WorkspaceMembership[] = ((members ?? []) as unknown as Array<{ role: WorkspaceMemberRole; workspace: Workspace }>)
      .filter((m) => m.workspace)
      .map((m) => ({ ...m.workspace, member_role: m.role }));

    // MASTER: pode ver e trocar entre TODOS os workspaces da plataforma
    if (master) {
      const { data: allWs } = await supabase.from("workspaces").select("id,name,slug,owner_id,created_at");
      const ownIds = new Set(list.map((w) => w.id));
      const extras: WorkspaceMembership[] = ((allWs ?? []) as Workspace[])
        .filter((w) => !ownIds.has(w.id))
        .map((w) => ({ ...w, member_role: "admin" as WorkspaceMemberRole }));
      list = [...list, ...extras];
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    setWorkspaces(list);
    setIsMaster(master);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Pick a default workspace once loaded
  useEffect(() => {
    if (loading || !userId) return;
    if (initRef.current && activeWorkspaceId && workspaces.some((w) => w.id === activeWorkspaceId)) return;
    if (workspaces.length === 0) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const pick = (stored && workspaces.find((w) => w.id === stored)) ? stored : workspaces[0].id;
    setActiveWorkspaceIdState(pick);
    initRef.current = true;
  }, [loading, workspaces, userId, activeWorkspaceId]);

  // Persist + sync globally
  useEffect(() => {
    _activeWorkspaceId = activeWorkspaceId;
    if (typeof window !== "undefined" && activeWorkspaceId) {
      localStorage.setItem(STORAGE_KEY, activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  // Realtime: refresh when memberships change
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`ws-mem:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter: `user_id=eq.${userId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refresh]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    setExternalWorkspace(null);
  }, []);

  // If MASTER selected a workspace they're not a member of, fetch its info
  useEffect(() => {
    if (!activeWorkspaceId || !isMaster) return;
    if (workspaces.some((w) => w.id === activeWorkspaceId)) { setExternalWorkspace(null); return; }
    supabase.from("workspaces").select("*").eq("id", activeWorkspaceId).maybeSingle()
      .then(({ data }) => { if (data) setExternalWorkspace(data as Workspace); });
  }, [activeWorkspaceId, isMaster, workspaces]);

  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    if (!userId || !name.trim()) return null;
    const { data, error } = await supabase.from("workspaces")
      .insert({ name: name.trim(), owner_id: userId } as never)
      .select().single();
    if (error || !data) { console.error("[workspace] create error", error); return null; }
    const ws = data as Workspace;
    await supabase.from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: userId, role: "admin" } as never);
    await refresh();
    setActiveWorkspaceIdState(ws.id);
    return ws;
  }, [userId, refresh]);

  const activeWorkspace: WorkspaceMembership | Workspace | null = useMemo(() => {
    if (!activeWorkspaceId) return null;
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? externalWorkspace;
  }, [activeWorkspaceId, workspaces, externalWorkspace]);

  const isWorkspaceAdmin = useMemo(() => {
    if (isMaster) return true;
    const m = workspaces.find((w) => w.id === activeWorkspaceId);
    return m?.member_role === "admin";
  }, [isMaster, workspaces, activeWorkspaceId]);

  const value: Ctx = {
    loading, workspaces, activeWorkspace, activeWorkspaceId,
    setActiveWorkspaceId, createWorkspace, refresh, isMaster, isWorkspaceAdmin,
  };

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace() {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("useWorkspace must be inside WorkspaceProvider");
  return c;
}
