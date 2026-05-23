
-- 1) Storage UPDATE policy for kanban-attachments
CREATE POLICY "kanban_att_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kanban-attachments'
  AND public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
)
WITH CHECK (
  bucket_id = 'kanban-attachments'
  AND public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- 2) Realtime channel authorization
-- Require channel topics formatted as 'ws:<workspace_uuid>[:...]' and verify membership.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'ws:%'
  AND public.is_workspace_member(
    NULLIF(split_part(split_part(realtime.topic(), ':', 2), ':', 1), '')::uuid,
    auth.uid()
  )
);

CREATE POLICY "Workspace members can send realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'ws:%'
  AND public.is_workspace_member(
    NULLIF(split_part(split_part(realtime.topic(), ':', 2), ':', 1), '')::uuid,
    auth.uid()
  )
);
