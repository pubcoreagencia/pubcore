CREATE OR REPLACE FUNCTION public.rename_checklist_company(_workspace_id uuid, _old_name text, _new_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  UPDATE public.checklist_tasks SET company = _new_name
    WHERE workspace_id = _workspace_id AND company = _old_name;
  UPDATE public.checklist_daily_completions SET company = _new_name
    WHERE workspace_id = _workspace_id AND company = _old_name;
  UPDATE public.ponto_sessions SET company = _new_name
    WHERE workspace_id = _workspace_id AND company = _old_name;
END;
$function$;