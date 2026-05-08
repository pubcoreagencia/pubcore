import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { COMPANIES, type Company } from "./mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { getActivePontoSession, onPontoEvent } from "./ponto";

export interface UserTask {
  id: string;
  text: string;
  done: boolean;
  doneAt?: string; // HH:MM (derived from done_at timestamp)
  createdAt: number;
  assignee?: string;
  priority?: "low" | "medium" | "high";
  notes?: string;
  position: number;
}

export type ChecklistState = Record<Company, UserTask[]>;

interface DbRow {
  id: string;
  owner_email: string;
  company: string;
  title: string;
  assignee: string | null;
  status: string;
  priority: string;
  notes: string | null;
  done_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

const emptyState = (): ChecklistState =>
  COMPANIES.reduce((acc, c) => {
    acc[c] = [];
    return acc;
  }, {} as ChecklistState);

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
  };
}

function groupByCompany(rows: DbRow[]): ChecklistState {
  const base = emptyState();
  for (const r of rows) {
    const c = r.company as Company;
    if (!base[c]) continue;
    base[c].push(rowToTask(r));
  }
  for (const c of COMPANIES) base[c].sort((a, b) => a.position - b.position);
  return base;
}

interface Ctx {
  state: ChecklistState;
  loading: boolean;
  add: (company: Company, text: string) => Promise<void>;
  edit: (company: Company, id: string, text: string) => Promise<void>;
  remove: (company: Company, id: string) => Promise<void>;
  toggle: (company: Company, id: string) => Promise<void>;
  reorder: (company: Company, fromId: string, toId: string) => Promise<void>;
  clearCompany: (company: Company) => Promise<void>;
  totals: { total: number; done: number; pct: number };
}

const ChecklistCtx = createContext<Ctx | null>(null);

export function ChecklistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const ownerEmail = user?.email ?? "guest@pubcore.local";
  const [state, setState] = useState<ChecklistState>(() => emptyState());
  const [loading, setLoading] = useState(true);
  const ownerRef = useRef(ownerEmail);
  ownerRef.current = ownerEmail;

  // Initial load + realtime subscription scoped per ownerEmail
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("checklist_tasks")
        .select("*")
        .eq("owner_email", ownerEmail)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[checklist] load error", error);
        setState(emptyState());
      } else {
        setState(groupByCompany((data ?? []) as DbRow[]));
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel(`checklist_tasks:${ownerEmail}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checklist_tasks",
          filter: `owner_email=eq.${ownerEmail}`,
        },
        (payload) => {
          setState((prev) => {
            const next: ChecklistState = { ...prev };
            for (const c of COMPANIES) next[c] = [...prev[c]];

            if (payload.eventType === "INSERT") {
              const row = payload.new as DbRow;
              const c = row.company as Company;
              if (!next[c]) return prev;
              if (next[c].some((t) => t.id === row.id)) return prev;
              next[c] = [...next[c], rowToTask(row)].sort((a, b) => a.position - b.position);
            } else if (payload.eventType === "UPDATE") {
              const row = payload.new as DbRow;
              const c = row.company as Company;
              const oldC = (payload.old as DbRow).company as Company;
              if (oldC && oldC !== c && next[oldC]) {
                next[oldC] = next[oldC].filter((t) => t.id !== row.id);
              }
              if (!next[c]) return next;
              const idx = next[c].findIndex((t) => t.id === row.id);
              if (idx === -1) next[c] = [...next[c], rowToTask(row)];
              else next[c][idx] = rowToTask(row);
              next[c] = [...next[c]].sort((a, b) => a.position - b.position);
            } else if (payload.eventType === "DELETE") {
              const row = payload.old as DbRow;
              const c = row.company as Company;
              if (!next[c]) return next;
              next[c] = next[c].filter((t) => t.id !== row.id);
            }
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [ownerEmail]);

  const applyLocal = useCallback((updater: (s: ChecklistState) => ChecklistState) => {
    setState((s) => updater(s));
  }, []);

  const add = useCallback(async (company: Company, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const position = (state[company]?.length ?? 0);
    // optimistic
    applyLocal((s) => ({
      ...s,
      [company]: [
        ...s[company],
        {
          id: tempId, text: trimmed, done: false, createdAt: Date.now(),
          position, priority: "medium",
        },
      ],
    }));
    const { data, error } = await supabase
      .from("checklist_tasks")
      .insert({
        owner_email: ownerRef.current,
        company,
        title: trimmed,
        position,
        status: "pending",
        priority: "medium",
      })
      .select()
      .single();
    if (error) {
      console.error("[checklist] add error", error);
      // rollback
      applyLocal((s) => ({ ...s, [company]: s[company].filter((t) => t.id !== tempId) }));
      return;
    }
    const row = data as DbRow;
    applyLocal((s) => ({
      ...s,
      [company]: s[company].map((t) => (t.id === tempId ? rowToTask(row) : t)),
    }));
  }, [state, applyLocal]);

  const edit = useCallback(async (company: Company, id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    applyLocal((s) => ({
      ...s,
      [company]: s[company].map((t) => (t.id === id ? { ...t, text: trimmed } : t)),
    }));
    const { error } = await supabase
      .from("checklist_tasks")
      .update({ title: trimmed })
      .eq("id", id);
    if (error) console.error("[checklist] edit error", error);
  }, [applyLocal]);

  const remove = useCallback(async (company: Company, id: string) => {
    const prev = state[company];
    applyLocal((s) => ({ ...s, [company]: s[company].filter((t) => t.id !== id) }));
    const { error } = await supabase.from("checklist_tasks").delete().eq("id", id);
    if (error) {
      console.error("[checklist] remove error", error);
      applyLocal((s) => ({ ...s, [company]: prev }));
    }
  }, [state, applyLocal]);

  const toggle = useCallback(async (company: Company, id: string) => {
    const task = state[company]?.find((t) => t.id === id);
    if (!task) return;
    const willDone = !task.done;
    const nowIso = new Date().toISOString();
    applyLocal((s) => ({
      ...s,
      [company]: s[company].map((t) => {
        if (t.id !== id) return t;
        if (!willDone) return { ...t, done: false, doneAt: undefined };
        return { ...t, done: true, doneAt: fmtHHMM(nowIso) };
      }),
    }));
    const { error } = await supabase
      .from("checklist_tasks")
      .update({
        status: willDone ? "done" : "pending",
        done_at: willDone ? nowIso : null,
      })
      .eq("id", id);
    if (error) console.error("[checklist] toggle error", error);

    // Vincular conclusão à sessão de ponto ativa (histórico permanente)
    const active = getActivePontoSession();
    if (willDone && active.sessionId && active.ownerEmail) {
      const { error: logErr } = await supabase.from("ponto_session_tasks").insert({
        session_id: active.sessionId,
        task_id: id,
        owner_email: active.ownerEmail,
        user_name: active.userName,
        company,
        title: task.text,
        completed_at: nowIso,
      });
      if (logErr) console.error("[checklist] ponto log error", logErr);
    } else if (!willDone && active.sessionId) {
      // Desmarcou manualmente durante o expediente -> remove do log da sessão
      await supabase
        .from("ponto_session_tasks")
        .delete()
        .eq("session_id", active.sessionId)
        .eq("task_id", id);
    }
  }, [state, applyLocal]);

  // Resetar checklist (done -> pending) ao encerrar o expediente.
  // O histórico permanece em ponto_session_tasks.
  const resetAllDone = useCallback(async (owner: string) => {
    const { error } = await supabase
      .from("checklist_tasks")
      .update({ status: "pending", done_at: null })
      .eq("owner_email", owner)
      .eq("status", "done");
    if (error) console.error("[checklist] reset error", error);
  }, []);

  useEffect(() => {
    const off = onPontoEvent((e) => {
      if (e.type === "ended" && e.ownerEmail === ownerRef.current) {
        resetAllDone(e.ownerEmail);
      }
    });
    return () => { off; };
  }, [resetAllDone]);

  const reorder = useCallback(async (company: Company, fromId: string, toId: string) => {
    if (fromId === toId) return;
    const list = [...state[company]];
    const fromIdx = list.findIndex((t) => t.id === fromId);
    const toIdx = list.findIndex((t) => t.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    const reindexed = list.map((t, i) => ({ ...t, position: i }));
    applyLocal((s) => ({ ...s, [company]: reindexed }));
    // persist new positions
    await Promise.all(
      reindexed.map((t) =>
        supabase.from("checklist_tasks").update({ position: t.position }).eq("id", t.id)
      )
    );
  }, [state, applyLocal]);

  const clearCompany = useCallback(async (company: Company) => {
    const prev = state[company];
    applyLocal((s) => ({ ...s, [company]: [] }));
    const { error } = await supabase
      .from("checklist_tasks")
      .delete()
      .eq("owner_email", ownerRef.current)
      .eq("company", company);
    if (error) {
      console.error("[checklist] clear error", error);
      applyLocal((s) => ({ ...s, [company]: prev }));
    }
  }, [state, applyLocal]);

  const totals = useMemo(() => {
    let total = 0, done = 0;
    for (const c of COMPANIES) {
      total += state[c].length;
      done += state[c].filter((t) => t.done).length;
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
