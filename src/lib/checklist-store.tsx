import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { COMPANIES, type Company } from "./mock-data";

export interface UserTask {
  id: string;
  text: string;
  done: boolean;
  doneAt?: string; // HH:MM
  createdAt: number;
}

export type ChecklistState = Record<Company, UserTask[]>;

const STORAGE_KEY = "pubcore_checklist_v1";
const CHANNEL = "pubcore_checklist_sync";

const emptyState = (): ChecklistState =>
  COMPANIES.reduce((acc, c) => {
    acc[c] = [];
    return acc;
  }, {} as ChecklistState);

function load(): ChecklistState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ChecklistState>;
    const base = emptyState();
    for (const c of COMPANIES) {
      if (Array.isArray(parsed[c])) base[c] = parsed[c] as UserTask[];
    }
    return base;
  } catch {
    return emptyState();
  }
}

interface Ctx {
  state: ChecklistState;
  add: (company: Company, text: string) => void;
  edit: (company: Company, id: string, text: string) => void;
  remove: (company: Company, id: string) => void;
  toggle: (company: Company, id: string) => void;
  reorder: (company: Company, fromId: string, toId: string) => void;
  clearCompany: (company: Company) => void;
  totals: { total: number; done: number; pct: number };
}

const ChecklistCtx = createContext<Ctx | null>(null);

export function ChecklistProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ChecklistState>(() => load());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const skipBroadcast = useRef(false);

  // persist + broadcast
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
    if (!skipBroadcast.current && channelRef.current) {
      channelRef.current.postMessage({ type: "sync", state });
    }
    skipBroadcast.current = false;
  }, [state]);

  // cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (e) => {
      if (e.data?.type === "sync" && e.data.state) {
        skipBroadcast.current = true;
        setState(e.data.state as ChecklistState);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          skipBroadcast.current = true;
          setState(JSON.parse(e.newValue));
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      ch.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const add = useCallback((company: Company, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState((s) => ({
      ...s,
      [company]: [
        ...s[company],
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: trimmed, done: false, createdAt: Date.now() },
      ],
    }));
  }, []);

  const edit = useCallback((company: Company, id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState((s) => ({
      ...s,
      [company]: s[company].map((t) => (t.id === id ? { ...t, text: trimmed } : t)),
    }));
  }, []);

  const remove = useCallback((company: Company, id: string) => {
    setState((s) => ({ ...s, [company]: s[company].filter((t) => t.id !== id) }));
  }, []);

  const toggle = useCallback((company: Company, id: string) => {
    setState((s) => ({
      ...s,
      [company]: s[company].map((t) => {
        if (t.id !== id) return t;
        if (t.done) return { ...t, done: false, doneAt: undefined };
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        return { ...t, done: true, doneAt: `${hh}:${mm}` };
      }),
    }));
  }, []);

  const reorder = useCallback((company: Company, fromId: string, toId: string) => {
    if (fromId === toId) return;
    setState((s) => {
      const list = [...s[company]];
      const fromIdx = list.findIndex((t) => t.id === fromId);
      const toIdx = list.findIndex((t) => t.id === toId);
      if (fromIdx === -1 || toIdx === -1) return s;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return { ...s, [company]: list };
    });
  }, []);

  const clearCompany = useCallback((company: Company) => {
    setState((s) => ({ ...s, [company]: [] }));
  }, []);

  const totals = useMemo(() => {
    let total = 0, done = 0;
    for (const c of COMPANIES) {
      total += state[c].length;
      done += state[c].filter((t) => t.done).length;
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [state]);

  const value: Ctx = { state, add, edit, remove, toggle, reorder, clearCompany, totals };
  return <ChecklistCtx.Provider value={value}>{children}</ChecklistCtx.Provider>;
}

export function useChecklist() {
  const ctx = useContext(ChecklistCtx);
  if (!ctx) throw new Error("useChecklist must be used within ChecklistProvider");
  return ctx;
}
