
DROP POLICY IF EXISTS kanban_att_select ON storage.objects;
DROP POLICY IF EXISTS kanban_att_insert ON storage.objects;
DROP POLICY IF EXISTS kanban_att_update ON storage.objects;
DROP POLICY IF EXISTS kanban_att_delete ON storage.objects;

CREATE POLICY kanban_att_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kanban-attachments'
  AND (
    public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    OR public.has_app_role(auth.uid(), 'master'::public.app_role)
  )
);

CREATE POLICY kanban_att_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kanban-attachments'
  AND (
    public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    OR public.has_app_role(auth.uid(), 'master'::public.app_role)
  )
);

CREATE POLICY kanban_att_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'kanban-attachments'
  AND (
    public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    OR public.has_app_role(auth.uid(), 'master'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'kanban-attachments'
  AND (
    public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    OR public.has_app_role(auth.uid(), 'master'::public.app_role)
  )
);

CREATE POLICY kanban_att_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'kanban-attachments'
  AND (
    public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    OR public.has_app_role(auth.uid(), 'master'::public.app_role)
  )
);
