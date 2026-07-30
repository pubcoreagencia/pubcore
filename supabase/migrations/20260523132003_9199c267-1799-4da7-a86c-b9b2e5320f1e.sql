
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
-- Disabled for local/new Supabase compatibility.
-- The app currently uses Realtime only via postgres_changes on public tables,
-- not private Broadcast/Presence channels that require realtime.messages RLS.
