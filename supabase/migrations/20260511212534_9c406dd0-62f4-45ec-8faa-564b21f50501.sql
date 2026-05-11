
-- 1) Add user_id to existing tables
ALTER TABLE public.checklist_tasks ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.ponto_sessions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.ponto_session_tasks ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_checklist_tasks_user ON public.checklist_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_ponto_sessions_user ON public.ponto_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ponto_session_tasks_user ON public.ponto_session_tasks(user_id);

-- 2) Replace permissive policies with user-scoped ones
DROP POLICY IF EXISTS checklist_tasks_all_select ON public.checklist_tasks;
DROP POLICY IF EXISTS checklist_tasks_all_insert ON public.checklist_tasks;
DROP POLICY IF EXISTS checklist_tasks_all_update ON public.checklist_tasks;
DROP POLICY IF EXISTS checklist_tasks_all_delete ON public.checklist_tasks;

CREATE POLICY checklist_tasks_select ON public.checklist_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY checklist_tasks_insert ON public.checklist_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY checklist_tasks_update ON public.checklist_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY checklist_tasks_delete ON public.checklist_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ponto_sessions_all_select ON public.ponto_sessions;
DROP POLICY IF EXISTS ponto_sessions_all_insert ON public.ponto_sessions;
DROP POLICY IF EXISTS ponto_sessions_all_update ON public.ponto_sessions;
DROP POLICY IF EXISTS ponto_sessions_all_delete ON public.ponto_sessions;

CREATE POLICY ponto_sessions_select ON public.ponto_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ponto_sessions_insert ON public.ponto_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ponto_sessions_update ON public.ponto_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ponto_sessions_delete ON public.ponto_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ponto_session_tasks_all_select ON public.ponto_session_tasks;
DROP POLICY IF EXISTS ponto_session_tasks_all_insert ON public.ponto_session_tasks;
DROP POLICY IF EXISTS ponto_session_tasks_all_update ON public.ponto_session_tasks;
DROP POLICY IF EXISTS ponto_session_tasks_all_delete ON public.ponto_session_tasks;

CREATE POLICY ponto_session_tasks_select ON public.ponto_session_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ponto_session_tasks_insert ON public.ponto_session_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ponto_session_tasks_update ON public.ponto_session_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ponto_session_tasks_delete ON public.ponto_session_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3) Profiles table (display name) auto-created on signup
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  role text DEFAULT 'Executivo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) Kanban
CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  assignee text,
  priority text NOT NULL DEFAULT 'medium',
  column_name text NOT NULL DEFAULT 'Backlog',
  position integer NOT NULL DEFAULT 0,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kanban_user ON public.kanban_cards(user_id);
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY kanban_select ON public.kanban_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY kanban_insert ON public.kanban_cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY kanban_update ON public.kanban_cards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY kanban_delete ON public.kanban_cards FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER kanban_set_updated BEFORE UPDATE ON public.kanban_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Calendar events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'Reunião',
  company text,
  event_date date NOT NULL,
  event_time text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON public.calendar_events(user_id, event_date);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY calendar_select ON public.calendar_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY calendar_insert ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY calendar_update ON public.calendar_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY calendar_delete ON public.calendar_events FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER calendar_set_updated BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) CRM leads
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  company text,
  owner text,
  stage text NOT NULL DEFAULT 'Novo',
  value numeric NOT NULL DEFAULT 0,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_user ON public.crm_leads(user_id);
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_select ON public.crm_leads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY crm_insert ON public.crm_leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY crm_update ON public.crm_leads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY crm_delete ON public.crm_leads FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER crm_set_updated BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) Updated_at triggers for existing tables (if missing)
DROP TRIGGER IF EXISTS checklist_tasks_set_updated ON public.checklist_tasks;
CREATE TRIGGER checklist_tasks_set_updated BEFORE UPDATE ON public.checklist_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS ponto_sessions_set_updated ON public.ponto_sessions;
CREATE TRIGGER ponto_sessions_set_updated BEFORE UPDATE ON public.ponto_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
