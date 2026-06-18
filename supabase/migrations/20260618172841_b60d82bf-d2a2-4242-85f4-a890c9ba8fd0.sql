
-- ============ PERSONAL FINANCE ============

-- Accounts / cards / wallets
CREATE TABLE public.pfin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'bank', -- bank | wallet | digital | credit_card | debit_card
  initial_balance numeric NOT NULL DEFAULT 0,
  color text,
  icon text,
  credit_limit numeric,
  closing_day integer,
  due_day integer,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pfin_accounts TO authenticated;
GRANT ALL ON public.pfin_accounts TO service_role;
ALTER TABLE public.pfin_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pfin_accounts owner" ON public.pfin_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_pfin_accounts_updated BEFORE UPDATE ON public.pfin_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Categories
CREATE TABLE public.pfin_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense')),
  color text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pfin_categories TO authenticated;
GRANT ALL ON public.pfin_categories TO service_role;
ALTER TABLE public.pfin_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pfin_categories owner" ON public.pfin_categories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_pfin_categories_updated BEFORE UPDATE ON public.pfin_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Transactions
CREATE TABLE public.pfin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income','expense')),
  amount numeric NOT NULL,
  description text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.pfin_categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.pfin_accounts(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  payment_method text, -- pix | cash | credit | debit | transfer | boleto | other
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending','recurring')),
  recurrence text CHECK (recurrence IN ('weekly','monthly','yearly')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pfin_transactions TO authenticated;
GRANT ALL ON public.pfin_transactions TO service_role;
ALTER TABLE public.pfin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pfin_transactions owner" ON public.pfin_transactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_pfin_tx_user_date ON public.pfin_transactions(user_id, date DESC);
CREATE TRIGGER trg_pfin_tx_updated BEFORE UPDATE ON public.pfin_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Goals
CREATE TABLE public.pfin_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  deadline date,
  notes text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pfin_goals TO authenticated;
GRANT ALL ON public.pfin_goals TO service_role;
ALTER TABLE public.pfin_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pfin_goals owner" ON public.pfin_goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_pfin_goals_updated BEFORE UPDATE ON public.pfin_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default categories on first use
CREATE OR REPLACE FUNCTION public.pfin_seed_default_categories()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.pfin_categories (user_id, name, type)
  SELECT auth.uid(), n.name, n.type FROM (VALUES
    ('Salário','income'),('Freelance','income'),('Vendas','income'),
    ('Reembolso','income'),('Outros (Entrada)','income'),
    ('Alimentação','expense'),('Moradia','expense'),('Transporte','expense'),
    ('Assinaturas','expense'),('Compras','expense'),('Saúde','expense'),
    ('Lazer','expense'),('Educação','expense'),('Dívidas','expense'),
    ('Outros (Saída)','expense')
  ) AS n(name,type)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pfin_categories c
    WHERE c.user_id = auth.uid() AND c.name = n.name AND c.type = n.type
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
