
-- Enums
DO $$ BEGIN
  CREATE TYPE public.shared_item_type AS ENUM (
    'checklist_task','kanban_card','kanban_funnel','file','folder','note','calendar_event'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shared_permission AS ENUM ('view','comment','edit','duplicate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shared_status AS ENUM ('active','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== shared_items =====
CREATE TABLE public.shared_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type public.shared_item_type NOT NULL,
  item_id uuid NOT NULL,
  source_workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  target_workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  shared_by_user_id uuid NOT NULL,
  permission_level public.shared_permission NOT NULL DEFAULT 'view',
  status public.shared_status NOT NULL DEFAULT 'active',
  item_title text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_type, item_id, target_workspace_id)
);
CREATE INDEX idx_shared_items_target ON public.shared_items(target_workspace_id, status);
CREATE INDEX idx_shared_items_source ON public.shared_items(source_workspace_id, status);
CREATE INDEX idx_shared_items_item   ON public.shared_items(item_type, item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_items TO authenticated;
GRANT ALL ON public.shared_items TO service_role;
ALTER TABLE public.shared_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_items select members" ON public.shared_items
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(source_workspace_id, auth.uid())
    OR public.is_workspace_member(target_workspace_id, auth.uid())
    OR public.has_app_role(auth.uid(), 'master'::app_role)
  );

CREATE POLICY "shared_items insert from source" ON public.shared_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(source_workspace_id, auth.uid())
    AND shared_by_user_id = auth.uid()
  );

CREATE POLICY "shared_items update by owner/admin" ON public.shared_items
  FOR UPDATE TO authenticated
  USING (
    shared_by_user_id = auth.uid()
    OR public.is_workspace_admin(source_workspace_id, auth.uid())
    OR public.has_app_role(auth.uid(), 'master'::app_role)
  );

CREATE POLICY "shared_items delete by owner/admin" ON public.shared_items
  FOR DELETE TO authenticated
  USING (
    shared_by_user_id = auth.uid()
    OR public.is_workspace_admin(source_workspace_id, auth.uid())
    OR public.has_app_role(auth.uid(), 'master'::app_role)
  );

CREATE TRIGGER shared_items_set_updated_at
  BEFORE UPDATE ON public.shared_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== shared_item_comments =====
CREATE TABLE public.shared_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_item_id uuid NOT NULL REFERENCES public.shared_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shared_comments_item ON public.shared_item_comments(shared_item_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.shared_item_comments TO authenticated;
GRANT ALL ON public.shared_item_comments TO service_role;
ALTER TABLE public.shared_item_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_comments select" ON public.shared_item_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shared_items s
    WHERE s.id = shared_item_id
      AND (public.is_workspace_member(s.source_workspace_id, auth.uid())
           OR public.is_workspace_member(s.target_workspace_id, auth.uid())
           OR public.has_app_role(auth.uid(), 'master'::app_role))
  ));

CREATE POLICY "shared_comments insert" ON public.shared_item_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.shared_items s
      WHERE s.id = shared_item_id AND s.status = 'active'
        AND (public.is_workspace_member(s.source_workspace_id, auth.uid())
             OR public.is_workspace_member(s.target_workspace_id, auth.uid()))
    )
  );

CREATE POLICY "shared_comments delete own" ON public.shared_item_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_app_role(auth.uid(), 'master'::app_role));

-- ===== shared_item_activity =====
CREATE TABLE public.shared_item_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_item_id uuid NOT NULL REFERENCES public.shared_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shared_activity_item ON public.shared_item_activity(shared_item_id, created_at);
GRANT SELECT, INSERT ON public.shared_item_activity TO authenticated;
GRANT ALL ON public.shared_item_activity TO service_role;
ALTER TABLE public.shared_item_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_activity select" ON public.shared_item_activity
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shared_items s
    WHERE s.id = shared_item_id
      AND (public.is_workspace_member(s.source_workspace_id, auth.uid())
           OR public.is_workspace_member(s.target_workspace_id, auth.uid())
           OR public.has_app_role(auth.uid(), 'master'::app_role))
  ));

CREATE POLICY "shared_activity insert own" ON public.shared_item_activity
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ===== helper: cross-workspace access check =====
CREATE OR REPLACE FUNCTION public.has_shared_access(
  _item_type public.shared_item_type,
  _item_id uuid,
  _min_permission public.shared_permission DEFAULT 'view'
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_items s
    JOIN public.workspace_members m ON m.workspace_id = s.target_workspace_id
    WHERE s.item_type = _item_type
      AND s.item_id = _item_id
      AND s.status = 'active'
      AND m.user_id = auth.uid()
      AND CASE _min_permission
        WHEN 'view' THEN TRUE
        WHEN 'comment' THEN s.permission_level IN ('comment','edit','duplicate')
        WHEN 'edit' THEN s.permission_level = 'edit'
        WHEN 'duplicate' THEN s.permission_level IN ('edit','duplicate')
      END
  );
$$;

-- ===== Extend RLS on shared resource tables (read + edit via shared_items) =====
-- checklist_tasks
CREATE POLICY "shared read checklist_tasks" ON public.checklist_tasks
  FOR SELECT TO authenticated
  USING (public.has_shared_access('checklist_task'::public.shared_item_type, id, 'view'::public.shared_permission));
CREATE POLICY "shared edit checklist_tasks" ON public.checklist_tasks
  FOR UPDATE TO authenticated
  USING (public.has_shared_access('checklist_task'::public.shared_item_type, id, 'edit'::public.shared_permission))
  WITH CHECK (public.has_shared_access('checklist_task'::public.shared_item_type, id, 'edit'::public.shared_permission));

-- kanban_cards
CREATE POLICY "shared read kanban_cards" ON public.kanban_cards
  FOR SELECT TO authenticated
  USING (public.has_shared_access('kanban_card'::public.shared_item_type, id, 'view'::public.shared_permission));
CREATE POLICY "shared edit kanban_cards" ON public.kanban_cards
  FOR UPDATE TO authenticated
  USING (public.has_shared_access('kanban_card'::public.shared_item_type, id, 'edit'::public.shared_permission))
  WITH CHECK (public.has_shared_access('kanban_card'::public.shared_item_type, id, 'edit'::public.shared_permission));

-- kanban_funnels
CREATE POLICY "shared read kanban_funnels" ON public.kanban_funnels
  FOR SELECT TO authenticated
  USING (public.has_shared_access('kanban_funnel'::public.shared_item_type, id, 'view'::public.shared_permission));
CREATE POLICY "shared edit kanban_funnels" ON public.kanban_funnels
  FOR UPDATE TO authenticated
  USING (public.has_shared_access('kanban_funnel'::public.shared_item_type, id, 'edit'::public.shared_permission))
  WITH CHECK (public.has_shared_access('kanban_funnel'::public.shared_item_type, id, 'edit'::public.shared_permission));

-- files_items
CREATE POLICY "shared read files_items" ON public.files_items
  FOR SELECT TO authenticated
  USING (public.has_shared_access('file'::public.shared_item_type, id, 'view'::public.shared_permission));
CREATE POLICY "shared edit files_items" ON public.files_items
  FOR UPDATE TO authenticated
  USING (public.has_shared_access('file'::public.shared_item_type, id, 'edit'::public.shared_permission))
  WITH CHECK (public.has_shared_access('file'::public.shared_item_type, id, 'edit'::public.shared_permission));

-- files_folders
CREATE POLICY "shared read files_folders" ON public.files_folders
  FOR SELECT TO authenticated
  USING (public.has_shared_access('folder'::public.shared_item_type, id, 'view'::public.shared_permission));
CREATE POLICY "shared edit files_folders" ON public.files_folders
  FOR UPDATE TO authenticated
  USING (public.has_shared_access('folder'::public.shared_item_type, id, 'edit'::public.shared_permission))
  WITH CHECK (public.has_shared_access('folder'::public.shared_item_type, id, 'edit'::public.shared_permission));

-- notes
CREATE POLICY "shared read notes" ON public.notes
  FOR SELECT TO authenticated
  USING (public.has_shared_access('note'::public.shared_item_type, id, 'view'::public.shared_permission));
CREATE POLICY "shared edit notes" ON public.notes
  FOR UPDATE TO authenticated
  USING (public.has_shared_access('note'::public.shared_item_type, id, 'edit'::public.shared_permission))
  WITH CHECK (public.has_shared_access('note'::public.shared_item_type, id, 'edit'::public.shared_permission));

-- calendar_events
CREATE POLICY "shared read calendar_events" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (public.has_shared_access('calendar_event'::public.shared_item_type, id, 'view'::public.shared_permission));
CREATE POLICY "shared edit calendar_events" ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (public.has_shared_access('calendar_event'::public.shared_item_type, id, 'edit'::public.shared_permission))
  WITH CHECK (public.has_shared_access('calendar_event'::public.shared_item_type, id, 'edit'::public.shared_permission));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_item_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_item_activity;
