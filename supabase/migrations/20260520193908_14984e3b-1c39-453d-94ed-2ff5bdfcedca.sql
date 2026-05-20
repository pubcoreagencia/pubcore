
CREATE TABLE public.gratitude_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  owner_email text NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  gratitude text NOT NULL DEFAULT '',
  objectives text NOT NULL DEFAULT '',
  mission text NOT NULL DEFAULT '',
  dreams text NOT NULL DEFAULT '',
  reflection text NOT NULL DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

ALTER TABLE public.gratitude_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select ON public.gratitude_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_insert ON public.gratitude_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role)));
CREATE POLICY ws_update ON public.gratitude_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY ws_delete ON public.gratitude_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_app_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER gratitude_entries_set_updated_at
  BEFORE UPDATE ON public.gratitude_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_gratitude_entries_user_date ON public.gratitude_entries (user_id, entry_date DESC);
