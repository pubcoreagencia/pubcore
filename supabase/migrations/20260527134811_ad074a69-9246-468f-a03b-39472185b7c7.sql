
-- 1) Extend checklist_tasks to support kanban fields
ALTER TABLE public.checklist_tasks
  ADD COLUMN IF NOT EXISTS funnel_id uuid,
  ADD COLUMN IF NOT EXISTS column_id uuid,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS legacy_checklist jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_checklist_tasks_ws_funnel ON public.checklist_tasks(workspace_id, funnel_id);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_column ON public.checklist_tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_parent ON public.checklist_tasks(parent_id);

-- 2) Normalize existing priorities to PT-BR set used by Kanban
UPDATE public.checklist_tasks SET priority = CASE
  WHEN lower(priority) IN ('low','baixa') THEN 'Baixa'
  WHEN lower(priority) IN ('medium','media','média') THEN 'Média'
  WHEN lower(priority) IN ('high','alta') THEN 'Alta'
  WHEN lower(priority) IN ('critical','critica','crítica') THEN 'Crítica'
  ELSE 'Média'
END
WHERE priority NOT IN ('Baixa','Média','Alta','Crítica');

-- 3) Migrate kanban_cards into checklist_tasks (preserve IDs so kanban_attachments still link)
INSERT INTO public.checklist_tasks (
  id, workspace_id, user_id, owner_email, company, title,
  status, priority, notes, position, parent_id,
  funnel_id, column_id, description, due_date, legacy_checklist,
  created_at, updated_at, done_at
)
SELECT
  c.id, c.workspace_id, c.user_id,
  COALESCE(p.email, 'unknown@pubcore.local'),
  c.company, c.title,
  CASE WHEN c.status = 'done' OR c.column_name ILIKE '%conclu%' OR c.column_name ILIKE '%done%' THEN 'done' ELSE 'pending' END,
  CASE
    WHEN c.priority IN ('Baixa','Média','Alta','Crítica') THEN c.priority
    ELSE 'Média'
  END,
  c.notes, COALESCE(c.position, 0), NULL,
  c.funnel_id, c.column_id, c.description, c.due_date,
  COALESCE(c.checklist, '[]'::jsonb),
  COALESCE(c.created_at, now()),
  COALESCE(c.updated_at, now()),
  CASE WHEN c.status = 'done' OR c.column_name ILIKE '%conclu%' OR c.column_name ILIKE '%done%' THEN COALESCE(c.updated_at, now()) ELSE NULL END
FROM public.kanban_cards c
LEFT JOIN public.profiles p ON p.id = c.user_id
WHERE NOT EXISTS (SELECT 1 FROM public.checklist_tasks t WHERE t.id = c.id);

-- 4) Archive old kanban_cards table as backup (don't drop, keep data safe)
ALTER TABLE public.kanban_cards RENAME TO kanban_cards_archive;
