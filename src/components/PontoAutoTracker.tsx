import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePonto, type PontoRemoteRow } from "@/lib/ponto";
import { getActiveWorkspaceId } from "@/lib/workspace";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutos
const ACTIVITY_KEY = "pubcore_ponto_last_activity";
const CHECK_INTERVAL_MS = 30_000;

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

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

export function PontoAutoTracker() {
  const { user } = useAuth();
  const { session, isLive, start, end, adoptSession } = usePonto();
  const bootstrappedForUser = useRef<string | null>(null);
  const endingRef = useRef(false);

  // Atividade do usuário → reseta o timer de inatividade
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mark = () => writeLastActivity(Date.now());
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    mark();
    return () => events.forEach((e) => window.removeEventListener(e, mark));
  }, []);

  // Bootstrap automático: ao logar, recupera ou cria sessão do dia
  useEffect(() => {
    if (!user) {
      bootstrappedForUser.current = null;
      return;
    }
    if (bootstrappedForUser.current === user.id) return;

    let cancelled = false;
    (async () => {
      // Aguarda workspace ativo (resolvido pelo WorkspaceProvider)
      let tries = 0;
      while (!getActiveWorkspaceId() && tries < 20) {
        await new Promise((r) => setTimeout(r, 150));
        tries++;
      }
      if (cancelled) return;

      try {
        const { data, error } = await supabase
          .from("ponto_sessions")
          .select("id, started_at, ended_at, status, pauses, user_name, owner_email, updated_at")
          .eq("user_id", user.id)
          .gte("started_at", startOfTodayISO())
          .in("status", ["working", "paused"])
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("[ponto-auto] lookup error", error);
          return;
        }
        if (data) {
          // Inatividade real = tempo desde o último updated_at remoto.
          // localStorage não serve aqui pois num browser/aba novo ele zera
          // e fazia o sistema adotar sessões abandonadas (mostrando timer "fantasma").
          const remoteUpdatedTs = data.updated_at ? new Date(data.updated_at).getTime() : new Date(data.started_at).getTime();
          const idle = Date.now() - remoteUpdatedTs;
          if (idle > IDLE_LIMIT_MS) {
            // Sessão abandonada → encerra e abre uma nova zerada
            adoptSession(data as PontoRemoteRow);
            await end();
            await start(user.name, user.email, user.id);
            toast("Expediente anterior encerrado por inatividade. Novo iniciado.", { duration: 3500 });
          } else if (session.sessionId !== data.id) {
            adoptSession(data as PontoRemoteRow);
          }
        } else if (!isLive) {
          await start(user.name, user.email, user.id);
          toast("Expediente iniciado automaticamente", { duration: 2500 });
        }
        writeLastActivity(Date.now());
        bootstrappedForUser.current = user.id;
      } catch (e) {
        console.error("[ponto-auto] bootstrap exception", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isLive, session.sessionId, start, end, adoptSession]);

  // Verifica inatividade periodicamente e ao retornar à aba
  useEffect(() => {
    if (!user) return;

    const checkIdle = async () => {
      if (endingRef.current) return;
      if (!isLive) return;
      const localLast = readLastActivity();
      const localIdle = Date.now() - localLast;
      if (localIdle <= IDLE_LIMIT_MS) return;

      // Antes de encerrar, confere updated_at remoto: pode haver outra aba/
      // dispositivo ativo batendo heartbeat. Se o remoto está fresco, abortamos.
      let lastActivity = localLast;
      if (session.sessionId) {
        try {
          const { data } = await supabase
            .from("ponto_sessions")
            .select("updated_at, status")
            .eq("id", session.sessionId)
            .maybeSingle();
          if (data) {
            if (data.status === "ended") return; // já encerrado por outro lado
            const remoteTs = data.updated_at ? new Date(data.updated_at).getTime() : 0;
            const remoteIdle = Date.now() - remoteTs;
            if (remoteIdle <= IDLE_LIMIT_MS) {
              // Outro dispositivo está ativo. Sincroniza nosso relógio local
              // para não ficar tentando encerrar a cada ciclo.
              writeLastActivity(remoteTs);
              return;
            }
            lastActivity = Math.max(localLast, remoteTs);
          }
        } catch (e) {
          console.error("[ponto-auto] remote idle check error", e);
        }
      }

      endingRef.current = true;
      try {
        await end(lastActivity);
        toast("Expediente encerrado automaticamente por inatividade", { duration: 4000 });
      } finally {
        endingRef.current = false;
      }
    };

    const interval = window.setInterval(checkIdle, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkIdle();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [user, isLive, end, session.sessionId]);

  // Heartbeat: enquanto o expediente está ativo, mantém updated_at fresco
  // no Supabase para que a detecção de abandono em outro browser/aba funcione.
  useEffect(() => {
    if (!user || !isLive || !session.sessionId) return;
    const sid = session.sessionId;
    const beat = async () => {
      // Só bate o coração se houve atividade recente nesta aba
      const idle = Date.now() - readLastActivity();
      if (idle > IDLE_LIMIT_MS) return;
      try {
        await supabase
          .from("ponto_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sid);
      } catch (e) {
        console.error("[ponto-auto] heartbeat error", e);
      }
    };
    beat();
    const id = window.setInterval(beat, 60_000);
    return () => window.clearInterval(id);
  }, [user, isLive, session.sessionId]);

  return null;
}

