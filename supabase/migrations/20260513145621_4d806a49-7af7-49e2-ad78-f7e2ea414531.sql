-- Audit log for operational events (deletions, etc.)
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  owner_email text NOT NULL,
  user_name text,
  entity_type text NOT NULL, -- 'checklist_task' | 'kanban_card' | 'kanban_column' | 'calendar_event' | 'crm_lead' | 'ponto_session'
  entity_id uuid,
  action text NOT NULL,      -- 'deleted' (extensible: 'created', 'completed', etc.)
  title text,
  company text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX activity_log_user_created_idx ON public.activity_log(user_id, created_at DESC);
CREATE INDEX activity_log_entity_idx ON public.activity_log(entity_type, action);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_log_select ON public.activity_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY activity_log_insert ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY activity_log_delete ON public.activity_log
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;