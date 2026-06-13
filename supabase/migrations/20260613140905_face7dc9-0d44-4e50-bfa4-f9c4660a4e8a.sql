
ALTER TABLE public.checklist_companies
  ADD COLUMN IF NOT EXISTS parent_company_id uuid NULL REFERENCES public.checklist_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text NULL;

CREATE INDEX IF NOT EXISTS checklist_companies_parent_idx
  ON public.checklist_companies(workspace_id, parent_company_id);

-- Prevent a company from being its own parent or creating cycles (1 level deep is enough for the spec, but block self-ref defensively)
CREATE OR REPLACE FUNCTION public.checklist_companies_prevent_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent uuid := NEW.parent_company_id;
  v_grand uuid;
BEGIN
  IF v_parent IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_parent = NEW.id THEN
    RAISE EXCEPTION 'Uma empresa não pode ser sua própria empresa-mãe';
  END IF;
  -- Disallow nesting deeper than one level: parent must itself have no parent
  SELECT parent_company_id INTO v_grand FROM public.checklist_companies WHERE id = v_parent;
  IF v_grand IS NOT NULL THEN
    RAISE EXCEPTION 'Subempresas não podem ter subempresas (máx. 1 nível de hierarquia)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checklist_companies_prevent_cycle_trg ON public.checklist_companies;
CREATE TRIGGER checklist_companies_prevent_cycle_trg
  BEFORE INSERT OR UPDATE OF parent_company_id ON public.checklist_companies
  FOR EACH ROW EXECUTE FUNCTION public.checklist_companies_prevent_cycle();
