import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { Company } from "./mock-data";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "./auth";
import { useWorkspace } from "./workspace";
import { getActivePontoSession, onPontoEvent } from "./ponto";
import { logActivity } from "./activity-log";

export interface UserTask {
  id: string;
  text: string;
  done: boolean;
  doneAt?: string;
  createdAt: number;
  assignee?: string;
  priority?: "low" | "medium" | "high";
  notes?: string;
  position: number;
  parentId?: string | null;
  subtasks: UserTask[];
}

export type ChecklistState = Record<string, UserTask[]>;

interface DbRow {
  id: string;
  user_id: string | null;
  owner_email: string;
  company: string;
  title: string;
  assignee: string | null;
  status: string;
  priority: string;
  notes: string | null;
  done_at: string | null;
  position: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

const emptyState = (): ChecklistState => ({});


function fmtHHMM(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function rowToTask(r: DbRow): UserTask {
  return {
    id: r.id,
    text: r.title,
    done: r.status === "done",
    doneAt: fmtHHMM(r.done_at),
    createdAt: new Date(r.created_at).getTime(),
    assignee: r.assignee ?? undefined,
    priority: (r.priority as UserTask["priority"]) ?? "medium",
    notes: r.notes ?? undefined,
    position: r.position,
    parentId: r.parent_id ?? null,
    subtasks: [],
  };
}

/** Build a tree from a flat row list, grouping by company. */
function groupByCompany(rows: DbRow[]): ChecklistState {
  const base = emptyState();
  const byId = new Map<string, UserTask>();
  const tasks = rows.map((r) => {
    const t = rowToTask(r);
    byId.set(t.id, t);
    return t;
  });
  for (const t of tasks) {
    if (t.parentId && byId.has(t.parentId)) {
      byId.get(t.parentId)!.subtasks.push(t);
    } else {
      const c = (rows.find((r) => r.id === t.id)?.company) as string;
      if (!c) continue;
      if (!base[c]) base[c] = [];
      base[c].push(t);
    }
  }
  const sortRec = (list: UserTask[]) => {
    list.sort((a, b) => a.position - b.position);
    for (const t of list) sortRec(t.subtasks);
  };
  for (const c of Object.keys(base)) sortRec(base[c]);
  return base;
}


interface Ctx {
  state: ChecklistState;
  loading: boolean;
  add: (company: Company, text: string, parentId?: string | null) => Promise<void>;
  edit: (company: Company, id: string, text: string) => Promise<void>;
  remove: (company: Company, id: string) => Promise<void>;
  toggle: (company: Company, id: string) => Promise<void>;
  reorder: (company: Company, fromId: string, toId: string, parentId?: string | null) => Promise<void>;
  clearCompany: (company: Company) => Promise<void>;
  totals: { total: number; done: number; pct: number };
}

const ChecklistCtx = createContext<Ctx | null>(null);

/** Recursively map over a task tree returning a new tree. */
function mapTree(list: UserTask[], fn: (t: UserTask) => UserTask | null): UserTask[] {
  const out: UserTask[] = [];
  for (const t of list) {
    const mapped = fn({ ...t, subtasks: mapTree(t.subtasks, fn) });
    if (mapped) out.push(mapped);
  }
  return out;
}

function findTask(list: UserTask[], id: string): UserTask | null {
  for (const t of list) {
    if (t.id === id) return t;
    const found = findTask(t.subtasks, id);
    if (found) return found;
  }
  return null;
}

function flatten(list: UserTask[]): UserTask[] {
  const out: UserTask[] = [];
  for (const t of list) { out.push(t); out.push(...flatten(t.subtasks)); }
  return out;
}

/** Local YYYY-MM-DD (avoids UTC drift). */
function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ChecklistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const userId = user?.id ?? null;
  const ownerEmail = user?.email ?? "guest@pubcore.local";
  const userName = user?.name ?? null;
  const [state, setState] = useState<ChecklistState>(() => emptyState());
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef(userId);
  const ownerRef = useRef(ownerEmail);
  const nameRef = useRef<string | null>(userName);
  const wsRef = useRef(activeWorkspaceId);
  userIdRef.current = userId;
  ownerRef.current = ownerEmail;
  nameRef.current = userName;
  wsRef.current = activeWorkspaceId;

  // Cache the raw rows so realtime events can rebuild the tree cleanly.
  const rowsRef = useRef<DbRow[]>([]);

  const rebuild = useCallback(() => {
    setState(groupByCompany(rowsRef.current));
  }, []);

  /** Snapshot rows completed on a previous day into the daily-history log,
   *  then reset their status back to "pending" so the checklist restarts today. */
  const snapshotAndResetStale = useCallback(async (rows: DbRow[]): Promise<DbRow[]> => {
    if (!wsRef.current) return rows;
    const today = localDateStr();
    const stale = rows.filter((r) => {
      if (r.status !== "done" || !r.done_at) return false;
      return localDateStr(new Date(r.done_at)) !== today;
    });
    if (stale.length === 0) return rows;

    const entries = stale.map((r) => ({
      workspace_id: wsRef.current!,
      user_id: userIdRef.current,
      owner_email: ownerRef.current,
      user_name: nameRef.current,
      task_id: r.id,
      task_title: r.title,
      company: r.company,
      completed_on: localDateStr(new Date(r.done_at!)),
      completed_at: r.done_at!,
    }));
    const { error: histErr } = await supabase
      .from("checklist_daily_completions")
      .upsert(entries as never, { onConflict: "workspace_id,task_id,completed_on" });
    if (histErr) console.error("[checklist] history snapshot error", histErr);

    const ids = stale.map((r) => r.id);
    const { error: resetErr } = await supabase
      .from("checklist_tasks")
      .update({ status: "pending", done_at: null })
      .in("id", ids);
    if (resetErr) {
      console.error("[checklist] daily reset error", resetErr);
      return rows;
    }
    const idSet = new Set(ids);
    return rows.map((r) => (idSet.has(r.id) ? { ...r, status: "pending", done_at: null } : r));
  }, []);

  useEffect(() => {
    if (!userId || !activeWorkspaceId) { rowsRef.current = []; setState(emptyState()); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("checklist_tasks")
        .select("*")
        .eq("workspace_id", activeWorkspaceId)
        .is("funnel_id", null)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (error) { console.error("[checklist] load error", error); rowsRef.current = []; setState(emptyState()); }
      else {
        const fresh = await snapshotAndResetStale((data ?? []) as DbRow[]);
        if (cancelled) return;
        rowsRef.current = fresh;
        rebuild();
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel(`checklist_tasks:${activeWorkspaceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "checklist_tasks", filter: `workspace_id=eq.${activeWorkspaceId}` },
        (payload) => {
          // Defensive: ignore any row with funnel_id (those belong to Kanban,
          // which now lives in its own kanban_cards table).
          const newRow = payload.new as DbRow | undefined;
          const oldRow = payload.old as DbRow | undefined;
          if (newRow && (newRow as { funnel_id?: string | null }).funnel_id) return;
          if (payload.eventType === "INSERT" && newRow) {
            if (!rowsRef.current.some((r) => r.id === newRow.id)) rowsRef.current = [...rowsRef.current, newRow];
          } else if (payload.eventType === "UPDATE" && newRow) {
            const idx = rowsRef.current.findIndex((r) => r.id === newRow.id);
            if (idx === -1) rowsRef.current = [...rowsRef.current, newRow];
            else { const next = [...rowsRef.current]; next[idx] = newRow; rowsRef.current = next; }
          } else if (payload.eventType === "DELETE" && oldRow) {
            rowsRef.current = rowsRef.current.filter((r) => r.id !== oldRow.id);
          }
          rebuild();
        })
      .subscribe();

    // Periodic check: if the tab is left open past midnight, reset.
    const interval = window.setInterval(async () => {
      const fresh = await snapshotAndResetStale(rowsRef.current);
      if (fresh !== rowsRef.current) { rowsRef.current = fresh; rebuild(); }
    }, 5 * 60 * 1000);

    return () => { cancelled = true; supabase.removeChannel(channel); window.clearInterval(interval); };
  }, [userId, activeWorkspaceId, rebuild, snapshotAndResetStale]);

  const add = useCallback(async (company: Company, text: string, parentId: string | null = null) => {
    const trimmed = text.trim();
    if (!trimmed || !userIdRef.current || !wsRef.current) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Determine sibling position
    const siblings = parentId
      ? (findTask(state[company] ?? [], parentId)?.subtasks ?? [])
      : (state[company] ?? []);
    const position = siblings.length;

    const optimistic: DbRow = {
      id: tempId, user_id: userIdRef.current, owner_email: ownerRef.current,
      company, title: trimmed, assignee: null, status: "pending", priority: "medium",
      notes: null, done_at: null, position, parent_id: parentId,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    rowsRef.current = [...rowsRef.current, optimistic];
    rebuild();

    const { data, error } = await supabase.from("checklist_tasks").insert({
      user_id: userIdRef.current, workspace_id: wsRef.current, owner_email: ownerRef.current,
      company, title: trimmed, position, status: "pending", priority: "medium",
      parent_id: parentId,
    } as never).select().single();
    if (error) {
      console.error("[checklist] add error", error);
      rowsRef.current = rowsRef.current.filter((r) => r.id !== tempId);
      rebuild();
      return;
    }
    const row = data as DbRow;
    rowsRef.current = rowsRef.current.map((r) => (r.id === tempId ? row : r));
    rebuild();
  }, [state, rebuild]);

  const edit = useCallback(async (_company: Company, id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    rowsRef.current = rowsRef.current.map((r) => (r.id === id ? { ...r, title: trimmed } : r));
    rebuild();
    const { error } = await supabase.from("checklist_tasks").update({ title: trimmed }).eq("id", id);
    if (error) console.error("[checklist] edit error", error);
  }, [rebuild]);

  const remove = useCallback(async (company: Company, id: string) => {
    const task = findTask(state[company] ?? [], id);
    const prevRows = rowsRef.current;
    // Remove the task and all its descendants locally
    const removeIds = new Set<string>([id]);
    if (task) for (const t of flatten(task.subtasks)) removeIds.add(t.id);
    rowsRef.current = rowsRef.current.filter((r) => !removeIds.has(r.id));
    rebuild();
    const { error } = await supabase.from("checklist_tasks").delete().eq("id", id);
    if (error) {
      console.error("[checklist] remove error", error);
      rowsRef.current = prevRows; rebuild(); return;
    }
    if (task) await logActivity({
      entity_type: "checklist_task", entity_id: id, action: "deleted",
      title: task.text, company, payload: { was_done: task.done, priority: task.priority },
    });
  }, [state, rebuild]);

  const toggle = useCallback(async (company: Company, id: string) => {
    const task = findTask(state[company] ?? [], id);
    if (!task) return;
    const willDone = !task.done;
    const nowIso = new Date().toISOString();
    rowsRef.current = rowsRef.current.map((r) => r.id === id
      ? { ...r, status: willDone ? "done" : "pending", done_at: willDone ? nowIso : null }
      : r);
    rebuild();
    const { error } = await supabase.from("checklist_tasks").update({
      status: willDone ? "done" : "pending",
      done_at: willDone ? nowIso : null,
    }).eq("id", id);
    if (error) console.error("[checklist] toggle error", error);

    // Persist completion in the daily history log immediately, so we never
    // lose it even if the user unchecks later or the daily reset hasn't run.
    if (willDone && wsRef.current) {
      const { error: histErr } = await supabase
        .from("checklist_daily_completions")
        .upsert({
          workspace_id: wsRef.current,
          user_id: userIdRef.current,
          owner_email: ownerRef.current,
          user_name: nameRef.current,
          task_id: id,
          task_title: task.text,
          company,
          completed_on: localDateStr(new Date(nowIso)),
          completed_at: nowIso,
        } as never, { onConflict: "workspace_id,task_id,completed_on" });
      if (histErr) console.error("[checklist] daily history error", histErr);
    }

    const active = getActivePontoSession();
    if (willDone && active.sessionId && active.ownerEmail) {
      const { error: logErr } = await supabase.from("ponto_session_tasks").insert({
        session_id: active.sessionId,
        task_id: id,
        user_id: userIdRef.current,
        owner_email: active.ownerEmail,
        user_name: active.userName,
        company,
        title: task.text,
        completed_at: nowIso,
      } as never);
      if (logErr) console.error("[checklist] ponto log error", logErr);
    } else if (!willDone && active.sessionId) {
      await supabase.from("ponto_session_tasks").delete()
        .eq("session_id", active.sessionId).eq("task_id", id);
    }
  }, [state, rebuild]);

  const resetCompanyDone = useCallback(async (company: Company) => {
    if (!userIdRef.current || !wsRef.current) return;
    const { error } = await supabase.from("checklist_tasks")
      .update({ status: "pending", done_at: null })
      .eq("workspace_id", wsRef.current)
      .eq("company", company)
      .eq("status", "done");
    if (error) console.error("[checklist] reset error", error);
  }, []);

  useEffect(() => {
    const off = onPontoEvent((e) => { if (e.type === "ended" && e.company) resetCompanyDone(e.company as Company); });
    return () => { off(); };
  }, [resetCompanyDone]);

  const reorder = useCallback(async (company: Company, fromId: string, toId: string, parentId: string | null = null) => {
    if (fromId === toId) return;
    const siblings = parentId
      ? (findTask(state[company] ?? [], parentId)?.subtasks ?? [])
      : (state[company] ?? []);
    const list = [...siblings];
    const fromIdx = list.findIndex((t) => t.id === fromId);
    const toIdx = list.findIndex((t) => t.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    const updates = list.map((t, i) => ({ id: t.id, position: i }));
    rowsRef.current = rowsRef.current.map((r) => {
      const u = updates.find((x) => x.id === r.id);
      return u ? { ...r, position: u.position } : r;
    });
    rebuild();
    await Promise.all(updates.map((u) =>
      supabase.from("checklist_tasks").update({ position: u.position }).eq("id", u.id)
    ));
  }, [state, rebuild]);

  const clearCompany = useCallback(async (company: Company) => {
    if (!userIdRef.current || !wsRef.current) return;
    const prevTasks = flatten(state[company] ?? []);
    const prevRows = rowsRef.current;
    rowsRef.current = rowsRef.current.filter((r) => r.company !== company);
    rebuild();
    const { error } = await supabase.from("checklist_tasks").delete()
      .eq("workspace_id", wsRef.current).eq("company", company);
    if (error) {
      console.error("[checklist] clear error", error);
      rowsRef.current = prevRows; rebuild(); return;
    }
    for (const task of prevTasks) {
      logActivity({
        entity_type: "checklist_task", entity_id: task.id, action: "deleted",
        title: task.text, company, payload: { was_done: task.done, bulk: true },
      });
    }
  }, [state, rebuild]);

  const totals = useMemo(() => {
    let total = 0, done = 0;
    for (const list of Object.values(state)) {
      const all = flatten(list);
      total += all.length;
      done += all.filter((t) => t.done).length;
    }

    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [state]);

  const value: Ctx = { state, loading, add, edit, remove, toggle, reorder, clearCompany, totals };
  return <ChecklistCtx.Provider value={value}>{children}</ChecklistCtx.Provider>;
}

export function useChecklist() {
  const ctx = useContext(ChecklistCtx);
  if (!ctx) throw new Error("useChecklist must be used within ChecklistProvider");
  return ctx;
}
