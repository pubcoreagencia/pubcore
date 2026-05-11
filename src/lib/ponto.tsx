import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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

interface PontoCtx {
  session: PontoSession;
  liveWorkMs: number;
  livePauseMs: number;
  productiveMs: number;
  isLive: boolean;
  start: (user?: string, ownerEmail?: string, userId?: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  end: () => Promise<void>;
  reset: () => void;
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
    const payload: Record<string, unknown> = {
      owner_email: owner,
      user_name: user ?? null,
      started_at: new Date(startedAt).toISOString(),
      status: "working",
      pauses: [],
    };
    if (userId) payload.user_id = userId;
    const { data, error } = await supabase
      .from("ponto_sessions")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) {
      console.error("[ponto] start error", error);
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

  const persistUpdate = (s: PontoSession, extra: Record<string, unknown> = {}) => {
    if (!s.sessionId) return;
    supabase
      .from("ponto_sessions")
      .update({
        status: s.status,
        pauses: s.pauses as unknown as never,
        ended_at: s.endedAt ? new Date(s.endedAt).toISOString() : null,
        ...extra,
      })
      .eq("id", s.sessionId)
      .then(({ error }) => {
        if (error) console.error("[ponto] update error", error);
      });
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

  const end = async () => {
    const now = Date.now();
    let ended: PontoSession | null = null;
    setSession((s) => {
      if (s.status === "off" || s.status === "ended") return s;
      const pauses = [...s.pauses];
      const last = pauses[pauses.length - 1];
      if (last && !last.end) pauses[pauses.length - 1] = { ...last, end: now };
      const next: PontoSession = { ...s, status: "ended", endedAt: now, pauses };
      ended = next;
      return next;
    });
    if (ended) {
      const e = ended as PontoSession;
      const { liveWorkMs, livePauseMs, productiveMs } = compute(e, now);
      persistUpdate(e, {
        total_ms: liveWorkMs,
        productive_ms: productiveMs,
        pause_ms: livePauseMs,
      });
      if (e.sessionId && e.ownerEmail) {
        emit({ type: "ended", sessionId: e.sessionId, ownerEmail: e.ownerEmail });
      }
    }
  };

  const reset = () => setSession(initial);

  const now = Date.now();
  const { liveWorkMs, livePauseMs, productiveMs } = compute(session, now);
  const isLive = session.status === "working" || session.status === "paused";

  return (
    <Ctx.Provider value={{ session, liveWorkMs, livePauseMs, productiveMs, isLive, start, pause, resume, end, reset }}>
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
