
-- 1. Add status column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending','approved','rejected'));

-- 2. Backfill existing profiles as approved (nobody locked out)
UPDATE public.profiles SET status = 'approved' WHERE status IS NULL OR status = 'pending';

-- 3. Update new-user trigger so new sign-ups start pending (except master)
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
END; $function$;

-- 4. RLS: master can read/update all profiles
DROP POLICY IF EXISTS profiles_select_master ON public.profiles;
CREATE POLICY profiles_select_master ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_app_role(auth.uid(), 'master'::app_role));

DROP POLICY IF EXISTS profiles_update_master ON public.profiles;
CREATE POLICY profiles_update_master ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_app_role(auth.uid(), 'master'::app_role));

-- 5. RPCs for master
CREATE OR REPLACE FUNCTION public.list_accounts_by_status(_status text DEFAULT NULL)
 RETURNS TABLE(id uuid, email text, display_name text, status text, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.display_name, p.status, p.created_at
    FROM public.profiles p
    WHERE _status IS NULL OR p.status = _status
    ORDER BY p.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.set_account_status(_user_id uuid, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  UPDATE public.profiles SET status = _status, updated_at = now() WHERE id = _user_id;
END; $$;
