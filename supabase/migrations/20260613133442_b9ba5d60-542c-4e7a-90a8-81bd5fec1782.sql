-- Folders
CREATE TABLE IF NOT EXISTS public.files_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.files_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  icon text,
  company text,
  favorite boolean NOT NULL DEFAULT false,
  pos_x integer NOT NULL DEFAULT 0,
  pos_y integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.files_folders TO authenticated;
GRANT ALL ON public.files_folders TO service_role;
ALTER TABLE public.files_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ff_select" ON public.files_folders FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY "ff_insert" ON public.files_folders FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY "ff_update" ON public.files_folders FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY "ff_delete" ON public.files_folders FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));

CREATE INDEX IF NOT EXISTS files_folders_ws_idx ON public.files_folders(workspace_id, parent_id);

CREATE TRIGGER files_folders_set_updated_at BEFORE UPDATE ON public.files_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.files_folders REPLICA IDENTITY FULL;

-- Items
CREATE TABLE IF NOT EXISTS public.files_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.files_folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  company text,
  category text,
  favorite boolean NOT NULL DEFAULT false,
  pos_x integer NOT NULL DEFAULT 0,
  pos_y integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.files_items TO authenticated;
GRANT ALL ON public.files_items TO service_role;
ALTER TABLE public.files_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fi_select" ON public.files_items FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY "fi_insert" ON public.files_items FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY "fi_update" ON public.files_items FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY "fi_delete" ON public.files_items FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));

CREATE INDEX IF NOT EXISTS files_items_ws_idx ON public.files_items(workspace_id, folder_id);

CREATE TRIGGER files_items_set_updated_at BEFORE UPDATE ON public.files_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.files_items REPLICA IDENTITY FULL;

-- Storage RLS for "files" bucket (bucket created via tool)
CREATE POLICY "files_obj_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'files' AND public.is_workspace_member(
    NULLIF(split_part(name,'/',1),'')::uuid, auth.uid()
  ));
CREATE POLICY "files_obj_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'files' AND public.is_workspace_member(
    NULLIF(split_part(name,'/',1),'')::uuid, auth.uid()
  ));
CREATE POLICY "files_obj_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'files' AND public.is_workspace_member(
    NULLIF(split_part(name,'/',1),'')::uuid, auth.uid()
  ));
CREATE POLICY "files_obj_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'files' AND public.is_workspace_member(
    NULLIF(split_part(name,'/',1),'')::uuid, auth.uid()
  ));