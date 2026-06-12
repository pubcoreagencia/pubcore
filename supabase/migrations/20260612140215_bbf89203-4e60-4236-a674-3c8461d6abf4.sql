
-- 1) Extra columns on checklist_companies (canonical empresas table)
ALTER TABLE public.checklist_companies
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS responsible text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2) Add company / archived_at where missing
ALTER TABLE public.kanban_funnels ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.kanban_funnels ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.finance_products ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.finance_costs ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 3) Impact report RPC
CREATE OR REPLACE FUNCTION public.company_impact_report(_workspace_id uuid, _name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT jsonb_build_object(
    'checklist_tasks',          (SELECT count(*) FROM public.checklist_tasks WHERE workspace_id=_workspace_id AND company=_name),
    'checklist_completions',    (SELECT count(*) FROM public.checklist_daily_completions WHERE workspace_id=_workspace_id AND company=_name),
    'ponto_sessions',           (SELECT count(*) FROM public.ponto_sessions WHERE workspace_id=_workspace_id AND company=_name),
    'finance_transactions',     (SELECT count(*) FROM public.finance_transactions WHERE workspace_id=_workspace_id AND company=_name),
    'finance_products',         (SELECT count(*) FROM public.finance_products WHERE workspace_id=_workspace_id AND company=_name),
    'finance_costs',            (SELECT count(*) FROM public.finance_costs WHERE workspace_id=_workspace_id AND company=_name),
    'stock_items',              (SELECT count(*) FROM public.stock_items WHERE workspace_id=_workspace_id AND company=_name),
    'kanban_funnels',           (SELECT count(*) FROM public.kanban_funnels WHERE workspace_id=_workspace_id AND company=_name),
    'kanban_cards',             (SELECT count(*) FROM public.kanban_cards WHERE workspace_id=_workspace_id AND company=_name),
    'crm_leads',                (SELECT count(*) FROM public.crm_leads WHERE workspace_id=_workspace_id AND company=_name),
    'calendar_events',          (SELECT count(*) FROM public.calendar_events WHERE workspace_id=_workspace_id AND company=_name),
    'notes',                    (SELECT count(*) FROM public.notes WHERE workspace_id=_workspace_id AND company=_name)
  )
  INTO result;
  RETURN result;
END;
$$;

-- 4) Transfer RPC
CREATE OR REPLACE FUNCTION public.transfer_company_records(_workspace_id uuid, _from text, _to text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF _from IS NULL OR _to IS NULL OR _from = _to THEN
    RAISE EXCEPTION 'Empresas de origem e destino devem ser diferentes';
  END IF;

  UPDATE public.checklist_tasks            SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.checklist_daily_completions SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.ponto_sessions             SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.finance_transactions       SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.finance_products           SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.finance_costs              SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.stock_items                SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.kanban_funnels             SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.kanban_cards               SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.crm_leads                  SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.calendar_events            SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
  UPDATE public.notes                      SET company=_to WHERE workspace_id=_workspace_id AND company=_from;
END;
$$;

-- 5) Extend rename to cover all modules
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
  UPDATE public.checklist_tasks            SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.checklist_daily_completions SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.ponto_sessions             SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.finance_transactions       SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.finance_products           SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.finance_costs              SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.stock_items                SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.kanban_funnels             SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.kanban_cards               SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.crm_leads                  SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.calendar_events            SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
  UPDATE public.notes                      SET company=_new_name WHERE workspace_id=_workspace_id AND company=_old_name;
END;
$$;

-- 6) Extend delete cascade to cover all modules
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
  DELETE FROM public.checklist_tasks            WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.checklist_daily_completions WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.ponto_sessions             WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.finance_transactions       WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.finance_products           WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.finance_costs              WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.stock_items                WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.kanban_cards               WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.kanban_funnels             WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.crm_leads                  WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.calendar_events            WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.notes                      WHERE workspace_id=_workspace_id AND company=_name;
  DELETE FROM public.checklist_companies        WHERE workspace_id=_workspace_id AND name=_name;
END;
$$;

-- 7) Realtime for checklist_companies
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_companies;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
