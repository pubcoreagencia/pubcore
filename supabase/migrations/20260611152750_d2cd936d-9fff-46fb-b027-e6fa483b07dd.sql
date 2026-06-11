
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS parent_card_id uuid NULL REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flow_x double precision NULL,
  ADD COLUMN IF NOT EXISTS flow_y double precision NULL,
  ADD COLUMN IF NOT EXISTS flow_collapsed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_kanban_cards_parent ON public.kanban_cards(parent_card_id);

CREATE TABLE IF NOT EXISTS public.kanban_card_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  funnel_id uuid NOT NULL,
  from_card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  to_card_id   uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  label text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_card_id, to_card_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_card_links TO authenticated;
GRANT ALL ON public.kanban_card_links TO service_role;

ALTER TABLE public.kanban_card_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select ON public.kanban_card_links FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_insert ON public.kanban_card_links FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_update ON public.kanban_card_links FOR UPDATE
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_delete ON public.kanban_card_links FOR DELETE
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));

CREATE INDEX IF NOT EXISTS idx_kanban_card_links_funnel ON public.kanban_card_links(funnel_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_links_from ON public.kanban_card_links(from_card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_links_to ON public.kanban_card_links(to_card_id);
