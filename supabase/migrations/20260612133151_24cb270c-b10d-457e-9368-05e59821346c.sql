-- 1) kanban_card_links: scope policies to authenticated only
DROP POLICY IF EXISTS ws_select ON public.kanban_card_links;
DROP POLICY IF EXISTS ws_insert ON public.kanban_card_links;
DROP POLICY IF EXISTS ws_update ON public.kanban_card_links;
DROP POLICY IF EXISTS ws_delete ON public.kanban_card_links;

CREATE POLICY ws_select ON public.kanban_card_links FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_insert ON public.kanban_card_links FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_update ON public.kanban_card_links FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_delete ON public.kanban_card_links FOR DELETE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));

-- 2) ponto_session_edits: restrict DELETE to workspace admins/master; keep edits immutable (no UPDATE policy)
DROP POLICY IF EXISTS "only admins or master can delete edits" ON public.ponto_session_edits;
CREATE POLICY "only admins or master can delete edits" ON public.ponto_session_edits FOR DELETE TO authenticated
  USING (is_workspace_admin(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));