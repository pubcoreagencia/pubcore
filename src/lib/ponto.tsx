import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { COMPANIES, type Company } from "@/lib/mock-data";

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
  sessionId?: string | null;
  company?: Company;
}

export type SessionsMap = Partial<Record<Company, PontoSession>>;

const STORAGE_KEY = "pubcore_ponto_sessions_v3";
const LEGACY_KEY = "pubcore_ponto_session_v2";
const CHANNEL_NAME = "pubcore_ponto_sync_v3";
const ACTIVITY_KEY = "pubcore_ponto_last_activity";
const HOUR_LIMIT_MS = 30 * 60 * 1000; // 30min

const emptySession = (company?: Company): PontoSession => ({
  status: "off",
  startedAt: null,
  endedAt: null,
  pauses: [],
  sessionId: null,
  company,
});

// ---- Event bus ----
type PontoEvent =
  | { type: "started"; sessionId: string; ownerEmail: string; company: Company }
  | { type: "ended"; sessionId: string; ownerEmail: string; company: Company };
type Listener = (e: PontoEvent) => void;
const listeners = new Set<Listener>();
export function onPontoEvent(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(e: PontoEvent) {
  listeners.forEach((l) => {
    try {
      l(e);
    } catch {
      /* noop */
    }
  });
}

// ---- Active session helper (for checklist linking) ----
let _activeSessionId: string | null = null;
let _activeOwner: string | null = null;
let _activeUser: string | null = null;
let _activeCompany: Company | null = null;
export function getActivePontoSession() {
  return {
    sessionId: _activeSessionId,
    ownerEmail: _activeOwner,
    userName: _activeUser,
    company: _activeCompany,
  };
}

export interface PontoRemoteRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  pauses: unknown;
  user_name: string | null;
  owner_email: string;
  company?: string | null;
  productive_ms?: number | null;
  total_ms?: number | null;
  pause_ms?: number | null;
  updated_at?: string | null;
}

interface PontoCtx {
  // Per-company state
  sessions: SessionsMap;
  activeCompany: Company | null;
  computeFor: (company: Company) => {
    liveWorkMs: number;
    livePauseMs: number;
    productiveMs: number;
  };
  dailyProductiveMs: (company: Company) => number;
  dailyTotalMs: (company: Company) => number;

  // Per-company actions
  startCompany: (
    company: Company,
    user?: string,
    ownerEmail?: string,
    userId?: string,
  ) => Promise<void>;
  pauseCompany: (company: Company) => void;
  resumeCompany: (company: Company) => void;
  endCompany: (company: Company, endAtMs?: number) => Promise<void>;

  // Back-compat (operam sobre a empresa ativa)
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

function load(): SessionsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionsMap;
      return parsed && typeof parsed === "object" ? parsed : {};
    }
    // Migra do shape antigo (sessão única sem company) silenciosamente
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const s = JSON.parse(legacy) as PontoSession;
      if (s && s.status && s.status !== "off") {
        // Sem company; ignora migração para não vincular ao company errado.
        return {};
      }
    }
    return {};
  } catch {
    return {};
  }
}

function save(map: SessionsMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function markActivity(ts = Date.now()) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITY_KEY, String(ts));
}

function compute(s: PontoSession | undefined, now: number) {
  if (!s || !s.startedAt) return { liveWorkMs: 0, livePauseMs: 0, productiveMs: 0 };
  const endRef = s.status === "ended" && s.endedAt ? s.endedAt : now;
  const liveWorkMs = Math.max(0, endRef - s.startedAt);
  const livePauseMs = s.pauses.reduce((acc, p) => {
    const stop = p.end ?? (s.status === "paused" ? now : p.start);
    return acc + Math.max(0, stop - p.start);
  }, 0);
  const productiveMs = Math.max(0, liveWorkMs - livePauseMs);
  return { liveWorkMs, livePauseMs, productiveMs };
}

function normalizePauses(input: unknown): PontoPause[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const raw = p as { start?: unknown; end?: unknown };
      const start = Number(raw.start);
      const end = raw.end === undefined || raw.end === null ? undefined : Number(raw.end);
      if (!Number.isFinite(start)) return null;
      return Number.isFinite(end) ? { start, end } : { start };
    })
    .filter(Boolean) as PontoPause[];
}

function closeSessionSnapshot(
  s: PontoSession,
  endAtMs: number,
): { session: PontoSession; totalMs: number; pauseMs: number; productiveMs: number } {
  const endAt = Math.max(s.startedAt ?? endAtMs, endAtMs);
  const pauses = [...s.pauses];
  const last = pauses[pauses.length - 1];
  if (last && !last.end) pauses[pauses.length - 1] = { ...last, end: endAt };
  const session: PontoSession = { ...s, status: "ended", endedAt: endAt, pauses };
  const { liveWorkMs, livePauseMs, productiveMs } = compute(session, endAt);
  return { session, totalMs: liveWorkMs, pauseMs: livePauseMs, productiveMs };
}

function buildClosedRemotePayload(row: PontoRemoteRow, endAtMs: number) {
  const startedAt = new Date(row.started_at).getTime();
  const snapshot = closeSessionSnapshot(
    {
      status: row.status === "paused" ? "paused" : "working",
      startedAt,
      endedAt: null,
      pauses: normalizePauses(row.pauses),
      sessionId: row.id,
      ownerEmail: row.owner_email,
      user: row.user_name ?? undefined,
      company: row.company as Company | undefined,
    },
    Math.max(startedAt, endAtMs),
  );
  return {
    status: "ended",
    ended_at: new Date(snapshot.session.endedAt ?? endAtMs).toISOString(),
    pauses: snapshot.session.pauses as unknown as never,
    total_ms: snapshot.totalMs,
    productive_ms: snapshot.productiveMs,
    pause_ms: snapshot.pauseMs,
    updated_at: new Date().toISOString(),
  };
}

async function resolveWorkspaceId(userId: string) {
  const active = getActiveWorkspaceId();
  if (active) return active;
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

function todayKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function notifiedKey(company: Company) {
  return `pubcore_ponto_notified_${todayKey()}_${company}`;
}

function fireBrowserNotification(company: Company) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    new Notification("PUB CORE", {
      body: `${company} excedeu 30min de expediente hoje.`,
      tag: `pubcore-ponto-${company}-${todayKey()}`,
      icon: "/favicon.ico",
    });
    return true;
  } catch {
    return false;
  }
}

export function PontoProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionsMap>(() => load());
  const [dailyEndedMs, setDailyEndedMs] = useState<Partial<Record<Company, number>>>({});
  const [dailyEndedTotal, setDailyEndedTotal] = useState<Partial<Record<Company, number>>>({});
  const [, setTick] = useState(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const ignoreNextSaveRef = useRef(false);
  const dailyResetKeyRef = useRef<string>(todayKey());

  // Persist + sync
  useEffect(() => {
    if (ignoreNextSaveRef.current) {
      ignoreNextSaveRef.current = false;
      return;
    }
    save(sessions);
    channelRef.current?.postMessage(sessions);
    // Atualiza helper de sessão ativa
    const active = Object.entries(sessions).find(
      ([, s]) => s && (s.status === "working" || s.status === "paused"),
    ) as [Company, PontoSession] | undefined;
    _activeSessionId = active?.[1].sessionId ?? null;
    _activeOwner = active?.[1].ownerEmail ?? null;
    _activeUser = active?.[1].user ?? null;
    _activeCompany = active?.[0] ?? null;
  }, [sessions]);

  // Cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as SessionsMap;
        ignoreNextSaveRef.current = true;
        setSessions(next ?? {});
      } catch {
        /* noop */
      }
    };
    window.addEventListener("storage", onStorage);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        const next = ev.data as SessionsMap;
        if (next && typeof next === "object") {
          ignoreNextSaveRef.current = true;
          setSessions(next);
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

  // Tick enquanto houver sessão ativa
  useEffect(() => {
    const anyLive = Object.values(sessions).some(
      (s) => s?.status === "working" || s?.status === "paused",
    );
    if (!anyLive) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [sessions]);

  // Carrega totais do dia (sessões já encerradas) e mantém atualizado
  const reloadDailyTotals = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        setDailyEndedMs({});
        setDailyEndedTotal({});
        return;
      }
      const { data, error } = await supabase
        .from("ponto_sessions")
        .select("company, productive_ms, total_ms, status")
        .eq("user_id", userId)
        .gte("started_at", startOfTodayISO())
        .eq("status", "ended");
      if (error || !data) return;
      const productive: Partial<Record<Company, number>> = {};
      const total: Partial<Record<Company, number>> = {};
      for (const row of data as Array<{
        company: string | null;
        productive_ms: number | null;
        total_ms: number | null;
      }>) {
        const c = row.company as Company | null;
        if (!c) continue;
        productive[c] = (productive[c] ?? 0) + (row.productive_ms ?? 0);
        total[c] = (total[c] ?? 0) + (row.total_ms ?? 0);
      }
      setDailyEndedMs(productive);
      setDailyEndedTotal(total);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    reloadDailyTotals();
  }, [reloadDailyTotals]);

  // Reset diário (rollover de meia-noite)
  useEffect(() => {
    const id = window.setInterval(() => {
      const k = todayKey();
      if (k !== dailyResetKeyRef.current) {
        dailyResetKeyRef.current = k;
        setDailyEndedMs({});
        setDailyEndedTotal({});
        reloadDailyTotals();
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [reloadDailyTotals]);

  const computeFor = useCallback(
    (company: Company) => compute(sessions[company], Date.now()),
    [sessions],
  );

  const dailyProductiveMs = useCallback(
    (company: Company) => {
      const live = compute(sessions[company], Date.now()).productiveMs;
      const isLive =
        sessions[company]?.status === "working" || sessions[company]?.status === "paused";
      return (dailyEndedMs[company] ?? 0) + (isLive ? live : 0);
    },
    [sessions, dailyEndedMs],
  );

  const dailyTotalMs = useCallback(
    (company: Company) => {
      const live = compute(sessions[company], Date.now()).liveWorkMs;
      const isLive =
        sessions[company]?.status === "working" || sessions[company]?.status === "paused";
      return (dailyEndedTotal[company] ?? 0) + (isLive ? live : 0);
    },
    [sessions, dailyEndedTotal],
  );

  // Notificação nativa quando uma empresa cruza 30min produtivos no dia
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    for (const c of COMPANIES) {
      const ms = dailyProductiveMs(c);
      if (ms < HOUR_LIMIT_MS) continue;
      const key = notifiedKey(c);
      if (localStorage.getItem(key)) continue;
      const fired = fireBrowserNotification(c);
      // Marca mesmo se não disparou (permissão negada) para não tentar repetidas vezes
      localStorage.setItem(key, fired ? "1" : "blocked");
    }
  });

  const updateCompany = useCallback(
    (company: Company, updater: (s: PontoSession) => PontoSession) => {
      setSessions((prev) => {
        const cur = prev[company] ?? emptySession(company);
        return { ...prev, [company]: updater(cur) };
      });
    },
    [],
  );

  const persistUpdate = useCallback(
    async (s: PontoSession, extra: Record<string, unknown> = {}) => {
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
    },
    [],
  );

  const startCompany = useCallback<PontoCtx["startCompany"]>(
    async (company, user, ownerEmail, userId) => {
      const owner = ownerEmail ?? "guest@pubcore.local";
      const startedAt = Date.now();
      markActivity(startedAt);

      // Solicitar permissão de notificação no primeiro start (gesto do usuário)
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          try {
            Notification.requestPermission().catch(() => undefined);
          } catch {
            /* noop */
          }
        }
      }

      let resolvedUserId = userId ?? null;
      if (!resolvedUserId) {
        try {
          const { data } = await supabase.auth.getUser();
          resolvedUserId = data.user?.id ?? null;
        } catch {
          /* noop */
        }
      }
      const workspaceId = resolvedUserId ? await resolveWorkspaceId(resolvedUserId) : null;
      if (!workspaceId || !resolvedUserId) {
        console.error("[ponto] start aborted: missing workspace/user", {
          workspaceId,
          resolvedUserId,
        });
        return;
      }

      // Encerra qualquer expediente aberto antes de iniciar outro. Isso impede
      // sobreposição entre empresas, abas, dispositivos e sessões presas antigas.
      const { data: openRows, error: openError } = await supabase
        .from("ponto_sessions")
        .select(
          "id, started_at, ended_at, status, pauses, user_name, owner_email, company, productive_ms, total_ms, pause_ms, updated_at",
        )
        .eq("workspace_id", workspaceId)
        .eq("user_id", resolvedUserId)
        .in("status", ["working", "paused"]);
      if (openError) console.error("[ponto] open sessions lookup error", openError);
      await Promise.all(
        (openRows ?? []).map((row) =>
          supabase
            .from("ponto_sessions")
            .update(buildClosedRemotePayload(row as PontoRemoteRow, startedAt))
            .eq("id", row.id)
            .in("status", ["working", "paused"]),
        ),
      );

      setSessions((prev) => {
        const next: SessionsMap = { ...prev };
        for (const c of COMPANIES) {
          const s = next[c];
          if (!s || (s.status !== "working" && s.status !== "paused")) continue;
          if (c !== company || s.sessionId) {
            next[c] = closeSessionSnapshot(s, startedAt).session;
          }
        }
        return next;
      });
      if ((openRows ?? []).length > 0) reloadDailyTotals();

      const payload: Record<string, unknown> = {
        workspace_id: workspaceId,
        user_id: resolvedUserId,
        owner_email: owner,
        user_name: user ?? null,
        company,
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
        const { data: current } = await supabase
          .from("ponto_sessions")
          .select(
            "id, started_at, ended_at, status, pauses, user_name, owner_email, company, productive_ms, total_ms, pause_ms, updated_at",
          )
          .eq("workspace_id", workspaceId)
          .eq("user_id", resolvedUserId)
          .in("status", ["working", "paused"])
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const row = current as PontoRemoteRow | null;
        const currentCompany = row?.company as Company | null;
        if (row && currentCompany) {
          updateCompany(currentCompany, () => ({
            status: row.status === "paused" ? "paused" : "working",
            startedAt: new Date(row.started_at).getTime(),
            endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
            pauses: normalizePauses(row.pauses),
            user: row.user_name ?? undefined,
            ownerEmail: row.owner_email,
            sessionId: row.id,
            company: currentCompany,
          }));
        }
        return;
      }
      const sessionId = (data?.id as string | undefined) ?? null;
      updateCompany(company, () => ({
        status: "working",
        startedAt,
        endedAt: null,
        pauses: [],
        user,
        ownerEmail: owner,
        sessionId,
        company,
      }));
      if (sessionId) emit({ type: "started", sessionId, ownerEmail: owner, company });
    },
    [reloadDailyTotals, updateCompany],
  );

  const pauseCompany = useCallback<PontoCtx["pauseCompany"]>(
    (company) => {
      markActivity();
      setSessions((prev) => {
        const cur = prev[company];
        if (!cur || cur.status !== "working") return prev;
        const next = {
          ...cur,
          status: "paused" as PontoStatus,
          pauses: [...cur.pauses, { start: Date.now() }],
        };
        persistUpdate(next);
        return { ...prev, [company]: next };
      });
    },
    [persistUpdate],
  );

  const resumeCompany = useCallback<PontoCtx["resumeCompany"]>(
    (company) => {
      markActivity();
      setSessions((prev) => {
        const cur = prev[company];
        if (!cur || cur.status !== "paused") return prev;
        // Encerra outras sessões locais que tenham ficado presas para manter apenas uma ativa.
        const map: SessionsMap = { ...prev };
        for (const c of COMPANIES) {
          const s = map[c];
          if (!s || c === company) continue;
          if (s.status === "working" || s.status === "paused") {
            const closed = closeSessionSnapshot(s, Date.now());
            map[c] = closed.session;
            if (s.sessionId)
              persistUpdate(closed.session, {
                total_ms: closed.totalMs,
                productive_ms: closed.productiveMs,
                pause_ms: closed.pauseMs,
              });
          }
        }
        const pauses = [...cur.pauses];
        const last = pauses[pauses.length - 1];
        if (last && !last.end) pauses[pauses.length - 1] = { ...last, end: Date.now() };
        const next = { ...cur, status: "working" as PontoStatus, pauses };
        persistUpdate(next);
        map[company] = next;
        return map;
      });
    },
    [persistUpdate],
  );

  const endCompany = useCallback<PontoCtx["endCompany"]>(
    async (company, endAtMs) => {
      const now = Date.now();
      const cur = sessions[company];
      if (!cur || cur.status === "off" || cur.status === "ended") return;
      const rawEnd = typeof endAtMs === "number" && Number.isFinite(endAtMs) ? endAtMs : now;
      const endAt = Math.min(now, Math.max(rawEnd, cur.startedAt ?? rawEnd));
      const pauses = [...cur.pauses];
      const last = pauses[pauses.length - 1];
      if (last && !last.end) pauses[pauses.length - 1] = { ...last, end: endAt };
      const ended: PontoSession = { ...cur, status: "ended", endedAt: endAt, pauses };
      updateCompany(company, () => ended);
      const { liveWorkMs, livePauseMs, productiveMs } = compute(ended, endAt);
      const saved = await persistUpdate(ended, {
        total_ms: liveWorkMs,
        productive_ms: productiveMs,
        pause_ms: livePauseMs,
      });
      if (saved && ended.sessionId && ended.ownerEmail) {
        emit({ type: "ended", sessionId: ended.sessionId, ownerEmail: ended.ownerEmail, company });
      }
      // Atualiza totais diários
      setDailyEndedMs((m) => ({ ...m, [company]: (m[company] ?? 0) + productiveMs }));
      setDailyEndedTotal((m) => ({ ...m, [company]: (m[company] ?? 0) + liveWorkMs }));
    },
    [sessions, persistUpdate, updateCompany],
  );

  const adoptSession = useCallback<PontoCtx["adoptSession"]>(
    (row) => {
      const pauses: PontoPause[] = Array.isArray(row.pauses) ? (row.pauses as PontoPause[]) : [];
      const status: PontoStatus =
        row.status === "paused" ? "paused" : row.status === "ended" ? "ended" : "working";
      const company = (row.company as Company | null) ?? null;
      if (!company) return;
      updateCompany(company, () => ({
        status,
        startedAt: new Date(row.started_at).getTime(),
        endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
        pauses,
        user: row.user_name ?? undefined,
        ownerEmail: row.owner_email,
        sessionId: row.id,
        company,
      }));
    },
    [updateCompany],
  );

  // Compat: empresa ativa = apenas expediente realmente aberto
  const activeCompany = useMemo<Company | null>(() => {
    const entries = Object.entries(sessions) as [Company, PontoSession | undefined][];
    const working = entries.find(([, s]) => s?.status === "working");
    if (working) return working[0];
    const paused = entries.find(([, s]) => s?.status === "paused");
    if (paused) return paused[0];
    return null;
  }, [sessions]);

  const activeSession = activeCompany
    ? (sessions[activeCompany] ?? emptySession(activeCompany))
    : emptySession();
  const liveMetrics = compute(activeSession, Date.now());
  const isLive = activeSession.status === "working" || activeSession.status === "paused";

  const start = useCallback<PontoCtx["start"]>(
    async (user, ownerEmail, userId) => {
      // Back-compat: usa primeira empresa como fallback se nenhuma ativa
      const target = activeCompany ?? COMPANIES[0];
      await startCompany(target, user, ownerEmail, userId);
    },
    [activeCompany, startCompany],
  );

  const pause = useCallback(() => {
    if (activeCompany) pauseCompany(activeCompany);
  }, [activeCompany, pauseCompany]);
  const resume = useCallback(() => {
    if (activeCompany) resumeCompany(activeCompany);
  }, [activeCompany, resumeCompany]);
  const end = useCallback(
    async (endAtMs?: number) => {
      if (activeCompany) await endCompany(activeCompany, endAtMs);
    },
    [activeCompany, endCompany],
  );
  const reset = useCallback(() => setSessions({}), []);

  return (
    <Ctx.Provider
      value={{
        sessions,
        activeCompany,
        computeFor,
        dailyProductiveMs,
        dailyTotalMs,
        startCompany,
        pauseCompany,
        resumeCompany,
        endCompany,
        session: activeSession,
        liveWorkMs: liveMetrics.liveWorkMs,
        livePauseMs: liveMetrics.livePauseMs,
        productiveMs: liveMetrics.productiveMs,
        isLive,
        start,
        pause,
        resume,
        end,
        reset,
        adoptSession,
      }}
    >
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
