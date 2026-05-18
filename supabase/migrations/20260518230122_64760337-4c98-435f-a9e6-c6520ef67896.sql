
DROP POLICY IF EXISTS members_insert ON public.workspace_members;
CREATE POLICY members_insert ON public.workspace_members
FOR INSERT TO authenticated
WITH CHECK (
  public.is_workspace_admin(workspace_id, auth.uid())
  OR public.has_app_role(auth.uid(), 'master'::app_role)
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  )
);
