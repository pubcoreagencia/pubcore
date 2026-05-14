
-- Cleanup orphan rows (no user_id) before backfill
DELETE FROM public.checklist_tasks WHERE user_id IS NULL;
DELETE FROM public.ponto_sessions WHERE user_id IS NULL;
DELETE FROM public.ponto_session_tasks WHERE user_id IS NULL;

-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('master','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.workspace_role AS ENUM ('admin','member'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ WORKSPACES ============
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_app_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id);
$$;
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id AND role = 'admin');
$$;

-- ============ RLS workspaces / members / roles ============
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
CREATE POLICY workspaces_select ON public.workspaces FOR SELECT TO authenticated
USING (public.is_workspace_member(id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
DROP POLICY IF EXISTS workspaces_insert ON public.workspaces;
CREATE POLICY workspaces_insert ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS workspaces_update ON public.workspaces;
CREATE POLICY workspaces_update ON public.workspaces FOR UPDATE TO authenticated
USING (public.is_workspace_admin(id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
DROP POLICY IF EXISTS workspaces_delete ON public.workspaces;
CREATE POLICY workspaces_delete ON public.workspaces FOR DELETE TO authenticated
USING (auth.uid() = owner_id OR public.has_app_role(auth.uid(),'master'));

DROP POLICY IF EXISTS members_select ON public.workspace_members;
CREATE POLICY members_select ON public.workspace_members FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master') OR user_id = auth.uid());
DROP POLICY IF EXISTS members_insert ON public.workspace_members;
CREATE POLICY members_insert ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master') OR user_id = auth.uid());
DROP POLICY IF EXISTS members_update ON public.workspace_members;
CREATE POLICY members_update ON public.workspace_members FOR UPDATE TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
DROP POLICY IF EXISTS members_delete ON public.workspace_members;
CREATE POLICY members_delete ON public.workspace_members FOR DELETE TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));

DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_app_role(auth.uid(),'master'));
DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
CREATE POLICY user_roles_insert ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_app_role(auth.uid(),'master'));
DROP POLICY IF EXISTS user_roles_delete ON public.user_roles;
CREATE POLICY user_roles_delete ON public.user_roles FOR DELETE TO authenticated
USING (public.has_app_role(auth.uid(),'master'));

-- ============ ADD workspace_id ============
ALTER TABLE public.notes              ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.note_categories    ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.checklist_tasks    ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.kanban_columns     ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.kanban_cards       ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.crm_leads          ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.calendar_events    ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.ponto_sessions     ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.ponto_session_tasks ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.activity_log       ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- ============ BACKFILL ============
DO $$
DECLARE uid uuid; wsid uuid; uname text;
BEGIN
  FOR uid IN SELECT id FROM auth.users LOOP
    SELECT id INTO wsid FROM public.workspaces WHERE owner_id = uid LIMIT 1;
    IF wsid IS NULL THEN
      SELECT COALESCE(display_name, split_part(email,'@',1), 'Workspace') INTO uname FROM public.profiles WHERE id = uid;
      INSERT INTO public.workspaces (name, owner_id) VALUES (COALESCE(uname,'Workspace') || '''s Workspace', uid) RETURNING id INTO wsid;
      INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (wsid, uid, 'admin') ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (uid,'user') ON CONFLICT DO NOTHING;

    UPDATE public.notes              SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
    UPDATE public.note_categories    SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
    UPDATE public.checklist_tasks    SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
    UPDATE public.kanban_columns     SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
    UPDATE public.kanban_cards       SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
    UPDATE public.crm_leads          SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
    UPDATE public.calendar_events    SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
    UPDATE public.ponto_sessions     SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
    UPDATE public.ponto_session_tasks SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
    UPDATE public.activity_log       SET workspace_id = wsid WHERE user_id = uid AND workspace_id IS NULL;
  END LOOP;
END $$;

-- Delete leftover orphans where workspace_id is still null (no matching user)
DELETE FROM public.notes WHERE workspace_id IS NULL;
DELETE FROM public.note_categories WHERE workspace_id IS NULL;
DELETE FROM public.checklist_tasks WHERE workspace_id IS NULL;
DELETE FROM public.kanban_cards WHERE workspace_id IS NULL;
DELETE FROM public.kanban_columns WHERE workspace_id IS NULL;
DELETE FROM public.crm_leads WHERE workspace_id IS NULL;
DELETE FROM public.calendar_events WHERE workspace_id IS NULL;
DELETE FROM public.ponto_sessions WHERE workspace_id IS NULL;
DELETE FROM public.ponto_session_tasks WHERE workspace_id IS NULL;
DELETE FROM public.activity_log WHERE workspace_id IS NULL;

ALTER TABLE public.notes              ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.note_categories    ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.checklist_tasks    ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.kanban_columns     ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.kanban_cards       ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.crm_leads          ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.calendar_events    ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.ponto_sessions     ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.ponto_session_tasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.activity_log       ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notes_ws ON public.notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_note_categories_ws ON public.note_categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_ws ON public.checklist_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kanban_columns_ws ON public.kanban_columns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_ws ON public.kanban_cards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_ws ON public.crm_leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_ws ON public.calendar_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ponto_sessions_ws ON public.ponto_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ponto_session_tasks_ws ON public.ponto_session_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_ws ON public.activity_log(workspace_id);

-- Replace RLS on operational tables
DO $$
DECLARE t text; tables text[] := ARRAY['notes','note_categories','checklist_tasks','kanban_columns','kanban_cards','crm_leads','calendar_events','ponto_sessions','ponto_session_tasks','activity_log'];
DECLARE pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY ws_select ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),''master''))', t);
    EXECUTE format('CREATE POLICY ws_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),''master''))', t);
    EXECUTE format('CREATE POLICY ws_update ON public.%I FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),''master'')) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),''master''))', t);
    EXECUTE format('CREATE POLICY ws_delete ON public.%I FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),''master''))', t);
  END LOOP;
END $$;

-- Trigger for new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wsid uuid; uname text;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  uname := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Workspace');
  INSERT INTO public.workspaces (name, owner_id) VALUES (uname || '''s Workspace', NEW.id) RETURNING id INTO wsid;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (wsid, NEW.id, 'admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS workspaces_updated_at ON public.workspaces;
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Promote initial MASTER
DO $$ DECLARE master_uid uuid;
BEGIN
  SELECT id INTO master_uid FROM auth.users WHERE email = 'contato.pubcore@gmail.com' LIMIT 1;
  IF master_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (master_uid,'master') ON CONFLICT DO NOTHING;
  END IF;
END $$;
