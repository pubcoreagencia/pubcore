import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveWorkspaceId } from "@/lib/workspace";

export type PontoStatus = "off" | "working" | "paused" | "ended";

export interface PontoPause {
  start: number;
  end?: number;
}

export interface PontoSession {
  status: PontoStatus;
  startedAt: number | null;
  endedAt: number | null;
  pauses: PontoPause[];
  user?: string;
  ownerEmail?: string;
  sessionId?: string | null; // id da linha em ponto_sessions
}

const STORAGE_KEY = "pubcore_ponto_session_v2";
const CHANNEL_NAME = "pubcore_ponto_sync";

const initial: PontoSession = {
  status: "off",
  startedAt: null,
  endedAt: null,
  pauses: [],
  sessionId: null,
};

// ---- Event bus para integrações (ex.: checklist) ----
type PontoEvent =
  | { type: "started"; sessionId: string; ownerEmail: string }
  | { type: "ended"; sessionId: string; ownerEmail: string };
type Listener = (e: PontoEvent) => void;
const listeners = new Set<Listener>();
export function onPontoEvent(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(e: PontoEvent) {
  listeners.forEach((l) => {
    try { l(e); } catch {}
  });
}

// ---- Helper global para outras stores lerem a sessão ativa ----
let _activeSessionId: string | null = null;
let _activeOwner: string | null = null;
let _activeUser: string | null = null;
export function getActivePontoSession() {
  return { sessionId: _activeSessionId, ownerEmail: _activeOwner, userName: _activeUser };
}

export interface PontoRemoteRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  pauses: unknown;
  user_name: string | null;
  owner_email: string;
}

interface PontoCtx {
  session: PontoSession;
  liveWorkMs: number;
  livePauseMs: number;
  productiveMs: number;
  isLive: boolean;
  start: (user?: string, ownerEmail?: string, userId?: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  end: (endAtMs?: number) => Promise<void>;
  reset: () => void;
  adoptSession: (row: PontoRemoteRow) => void;
}

const Ctx = createContext<PontoCtx | null>(null);

function load(): PontoSession {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const s = JSON.parse(raw) as PontoSession;
    return { ...initial, ...s, pauses: Array.isArray(s.pauses) ? s.pauses : [] };
  } catch {
    return initial;
  }
}

function save(s: PontoSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function compute(session: PontoSession, now: number) {
  if (!session.startedAt) return { liveWorkMs: 0, livePauseMs: 0, productiveMs: 0 };
  const endRef = session.status === "ended" && session.endedAt ? session.endedAt : now;
  const liveWorkMs = Math.max(0, endRef - session.startedAt);
  const livePauseMs = session.pauses.reduce((acc, p) => {
    const stop = p.end ?? (session.status === "paused" ? now : p.start);
    return acc + Math.max(0, stop - p.start);
  }, 0);
  const productiveMs = Math.max(0, liveWorkMs - livePauseMs);
  return { liveWorkMs, livePauseMs, productiveMs };
}

async function resolveWorkspaceId(userId: string) {
  const active = getActiveWorkspaceId();
  if (active) return active;
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) console.error("[ponto] workspace fallback error", error);
  return (data?.workspace_id as string | undefined) ?? null;
}

export function PontoProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PontoSession>(initial);
  const [, setTick] = useState(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const ignoreNextSaveRef = useRef(false);

  useEffect(() => {
    const loaded = load();
    setSession(loaded);
    _activeSessionId = loaded.status === "working" || loaded.status === "paused" ? (loaded.sessionId ?? null) : null;
    _activeOwner = loaded.ownerEmail ?? null;
    _activeUser = loaded.user ?? null;
  }, []);

  useEffect(() => {
    if (session.status !== "working" && session.status !== "paused") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [session.status]);

  useEffect(() => {
    if (ignoreNextSaveRef.current) {
      ignoreNextSaveRef.current = false;
      return;
    }
    save(session);
    channelRef.current?.postMessage(session);
    _activeSessionId = session.status === "working" || session.status === "paused" ? (session.sessionId ?? null) : null;
    _activeOwner = session.ownerEmail ?? null;
    _activeUser = session.user ?? null;
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as PontoSession;
        ignoreNextSaveRef.current = true;
        setSession(next);
      } catch {}
    };
    window.addEventListener("storage", onStorage);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        const next = ev.data as PontoSession;
        if (next && typeof next === "object") {
          ignoreNextSaveRef.current = true;
          setSession(next);
        }
      };
      channelRef.current = bc;
    }

    const onVis = () => setTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVis);
      bc?.close();
      channelRef.current = null;
    };
  }, []);

  const start = async (user?: string, ownerEmail?: string, userId?: string) => {
    const owner = ownerEmail ?? "guest@pubcore.local";
    const startedAt = Date.now();
    let resolvedUserId = userId ?? null;
    if (!resolvedUserId) {
      try {
        const { data } = await supabase.auth.getUser();
        resolvedUserId = data.user?.id ?? null;
      } catch {}
    }
    const workspaceId = resolvedUserId ? await resolveWorkspaceId(resolvedUserId) : null;
    if (!workspaceId || !resolvedUserId) {
      console.error("[ponto] start aborted: missing workspace_id or user_id", { workspaceId, resolvedUserId });
      return;
    }
    const payload: Record<string, unknown> = {
      workspace_id: workspaceId,
      user_id: resolvedUserId,
      owner_email: owner,
      user_name: user ?? null,
      started_at: new Date(startedAt).toISOString(),
      status: "working",
      pauses: [],
    };
    const { data, error } = await supabase
      .from("ponto_sessions")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) {
      console.error("[ponto] start error", error);
      return;
    }
    const sessionId = (data?.id as string | undefined) ?? null;
    const next: PontoSession = {
      status: "working",
      startedAt,
      endedAt: null,
      pauses: [],
      user,
      ownerEmail: owner,
      sessionId,
    };
    setSession(next);
    if (sessionId) emit({ type: "started", sessionId, ownerEmail: owner });
  };

  const persistUpdate = async (s: PontoSession, extra: Record<string, unknown> = {}) => {
    if (!s.sessionId) return false;
    const { error } = await supabase
      .from("ponto_sessions")
      .update({
        status: s.status,
        pauses: s.pauses as unknown as never,
        ended_at: s.endedAt ? new Date(s.endedAt).toISOString() : null,
        updated_at: new Date().toISOString(),
        ...extra,
      })
      .eq("id", s.sessionId);
    if (error) {
      console.error("[ponto] update error", error);
      return false;
    }
    return true;
  };

  const pause = () => {
    setSession((s) => {
      if (s.status !== "working") return s;
      const next = { ...s, status: "paused" as PontoStatus, pauses: [...s.pauses, { start: Date.now() }] };
      persistUpdate(next);
      return next;
    });
  };

  const resume = () => {
    setSession((s) => {
      if (s.status !== "paused") return s;
      const pauses = [...s.pauses];
      const last = pauses[pauses.length - 1];
      if (last && !last.end) pauses[pauses.length - 1] = { ...last, end: Date.now() };
      const next = { ...s, status: "working" as PontoStatus, pauses };
      persistUpdate(next);
      return next;
    });
  };

  const end = async (endAtMs?: number) => {
    const now = Date.now();
    if (session.status === "off" || session.status === "ended") return;
    // Clamp endAt: nunca antes do início, nunca depois de agora
    const rawEnd = typeof endAtMs === "number" && Number.isFinite(endAtMs) ? endAtMs : now;
    const endAt = Math.min(now, Math.max(rawEnd, session.startedAt ?? rawEnd));
    const pauses = [...session.pauses];
    const last = pauses[pauses.length - 1];
    if (last && !last.end) pauses[pauses.length - 1] = { ...last, end: endAt };
    const ended: PontoSession = { ...session, status: "ended", endedAt: endAt, pauses };
    setSession(ended);
    const { liveWorkMs, livePauseMs, productiveMs } = compute(ended, endAt);
    if (!ended.sessionId) {
      const { data: authData } = await supabase.auth.getUser();
      const resolvedUserId = authData.user?.id ?? null;
      const workspaceId = resolvedUserId ? await resolveWorkspaceId(resolvedUserId) : null;
      const owner = ended.ownerEmail ?? authData.user?.email ?? "guest@pubcore.local";
      if (!resolvedUserId || !workspaceId) {
        console.error("[ponto] end aborted: missing session_id fallback data", { workspaceId, resolvedUserId });
        return;
      }
      const { data, error } = await supabase
        .from("ponto_sessions")
        .insert({
          workspace_id: workspaceId,
          user_id: resolvedUserId,
          owner_email: owner,
          user_name: ended.user ?? null,
          started_at: new Date(ended.startedAt ?? endAt).toISOString(),
          ended_at: new Date(endAt).toISOString(),
          status: "ended",
          pauses: ended.pauses as unknown as never,
          total_ms: liveWorkMs,
          productive_ms: productiveMs,
          pause_ms: livePauseMs,
        } as never)
        .select("id")
        .single();
      if (error) {
        console.error("[ponto] end fallback insert error", error);
        return;
      }
      const sessionId = (data?.id as string | undefined) ?? null;
      if (sessionId) {
        setSession({ ...ended, sessionId, ownerEmail: owner });
        emit({ type: "ended", sessionId, ownerEmail: owner });
      }
      return;
    }
    const saved = await persistUpdate(ended, {
      total_ms: liveWorkMs,
      productive_ms: productiveMs,
      pause_ms: livePauseMs,
    });
    if (saved && ended.sessionId && ended.ownerEmail) {
      emit({ type: "ended", sessionId: ended.sessionId, ownerEmail: ended.ownerEmail });
    }
  };

  const reset = () => setSession(initial);

  const adoptSession = (row: PontoRemoteRow) => {
    const pauses: PontoPause[] = Array.isArray(row.pauses) ? (row.pauses as PontoPause[]) : [];
    const status: PontoStatus = row.status === "paused" ? "paused" : row.status === "ended" ? "ended" : "working";
    const next: PontoSession = {
      status,
      startedAt: new Date(row.started_at).getTime(),
      endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
      pauses,
      user: row.user_name ?? undefined,
      ownerEmail: row.owner_email,
      sessionId: row.id,
    };
    setSession(next);
  };

  const now = Date.now();
  const { liveWorkMs, livePauseMs, productiveMs } = compute(session, now);
  const isLive = session.status === "working" || session.status === "paused";

  return (
    <Ctx.Provider value={{ session, liveWorkMs, livePauseMs, productiveMs, isLive, start, pause, resume, end, reset, adoptSession }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePonto() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePonto must be used within PontoProvider");
  return c;
}

export function fmtTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
