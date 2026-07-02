CREATE TABLE public.completion_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  executions JSONB NOT NULL DEFAULT '[]'::jsonb,
  bottlenecks TEXT NOT NULL DEFAULT '',
  achievements TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX completion_reports_user_ws_date_idx ON public.completion_reports (user_id, workspace_id, report_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.completion_reports TO authenticated;
GRANT ALL ON public.completion_reports TO service_role;

ALTER TABLE public.completion_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own completion reports"
  ON public.completion_reports FOR ALL
  USING (auth.uid() = user_id AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER completion_reports_set_updated_at
  BEFORE UPDATE ON public.completion_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();