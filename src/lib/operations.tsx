import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { COMPANIES, type Company } from "./mock-data";

export interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  total_ms: number | null;
  productive_ms: number | null;
  pause_ms: number | null;
  user_name: string | null;
  owner_email: string;
}

export interface SessionTaskRow {
  id: string;
  session_id: string;
  company: string;
  title: string;
  completed_at: string;
  user_name: string | null;
}

export interface ChecklistRow {
  id: string;
  company: string;
  title: string;
  status: string;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Loads all operational data for the current user with realtime sync.
 * Single source of truth for Dashboard, Histórico and Métricas.
 */
export function useOperationalData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionTasks, setSessionTasks] = useState<SessionTaskRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSessions([]); setSessionTasks([]); setChecklist([]); setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const [s, st, ch] = await Promise.all([
        supabase.from("ponto_sessions")
          .select("id, started_at, ended_at, status, total_ms, productive_ms, pause_ms, user_name, owner_email")
          .eq("user_id", userId)
          .order("started_at", { ascending: false })
          .limit(500),
        supabase.from("ponto_session_tasks")
          .select("id, session_id, company, title, completed_at, user_name")
          .eq("user_id", userId)
          .order("completed_at", { ascending: false })
          .limit(1000),
        supabase.from("checklist_tasks")
          .select("id, company, title, status, done_at, created_at, updated_at")
          .eq("user_id", userId)
          .limit(1000),
      ]);
      if (cancelled) return;
      setSessions((s.data ?? []) as SessionRow[]);
      setSessionTasks((st.data ?? []) as SessionTaskRow[]);
      setChecklist((ch.data ?? []) as ChecklistRow[]);
      setLoading(false);
    };
    load();

    const channelName = `operations:${userId}:${Math.random().toString(36).slice(2, 10)}`;
    const ch = supabase.channel(channelName);
    ch.on("postgres_changes", { event: "*", schema: "public", table: "ponto_sessions", filter: `user_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ponto_session_tasks", filter: `user_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_tasks", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [userId]);

  return { sessions, sessionTasks, checklist, loading };
}

export function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
export function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export function buildDailySeries(sessions: SessionRow[], tasks: SessionTaskRow[], days: number) {
  const wd = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const today = startOfDay(new Date());
  const out: { date: string; label: string; completed: number; productiveMs: number; totalMs: number; productivity: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 86400000;
    const daySessions = sessions.filter((s) => {
      const t = new Date(s.started_at).getTime();
      return t >= dayStart && t < dayEnd;
    });
    const dayTasks = tasks.filter((t) => {
      const ts = new Date(t.completed_at).getTime();
      return ts >= dayStart && ts < dayEnd;
    });
    const totalMs = daySessions.reduce((a, s) => a + (s.total_ms ?? 0), 0);
    const productiveMs = daySessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0);
    const productivity = totalMs > 0 ? Math.round((productiveMs / totalMs) * 100) : 0;
    out.push({
      date: d.toISOString().slice(0,10),
      label: `${wd[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}`,
      completed: dayTasks.length,
      totalMs,
      productiveMs,
      productivity,
    });
  }
  return out;
}

export function tasksByCompany(tasks: SessionTaskRow[]) {
  const map = new Map<Company, number>();
  for (const c of COMPANIES) map.set(c, 0);
  for (const t of tasks) {
    const c = t.company as Company;
    if (map.has(c)) map.set(c, (map.get(c) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([company, completed]) => ({ company, completed }));
}

export function tasksByUser(tasks: SessionTaskRow[]) {
  const map = new Map<string, number>();
  for (const t of tasks) {
    const u = t.user_name?.trim() || "Sem nome";
    map.set(u, (map.get(u) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count);
}

export function useTodaySummary() {
  const { sessions, sessionTasks, checklist, loading } = useOperationalData();
  return useMemo(() => {
    const ts0 = startOfDay(new Date()).getTime();
    const ts1 = ts0 + 86400000;

    const todayTasks = sessionTasks.filter((t) => {
      const ts = new Date(t.completed_at).getTime();
      return ts >= ts0 && ts < ts1;
    });
    const todaySessions = sessions.filter((s) => {
      const ts = new Date(s.started_at).getTime();
      return ts >= ts0 && ts < ts1;
    });
    const totalMs = todaySessions.reduce((a, s) => a + (s.total_ms ?? 0), 0);
    const productiveMs = todaySessions.reduce((a, s) => a + (s.productive_ms ?? 0), 0);
    const completedToday = checklist.filter((t) => t.status === "done").length;
    const pending = checklist.filter((t) => t.status !== "done").length;
    const companies = new Set(todayTasks.map((t) => t.company));

    return {
      loading,
      completedToday,
      pending,
      totalChecklist: checklist.length,
      sessionTasksToday: todayTasks.length,
      totalMs,
      productiveMs,
      sessionsToday: todaySessions.length,
      companiesOperated: companies.size,
      checklist,
      sessions,
      sessionTasks,
    };
  }, [sessions, sessionTasks, checklist, loading]);
}
