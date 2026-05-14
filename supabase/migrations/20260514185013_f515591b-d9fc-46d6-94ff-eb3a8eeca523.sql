-- ========== stock_companies ==========
CREATE TABLE public.stock_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL DEFAULT 'oklch(0.78 0.15 75)',
  icon text NOT NULL DEFAULT 'Building2',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
ALTER TABLE public.stock_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select ON public.stock_companies FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE POLICY ws_insert ON public.stock_companies FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE POLICY ws_update ON public.stock_companies FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE POLICY ws_delete ON public.stock_companies FOR DELETE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE TRIGGER trg_stock_companies_updated BEFORE UPDATE ON public.stock_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== stock_groups ==========
CREATE TABLE public.stock_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'oklch(0.78 0.15 75)',
  icon text NOT NULL DEFAULT 'Folder',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select ON public.stock_groups FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE POLICY ws_insert ON public.stock_groups FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE POLICY ws_update ON public.stock_groups FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE POLICY ws_delete ON public.stock_groups FOR DELETE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE TRIGGER trg_stock_groups_updated BEFORE UPDATE ON public.stock_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_stock_groups_company ON public.stock_groups(workspace_id, company_id);

-- ========== stock_field_defs ==========
CREATE TABLE public.stock_field_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, key)
);
ALTER TABLE public.stock_field_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select ON public.stock_field_defs FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE POLICY ws_insert ON public.stock_field_defs FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE POLICY ws_update ON public.stock_field_defs FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE POLICY ws_delete ON public.stock_field_defs FOR DELETE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(), 'master'));
CREATE TRIGGER trg_stock_field_defs_updated BEFORE UPDATE ON public.stock_field_defs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_stock_field_defs_company ON public.stock_field_defs(workspace_id, company_id);

-- ========== alter existing tables ==========
ALTER TABLE public.stock_categories
  ADD COLUMN company_id uuid,
  ADD COLUMN group_id uuid;

ALTER TABLE public.stock_items
  ADD COLUMN company_id uuid,
  ADD COLUMN group_id uuid,
  ADD COLUMN category_id uuid,
  ADD COLUMN data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN position integer NOT NULL DEFAULT 0;

ALTER TABLE public.stock_movements
  ADD COLUMN company_id uuid;

CREATE INDEX idx_stock_items_company ON public.stock_items(workspace_id, company_id);
CREATE INDEX idx_stock_categories_company ON public.stock_categories(workspace_id, company_id);
CREATE INDEX idx_stock_movements_company ON public.stock_movements(workspace_id, company_id);

-- ========== realtime ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_companies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_field_defs;