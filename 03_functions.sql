CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.list_workspace_members(_workspace_id uuid)
 RETURNS TABLE(user_id uuid, role workspace_role, email text, display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_workspace_member(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  RETURN QUERY
  SELECT m.user_id, m.role, p.email, p.display_name
  FROM public.workspace_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.workspace_id = _workspace_id
  ORDER BY m.role DESC, p.display_name NULLS LAST;
END; $function$
;
CREATE OR REPLACE FUNCTION public.set_member_role(_workspace_id uuid, _user_id uuid, _role workspace_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  UPDATE public.workspace_members SET role = _role
  WHERE workspace_id = _workspace_id AND user_id = _user_id;
END; $function$
;
CREATE OR REPLACE FUNCTION public.remove_member(_workspace_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE owner uuid;
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  SELECT owner_id INTO owner FROM public.workspaces WHERE id = _workspace_id;
  IF owner = _user_id THEN
    RAISE EXCEPTION 'Não é possível remover o dono do workspace';
  END IF;
  DELETE FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id;
END; $function$
;
CREATE OR REPLACE FUNCTION public.has_app_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$function$
;
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id);
$function$
;
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id AND role = 'admin');
$function$
;
CREATE OR REPLACE FUNCTION public.list_accounts_by_status(_status text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, email text, display_name text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.display_name, p.status, p.created_at
    FROM public.profiles p
    WHERE _status IS NULL OR p.status = _status
    ORDER BY p.created_at DESC;
END; $function$
;
CREATE OR REPLACE FUNCTION public.close_stale_ponto_sessions(_idle interval DEFAULT '00:30:00'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_master_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE u_email text;
BEGIN
  IF NEW.role = 'master' THEN
    SELECT lower(email) INTO u_email FROM auth.users WHERE id = NEW.user_id;
    IF coalesce(u_email,'') NOT IN ('contato.pubcore@gmail.com','m4cktheus@gmail.com','luana.deapaes@gmail.com') THEN
      RAISE EXCEPTION 'Apenas contas autorizadas podem ter o perfil master';
    END IF;
  END IF;
  RETURN NEW;
END; $function$
;
CREATE OR REPLACE FUNCTION public.invite_member_by_email(_workspace_id uuid, _email text, _role workspace_role DEFAULT 'member'::workspace_role)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE target_user uuid;
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  SELECT id INTO target_user FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF target_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não encontrado. Peça para ele criar uma conta primeiro.');
  END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_workspace_id, target_user, _role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  RETURN jsonb_build_object('ok', true, 'user_id', target_user);
END; $function$
;
CREATE OR REPLACE FUNCTION public.set_account_status(_user_id uuid, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  UPDATE public.profiles SET status = _status, updated_at = now() WHERE id = _user_id;
END; $function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE wsid uuid; uname text; master_email constant text := 'contato.pubcore@gmail.com'; new_status text;
BEGIN
  new_status := CASE WHEN lower(NEW.email) = master_email THEN 'approved' ELSE 'pending' END;

  INSERT INTO public.profiles (id, email, display_name, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), new_status)
  ON CONFLICT (id) DO NOTHING;

  uname := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Workspace');
  INSERT INTO public.workspaces (name, owner_id) VALUES (uname || '''s Workspace', NEW.id) RETURNING id INTO wsid;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (wsid, NEW.id, 'admin');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF lower(NEW.email) = master_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'master') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$
;
CREATE OR REPLACE FUNCTION public.close_ponto_session(_session_id uuid, _ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
