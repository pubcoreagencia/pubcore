
CREATE TABLE public.checklist_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);
CREATE INDEX idx_checklist_companies_ws ON public.checklist_companies(workspace_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_companies TO authenticated;
GRANT ALL ON public.checklist_companies TO service_role;

ALTER TABLE public.checklist_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view companies" ON public.checklist_companies
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));

CREATE POLICY "admins can insert companies" ON public.checklist_companies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));

CREATE POLICY "admins can update companies" ON public.checklist_companies
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));

CREATE POLICY "admins can delete companies" ON public.checklist_companies
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER checklist_companies_updated_at
  BEFORE UPDATE ON public.checklist_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: rename company string across related tables when name changes
CREATE OR REPLACE FUNCTION public.rename_checklist_company(_workspace_id uuid, _old_name text, _new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  UPDATE public.checklist_tasks SET company = _new_name
    WHERE workspace_id = _workspace_id AND company = _old_name;
  UPDATE public.checklist_daily_completions SET company = _new_name
    WHERE workspace_id = _workspace_id AND company = _old_name;
END;
$$;

-- Helper: cascade-delete tasks + history when a company is removed
CREATE OR REPLACE FUNCTION public.delete_checklist_company_cascade(_workspace_id uuid, _name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  DELETE FROM public.checklist_tasks
    WHERE workspace_id = _workspace_id AND company = _name;
  DELETE FROM public.checklist_daily_completions
    WHERE workspace_id = _workspace_id AND company = _name;
  DELETE FROM public.checklist_companies
    WHERE workspace_id = _workspace_id AND name = _name;
END;
$$;
