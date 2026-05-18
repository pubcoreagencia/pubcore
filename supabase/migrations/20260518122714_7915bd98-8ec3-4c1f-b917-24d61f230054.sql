
-- ============================================
-- KANBAN FUNNELS + ATTACHMENTS
-- ============================================

-- 1. FUNNELS table
CREATE TABLE IF NOT EXISTS public.kanban_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'oklch(0.72 0.16 220)',
  icon text NOT NULL DEFAULT 'Layers',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select ON public.kanban_funnels FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_insert ON public.kanban_funnels FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_update ON public.kanban_funnels FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_delete ON public.kanban_funnels FOR DELETE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER kanban_funnels_updated BEFORE UPDATE ON public.kanban_funnels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Add funnel_id to columns and cards
ALTER TABLE public.kanban_columns ADD COLUMN IF NOT EXISTS funnel_id uuid;
ALTER TABLE public.kanban_cards   ADD COLUMN IF NOT EXISTS funnel_id uuid;

-- 3. Backfill: create a "Geral" funnel per workspace that already has kanban data
DO $$
DECLARE
  ws record;
  fid uuid;
  any_owner uuid;
BEGIN
  FOR ws IN
    SELECT DISTINCT workspace_id FROM public.kanban_columns WHERE funnel_id IS NULL
    UNION
    SELECT DISTINCT workspace_id FROM public.kanban_cards WHERE funnel_id IS NULL
  LOOP
    SELECT owner_id INTO any_owner FROM public.workspaces WHERE id = ws.workspace_id;
    IF any_owner IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.kanban_funnels (workspace_id, user_id, name, position, icon, color)
    VALUES (ws.workspace_id, any_owner, 'Geral', 0, 'Layers', 'oklch(0.72 0.16 220)')
    RETURNING id INTO fid;

    UPDATE public.kanban_columns SET funnel_id = fid WHERE workspace_id = ws.workspace_id AND funnel_id IS NULL;
    UPDATE public.kanban_cards   SET funnel_id = fid WHERE workspace_id = ws.workspace_id AND funnel_id IS NULL;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_kanban_columns_funnel ON public.kanban_columns(funnel_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_funnel   ON public.kanban_cards(funnel_id);

-- 4. ATTACHMENTS table
CREATE TABLE IF NOT EXISTS public.kanban_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  card_id uuid NOT NULL,
  user_id uuid NOT NULL,
  uploader_name text,
  name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select ON public.kanban_attachments FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_insert ON public.kanban_attachments FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_update ON public.kanban_attachments FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_delete ON public.kanban_attachments FOR DELETE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));

CREATE INDEX IF NOT EXISTS idx_kanban_attachments_card ON public.kanban_attachments(card_id);

-- 5. STORAGE bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('kanban-attachments', 'kanban-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path layout = {workspace_id}/{card_id}/{filename}
CREATE POLICY "kanban_att_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kanban-attachments'
    AND is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "kanban_att_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kanban-attachments'
    AND is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "kanban_att_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'kanban-attachments'
    AND is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_funnels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_attachments;
