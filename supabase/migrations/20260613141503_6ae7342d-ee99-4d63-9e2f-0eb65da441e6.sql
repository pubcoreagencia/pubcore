
-- ============ Projects ============
CREATE TABLE IF NOT EXISTS public.disco_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  artist text,
  company text,
  cover_path text,
  status text NOT NULL DEFAULT 'active',
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disco_projects TO authenticated;
GRANT ALL ON public.disco_projects TO service_role;
ALTER TABLE public.disco_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY disco_projects_member_select ON public.disco_projects FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_projects_member_insert ON public.disco_projects FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_projects_member_update ON public.disco_projects FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_projects_member_delete ON public.disco_projects FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE TRIGGER disco_projects_set_updated_at BEFORE UPDATE ON public.disco_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Tracks ============
CREATE TABLE IF NOT EXISTS public.disco_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.disco_projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  artist text,
  status text NOT NULL DEFAULT 'ideia',
  bpm integer,
  music_key text,
  genre text,
  responsible text,
  notes text,
  lyrics text,
  cover_path text,
  lyrics_storage_path text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disco_tracks TO authenticated;
GRANT ALL ON public.disco_tracks TO service_role;
ALTER TABLE public.disco_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY disco_tracks_member_select ON public.disco_tracks FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_tracks_member_insert ON public.disco_tracks FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_tracks_member_update ON public.disco_tracks FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_tracks_member_delete ON public.disco_tracks FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE INDEX disco_tracks_ws_idx ON public.disco_tracks(workspace_id, project_id);
CREATE TRIGGER disco_tracks_set_updated_at BEFORE UPDATE ON public.disco_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Versions ============
CREATE TABLE IF NOT EXISTS public.disco_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.disco_tracks(id) ON DELETE CASCADE,
  label text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  duration_ms integer,
  position integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disco_versions TO authenticated;
GRANT ALL ON public.disco_versions TO service_role;
ALTER TABLE public.disco_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY disco_versions_member_select ON public.disco_versions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_versions_member_insert ON public.disco_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_versions_member_update ON public.disco_versions FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_versions_member_delete ON public.disco_versions FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE INDEX disco_versions_track_idx ON public.disco_versions(track_id, position);

-- ============ Comments ============
CREATE TABLE IF NOT EXISTS public.disco_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.disco_tracks(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.disco_versions(id) ON DELETE SET NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disco_comments TO authenticated;
GRANT ALL ON public.disco_comments TO service_role;
ALTER TABLE public.disco_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY disco_comments_member_select ON public.disco_comments FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_comments_member_insert ON public.disco_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_comments_author_update ON public.disco_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'))
  WITH CHECK (author_id = auth.uid() OR public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE POLICY disco_comments_author_delete ON public.disco_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(),'master'));
CREATE INDEX disco_comments_track_idx ON public.disco_comments(track_id, created_at DESC);

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.disco_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.disco_tracks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.disco_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.disco_comments;
ALTER TABLE public.disco_projects REPLICA IDENTITY FULL;
ALTER TABLE public.disco_tracks REPLICA IDENTITY FULL;
ALTER TABLE public.disco_versions REPLICA IDENTITY FULL;
ALTER TABLE public.disco_comments REPLICA IDENTITY FULL;
