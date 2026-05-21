
-- Add parent_id to support subtasks (self-referential)
ALTER TABLE public.checklist_tasks
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.checklist_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_checklist_tasks_parent_id ON public.checklist_tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_workspace_parent ON public.checklist_tasks(workspace_id, parent_id);
