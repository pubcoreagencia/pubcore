
-- Finance module tables

CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  color text NOT NULL DEFAULT 'oklch(0.78 0.15 75)',
  icon text NOT NULL DEFAULT 'Tag',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  category_id uuid,
  category_name text,
  company text,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','weekly','monthly','yearly')),
  responsible text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fixed','variable')),
  amount_monthly numeric(14,2) NOT NULL DEFAULT 0,
  company text,
  category text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  company text NOT NULL DEFAULT 'Pub 3D',
  cost numeric(14,2) NOT NULL DEFAULT 0,
  price numeric(14,2) NOT NULL DEFAULT 0,
  avg_demand_monthly numeric(14,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  category text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_tx_ws_date ON public.finance_transactions(workspace_id, occurred_on DESC);
CREATE INDEX idx_fin_costs_ws ON public.finance_costs(workspace_id);
CREATE INDEX idx_fin_products_ws ON public.finance_products(workspace_id);
CREATE INDEX idx_fin_cat_ws ON public.finance_categories(workspace_id);

-- RLS
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_products ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY['finance_categories','finance_transactions','finance_costs','finance_products']) LOOP
    EXECUTE format($p$
      CREATE POLICY ws_select ON public.%I FOR SELECT TO authenticated
        USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(),'master'));
      CREATE POLICY ws_insert ON public.%I FOR INSERT TO authenticated
        WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(),'master'));
      CREATE POLICY ws_update ON public.%I FOR UPDATE TO authenticated
        USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(),'master'))
        WITH CHECK (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(),'master'));
      CREATE POLICY ws_delete ON public.%I FOR DELETE TO authenticated
        USING (is_workspace_member(workspace_id, auth.uid()) OR has_app_role(auth.uid(),'master'));
    $p$, t, t, t, t);
  END LOOP;
END $$;

-- updated_at triggers
CREATE TRIGGER trg_fin_cat_updated BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fin_tx_updated BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fin_costs_updated BEFORE UPDATE ON public.finance_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fin_products_updated BEFORE UPDATE ON public.finance_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_costs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_products;
