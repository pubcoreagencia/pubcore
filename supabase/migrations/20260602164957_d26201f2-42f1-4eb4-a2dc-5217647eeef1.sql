
-- Separa fisicamente os cards do Kanban da tabela compartilhada checklist_tasks.
-- 1) Cria nova tabela kanban_cards (mesmas colunas relevantes)
-- 2) Migra dados (linhas com funnel_id != NULL)
-- 3) Remove essas linhas de checklist_tasks
-- 4) IDs preservados para manter compatibilidade com kanban_attachments.card_id

CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid,
  owner_email text NOT NULL,
  funnel_id uuid,
  column_id uuid,
  title text NOT NULL,
  description text,
  company text NOT NULL,
  priority text NOT NULL DEFAULT 'Média',
  assignee text,
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  notes text,
  position integer NOT NULL DEFAULT 0,
  legacy_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_ws ON public.kanban_cards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_funnel ON public.kanban_cards(funnel_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_column ON public.kanban_cards(column_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_ws_funnel ON public.kanban_cards(workspace_id, funnel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_cards TO authenticated;
GRANT ALL ON public.kanban_cards TO service_role;

ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select ON public.kanban_cards FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_insert ON public.kanban_cards FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_update ON public.kanban_cards FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY ws_delete ON public.kanban_cards FOR DELETE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_cards;

-- Trigger de updated_at
CREATE TRIGGER kanban_cards_set_updated_at
  BEFORE UPDATE ON public.kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- MIGRAÇÃO DE DADOS -----
-- Move TODAS as linhas com funnel_id (= cards do Kanban) para a nova tabela,
-- preservando os IDs (necessário para kanban_attachments.card_id).
INSERT INTO public.kanban_cards (
  id, workspace_id, user_id, owner_email, funnel_id, column_id,
  title, description, company, priority, assignee, status,
  due_date, notes, position, legacy_checklist, created_at, updated_at
)
SELECT
  id, workspace_id, user_id, owner_email, funnel_id, column_id,
  title, COALESCE(description, NULL), company,
  CASE WHEN priority IN ('Baixa','Média','Alta','Crítica') THEN priority ELSE 'Média' END,
  assignee, COALESCE(status, 'pending'),
  due_date, notes, COALESCE(position, 0),
  COALESCE(legacy_checklist, '[]'::jsonb),
  created_at, updated_at
FROM public.checklist_tasks
WHERE funnel_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Remove essas linhas do checklist (agora vivem só em kanban_cards)
DELETE FROM public.checklist_tasks WHERE funnel_id IS NOT NULL;
