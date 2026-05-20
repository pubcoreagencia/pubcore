CREATE TABLE public.sticky_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  owner_email text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'yellow',
  tag text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select ON public.sticky_notes FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_insert ON public.sticky_notes FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_update ON public.sticky_notes FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_delete ON public.sticky_notes FOR DELETE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER sticky_notes_set_updated_at
BEFORE UPDATE ON public.sticky_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_sticky_notes_ws ON public.sticky_notes(workspace_id, position);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sticky_notes;
ALTER TABLE public.sticky_notes REPLICA IDENTITY FULL;