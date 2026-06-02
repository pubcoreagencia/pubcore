CREATE OR REPLACE FUNCTION public.close_ponto_session(_session_id uuid, _ended_at timestamptz DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_end timestamptz;
  v_pauses jsonb;
  v_pause_ms bigint := 0;
  v_total_ms bigint := 0;
  v_last jsonb;
  v_idx int;
BEGIN
  SELECT id, started_at, updated_at, status, pauses
  INTO r
  FROM public.ponto_sessions
  WHERE id = _session_id
    AND status IN ('working', 'paused')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_end := greatest(r.started_at, coalesce(_ended_at, r.updated_at, now()));
  v_pauses := coalesce(r.pauses, '[]'::jsonb);

  IF jsonb_typeof(v_pauses) IS DISTINCT FROM 'array' THEN
    v_pauses := '[]'::jsonb;
  END IF;

  IF r.status = 'paused' AND jsonb_array_length(v_pauses) > 0 THEN
    v_idx := jsonb_array_length(v_pauses) - 1;
    v_last := v_pauses -> v_idx;
    IF jsonb_typeof(v_last) = 'object' AND (v_last ? 'start') AND NOT (v_last ? 'end') THEN
      v_pauses := jsonb_set(
        v_pauses,
        ARRAY[v_idx::text, 'end'],
        to_jsonb((extract(epoch FROM v_end) * 1000)::bigint),
        true
      );
    END IF;
  END IF;

  SELECT coalesce(
    sum(
      greatest(
        0,
        coalesce((p.value ->> 'end')::bigint, (extract(epoch FROM v_end) * 1000)::bigint)
        - coalesce((p.value ->> 'start')::bigint, (extract(epoch FROM r.started_at) * 1000)::bigint)
      )
    ),
    0
  )
  INTO v_pause_ms
  FROM jsonb_array_elements(v_pauses) AS p(value)
  WHERE jsonb_typeof(p.value) = 'object';

  v_total_ms := greatest(0, (extract(epoch FROM (v_end - r.started_at)) * 1000)::bigint);

  UPDATE public.ponto_sessions
  SET status = 'ended',
      ended_at = v_end,
      pauses = v_pauses,
      pause_ms = v_pause_ms,
      total_ms = v_total_ms,
      productive_ms = greatest(0, v_total_ms - v_pause_ms),
      updated_at = now()
  WHERE id = r.id
    AND status IN ('working', 'paused');

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.close_ponto_session(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_ponto_session(uuid, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.close_stale_ponto_sessions(_idle interval DEFAULT '30 minutes'::interval)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_closed integer := 0;
BEGIN
  FOR r IN
    SELECT id, updated_at
    FROM public.ponto_sessions
    WHERE status IN ('working', 'paused')
      AND updated_at <= now() - _idle
  LOOP
    IF public.close_ponto_session(r.id, r.updated_at) THEN
      v_closed := v_closed + 1;
    END IF;
  END LOOP;

  RETURN v_closed;
END;
$$;

REVOKE ALL ON FUNCTION public.close_stale_ponto_sessions(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_stale_ponto_sessions(interval) TO service_role;

SELECT public.close_stale_ponto_sessions('30 minutes'::interval);

WITH ranked AS (
  SELECT
    id,
    coalesce(updated_at, now()) AS end_at,
    row_number() OVER (
      PARTITION BY workspace_id, user_id
      ORDER BY coalesce(updated_at, started_at) DESC, started_at DESC, id DESC
    ) AS rn
  FROM public.ponto_sessions
  WHERE status IN ('working', 'paused')
    AND user_id IS NOT NULL
)
SELECT public.close_ponto_session(id, end_at)
FROM ranked
WHERE rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ponto_one_active_per_user_workspace
ON public.ponto_sessions (workspace_id, user_id)
WHERE status IN ('working', 'paused') AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ponto_sessions_open_activity
ON public.ponto_sessions (updated_at)
WHERE status IN ('working', 'paused');

CREATE INDEX IF NOT EXISTS idx_ponto_sessions_history_lookup
ON public.ponto_sessions (workspace_id, user_id, started_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close-stale-ponto-sessions') THEN
    PERFORM cron.unschedule('close-stale-ponto-sessions');
  END IF;

  PERFORM cron.schedule(
    'close-stale-ponto-sessions',
    '*/5 * * * *',
    $cron$SELECT public.close_stale_ponto_sessions('30 minutes'::interval);$cron$
  );
END;
$$;