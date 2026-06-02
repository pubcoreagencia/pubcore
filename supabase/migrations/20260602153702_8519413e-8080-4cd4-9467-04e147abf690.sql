CREATE TABLE public.checklist_daily_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID,
  owner_email TEXT NOT NULL,
  user_name TEXT,
  task_id UUID,
  task_title TEXT NOT NULL,
  company TEXT NOT NULL,
  completed_on DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, task_id, completed_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_daily_completions TO authenticated;
GRANT ALL ON public.checklist_daily_completions TO service_role;

ALTER TABLE public.checklist_daily_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select ON public.checklist_daily_completions FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_insert ON public.checklist_daily_completions FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_update ON public.checklist_daily_completions FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_delete ON public.checklist_daily_completions FOR DELETE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));

CREATE INDEX idx_checklist_daily_completions_ws_date
  ON public.checklist_daily_completions (workspace_id, completed_on DESC);
