
CREATE OR REPLACE FUNCTION public.set_company_ponto_limit(
  _company_id uuid,
  _minutes integer,
  _enabled boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_min integer;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.checklist_companies WHERE id = _company_id;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;
  IF NOT (public.is_workspace_member(v_ws, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  v_min := GREATEST(1, LEAST(1440, COALESCE(_minutes, 30)));
  UPDATE public.checklist_companies
    SET ponto_daily_limit_minutes = v_min,
        ponto_limit_enabled = COALESCE(_enabled, true),
        updated_at = now()
    WHERE id = _company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_ponto_limit(uuid, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_ponto_limit(uuid, integer, boolean) TO authenticated, service_role;
