
CREATE OR REPLACE FUNCTION public.list_all_workspaces()
RETURNS TABLE(id uuid, name text, slug text, owner_id uuid, owner_email text, owner_name text, member_count bigint, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  RETURN QUERY
    SELECT w.id, w.name, w.slug, w.owner_id, p.email, p.display_name,
           (SELECT count(*) FROM public.workspace_members m WHERE m.workspace_id=w.id),
           w.created_at
    FROM public.workspaces w
    LEFT JOIN public.profiles p ON p.id = w.owner_id
    ORDER BY w.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_workspace_cascade(_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'master'::app_role) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  DELETE FROM public.kanban_attachments         WHERE workspace_id=_workspace_id;
  DELETE FROM public.kanban_card_links          WHERE workspace_id=_workspace_id;
  DELETE FROM public.kanban_cards_archive       WHERE workspace_id=_workspace_id;
  DELETE FROM public.kanban_cards               WHERE workspace_id=_workspace_id;
  DELETE FROM public.kanban_columns             WHERE workspace_id=_workspace_id;
  DELETE FROM public.kanban_funnels             WHERE workspace_id=_workspace_id;

  DELETE FROM public.checklist_daily_completions WHERE workspace_id=_workspace_id;
  DELETE FROM public.checklist_tasks            WHERE workspace_id=_workspace_id;

  DELETE FROM public.ponto_session_edits        WHERE workspace_id=_workspace_id;
  DELETE FROM public.ponto_session_tasks        WHERE workspace_id=_workspace_id;
  DELETE FROM public.ponto_sessions             WHERE workspace_id=_workspace_id;

  DELETE FROM public.finance_transactions       WHERE workspace_id=_workspace_id;
  DELETE FROM public.finance_products           WHERE workspace_id=_workspace_id;
  DELETE FROM public.finance_costs              WHERE workspace_id=_workspace_id;
  DELETE FROM public.finance_categories         WHERE workspace_id=_workspace_id;

  DELETE FROM public.stock_movements            WHERE workspace_id=_workspace_id;
  DELETE FROM public.stock_items                WHERE workspace_id=_workspace_id;
  DELETE FROM public.stock_field_defs           WHERE workspace_id=_workspace_id;
  DELETE FROM public.stock_groups               WHERE workspace_id=_workspace_id;
  DELETE FROM public.stock_categories           WHERE workspace_id=_workspace_id;
  DELETE FROM public.stock_companies            WHERE workspace_id=_workspace_id;

  DELETE FROM public.notes                      WHERE workspace_id=_workspace_id;
  DELETE FROM public.note_categories            WHERE workspace_id=_workspace_id;
  DELETE FROM public.sticky_notes               WHERE workspace_id=_workspace_id;
  DELETE FROM public.calendar_events            WHERE workspace_id=_workspace_id;
  DELETE FROM public.crm_leads                  WHERE workspace_id=_workspace_id;
  DELETE FROM public.gratitude_entries          WHERE workspace_id=_workspace_id;

  DELETE FROM public.checklist_companies        WHERE workspace_id=_workspace_id;
  DELETE FROM public.workspace_members          WHERE workspace_id=_workspace_id;
  DELETE FROM public.workspaces                 WHERE id=_workspace_id;
END; $$;

REVOKE ALL ON FUNCTION public.list_all_workspaces() FROM public, anon;
REVOKE ALL ON FUNCTION public.delete_workspace_cascade(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_all_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_workspace_cascade(uuid) TO authenticated;
