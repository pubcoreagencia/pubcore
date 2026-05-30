import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePonto, type PontoRemoteRow } from "@/lib/ponto";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { COMPANIES, type Company } from "@/lib/mock-data";

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = "pubcore_ponto_last_activity";
const CHECK_INTERVAL_MS = 30_000;

async function closeStaleSessionRemote(sessionId: string, endAtMs: number, pauses: unknown) {
  // Encerra retroativamente uma sessão diretamente no banco quando o usuário
  // fechou o navegador e ficou inativo por mais de 30 min.
  try {
    const { data: existing } = await supabase
      .from("ponto_sessions")
      .select("started_at, pauses, status")
      .eq("id", sessionId)
      .maybeSingle();
    if (!existing || existing.status === "ended") return;
    const startedAt = new Date(existing.started_at).getTime();
    const endAt = Math.max(startedAt, endAtMs);
    const list: { start: number; end?: number }[] = Array.isArray(existing.pauses)
      ? (existing.pauses as { start: number; end?: number }[])
      : Array.isArray(pauses) ? (pauses as { start: number; end?: number }[]) : [];
    const fixed = list.map((p, i) => (i === list.length - 1 && !p.end ? { ...p, end: endAt } : p));
    const liveWorkMs = Math.max(0, endAt - startedAt);
    const livePauseMs = fixed.reduce((acc, p) => acc + Math.max(0, (p.end ?? endAt) - p.start), 0);
    const productiveMs = Math.max(0, liveWorkMs - livePauseMs);
    await supabase.from("ponto_sessions").update({
      status: "ended",
      ended_at: new Date(endAt).toISOString(),
      pauses: fixed as unknown as never,
      total_ms: liveWorkMs,
      productive_ms: productiveMs,
      pause_ms: livePauseMs,
      updated_at: new Date().toISOString(),
    }).eq("id", sessionId);
  } catch (e) {
    console.error("[ponto-auto] close stale error", e);
  }
}

function startOfTodayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
function readLastActivity(): number {
  if (typeof window === "undefined") return Date.now();
  const raw = localStorage.getItem(ACTIVITY_KEY);
  const v = raw ? Number(raw) : NaN;
  return Number.isFinite(v) ? v : Date.now();
}
function writeLastActivity(ts: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITY_KEY, String(ts));
}

/**
 * Auto-tracker dos expedientes por empresa.
 * - NÃO auto-inicia mais sessões. O usuário escolhe a empresa.
 * - Ao logar, adota sessões em andamento (working/paused) do dia.
 * - Se a empresa ativa ficar inativa por mais de 30min, encerra automaticamente.
 * - Mantém heartbeat de updated_at para detecção cross-device.
 */
export function PontoAutoTracker() {
  const { user } = useAuth();
  const { sessions, activeCompany, endCompany, adoptSession } = usePonto();
  const bootstrappedForUser = useRef<string | null>(null);
  const endingRef = useRef(false);

  // Atividade do usuário (throttled)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastWrite = 0;
    const THROTTLE_MS = 15_000;
    const mark = () => {
      const now = Date.now();
      if (now - lastWrite < THROTTLE_MS) return;
      lastWrite = now;
      writeLastActivity(now);
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    writeLastActivity(Date.now());
    lastWrite = Date.now();
    return () => events.forEach((e) => window.removeEventListener(e, mark));
  }, []);

  // Bootstrap: adopt in-progress sessions of the day
  useEffect(() => {
    if (!user) { bootstrappedForUser.current = null; return; }
    if (bootstrappedForUser.current === user.id) return;
    let cancelled = false;
    (async () => {
      let tries = 0;
      while (!getActiveWorkspaceId() && tries < 20) {
        await new Promise((r) => setTimeout(r, 150));
        tries++;
      }
      if (cancelled) return;
      try {
        const { data, error } = await supabase
          .from("ponto_sessions")
          .select("id, started_at, ended_at, status, pauses, user_name, owner_email, company, updated_at, productive_ms, total_ms")
          .eq("user_id", user.id)
          .gte("started_at", startOfTodayISO())
          .in("status", ["working", "paused"])
          .order("started_at", { ascending: false });
        if (cancelled || error || !data) return;
        const seen = new Set<Company>();
        const localLast = readLastActivity();
        for (const row of data) {
          const company = (row.company as Company | null);
          if (!company || !COMPANIES.includes(company) || seen.has(company)) continue;
          seen.add(company);
          const remoteTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
          const lastActivity = Math.max(localLast, remoteTs);
          const idle = Date.now() - lastActivity;
          if (idle > IDLE_LIMIT_MS) {
            // Site ficou fechado por >30min: encerra retroativamente no banco
            // usando o último heartbeat conhecido, sem adotar localmente.
            await closeStaleSessionRemote(row.id as string, lastActivity, row.pauses);
            toast(`Expediente de ${company} encerrado por inatividade`, { duration: 5000 });
            continue;
          }
          adoptSession(row as PontoRemoteRow);
        }
      } catch (e) {
        console.error("[ponto-auto] bootstrap error", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user, adoptSession]);

  // Idle check apenas para a empresa ativa
  useEffect(() => {
    if (!user || !activeCompany) return;
    const activeSession = sessions[activeCompany];
    if (!activeSession || activeSession.status !== "working") return;

    const checkIdle = async () => {
      if (endingRef.current) return;
      const localLast = readLastActivity();
      let remoteTs = 0;
      let remoteStatus: string | null = null;
      if (activeSession.sessionId) {
        try {
          const { data } = await supabase
            .from("ponto_sessions")
            .select("updated_at, status")
            .eq("id", activeSession.sessionId)
            .maybeSingle();
          if (data) {
            remoteStatus = data.status as string;
            remoteTs = data.updated_at ? new Date(data.updated_at).getTime() : 0;
          }
        } catch { /* noop */ }
      }
      if (remoteStatus === "ended") return;
      const lastActivity = Math.max(localLast, remoteTs);
      const idle = Date.now() - lastActivity;
      if (idle <= IDLE_LIMIT_MS) {
        if (remoteTs > localLast) writeLastActivity(remoteTs);
        return;
      }
      endingRef.current = true;
      try {
        await endCompany(activeCompany, lastActivity);
        toast(`Expediente de ${activeCompany} encerrado por inatividade`, { duration: 4000 });
      } finally {
        endingRef.current = false;
      }
    };

    const interval = window.setInterval(checkIdle, CHECK_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") checkIdle(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [user, activeCompany, sessions, endCompany]);

  // Heartbeat
  useEffect(() => {
    if (!user || !activeCompany) return;
    const sid = sessions[activeCompany]?.sessionId;
    if (!sid) return;
    const beat = async () => {
      const idle = Date.now() - readLastActivity();
      if (idle > IDLE_LIMIT_MS) return;
      try {
        await supabase.from("ponto_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sid);
      } catch { /* noop */ }
    };
    beat();
    const id = window.setInterval(beat, 60_000);
    return () => window.clearInterval(id);
  }, [user, activeCompany, sessions]);

  return null;
}
