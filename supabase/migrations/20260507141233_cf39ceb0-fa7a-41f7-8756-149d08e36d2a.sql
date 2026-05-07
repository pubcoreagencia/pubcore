
CREATE TABLE public.checklist_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  assignee TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  done_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_tasks ENABLE ROW LEVEL SECURITY;

-- App uses a lightweight mock auth (email only). Allow all operations; scoping happens client-side by owner_email.
CREATE POLICY "checklist_tasks_all_select" ON public.checklist_tasks FOR SELECT USING (true);
CREATE POLICY "checklist_tasks_all_insert" ON public.checklist_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "checklist_tasks_all_update" ON public.checklist_tasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "checklist_tasks_all_delete" ON public.checklist_tasks FOR DELETE USING (true);

CREATE INDEX idx_checklist_tasks_owner_company ON public.checklist_tasks(owner_email, company, position);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_checklist_tasks_updated
BEFORE UPDATE ON public.checklist_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.checklist_tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_tasks;
