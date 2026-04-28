import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type PontoStatus = "off" | "working" | "paused" | "ended";

export interface PontoPause {
  start: number;
  end?: number;
}

export interface PontoSession {
  status: PontoStatus;
  startedAt: number | null; // epoch ms — quando o expediente começou
  endedAt: number | null;
  pauses: PontoPause[];     // todas as pausas (algumas podem estar abertas)
  user?: string;
}

const STORAGE_KEY = "pubcore_ponto_session_v1";
const CHANNEL_NAME = "pubcore_ponto_sync";

const initial: PontoSession = {
  status: "off",
  startedAt: null,
  endedAt: null,
  pauses: [],
};

interface PontoCtx {
  session: PontoSession;
  liveWorkMs: number;
  livePauseMs: number;
  productiveMs: number;
  isLive: boolean;
  start: (user?: string) => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
  reset: () => void;
}

const Ctx = createContext<PontoCtx | null>(null);

function load(): PontoSession {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const s = JSON.parse(raw) as PontoSession;
    if (!s || typeof s !== "object") return initial;
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
  if (!session.startedAt) {
    return { liveWorkMs: 0, livePauseMs: 0, productiveMs: 0 };
  }
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

  // hidrata após mount (evita SSR mismatch)
  useEffect(() => {
    setSession(load());
  }, []);

  // tick global de 1s — só roda quando ativo (mas o tempo é calculado por epoch, não acumulado)
  useEffect(() => {
    if (session.status !== "working" && session.status !== "paused") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [session.status]);

  // persiste em cada mudança + transmite para outras abas
  useEffect(() => {
    if (ignoreNextSaveRef.current) {
      ignoreNextSaveRef.current = false;
      return;
    }
    save(session);
    channelRef.current?.postMessage(session);
  }, [session]);

  // sincronização entre abas
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

    // re-render ao voltar para a aba — garante UI atualizada após longo tempo oculto
    const onVis = () => setTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVis);
      bc?.close();
      channelRef.current = null;
    };
  }, []);

  const start = (user?: string) => {
    setSession({
      status: "working",
      startedAt: Date.now(),
      endedAt: null,
      pauses: [],
      user,
    });
  };

  const pause = () => {
    setSession((s) => {
      if (s.status !== "working") return s;
      return { ...s, status: "paused", pauses: [...s.pauses, { start: Date.now() }] };
    });
  };

  const resume = () => {
    setSession((s) => {
      if (s.status !== "paused") return s;
      const pauses = [...s.pauses];
      const last = pauses[pauses.length - 1];
      if (last && !last.end) pauses[pauses.length - 1] = { ...last, end: Date.now() };
      return { ...s, status: "working", pauses };
    });
  };

  const end = () => {
    setSession((s) => {
      if (s.status === "off" || s.status === "ended") return s;
      const now = Date.now();
      const pauses = [...s.pauses];
      const last = pauses[pauses.length - 1];
      if (last && !last.end) pauses[pauses.length - 1] = { ...last, end: now };
      return { ...s, status: "ended", endedAt: now, pauses };
    });
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
