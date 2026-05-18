
CREATE OR REPLACE FUNCTION public.invite_member_by_email(_workspace_id uuid, _email text, _role workspace_role DEFAULT 'member')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_user uuid;
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  SELECT id INTO target_user FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF target_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não encontrado. Peça para ele criar uma conta primeiro.');
  END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_workspace_id, target_user, _role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  RETURN jsonb_build_object('ok', true, 'user_id', target_user);
END; $$;

CREATE OR REPLACE FUNCTION public.set_member_role(_workspace_id uuid, _user_id uuid, _role workspace_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  UPDATE public.workspace_members SET role = _role
  WHERE workspace_id = _workspace_id AND user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.remove_member(_workspace_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  IF NOT (public.is_workspace_admin(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  SELECT owner_id INTO owner FROM public.workspaces WHERE id = _workspace_id;
  IF owner = _user_id THEN
    RAISE EXCEPTION 'Não é possível remover o dono do workspace';
  END IF;
  DELETE FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.list_workspace_members(_workspace_id uuid)
RETURNS TABLE(user_id uuid, role workspace_role, email text, display_name text) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_workspace_member(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  RETURN QUERY
  SELECT m.user_id, m.role, p.email, p.display_name
  FROM public.workspace_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.workspace_id = _workspace_id
  ORDER BY m.role DESC, p.display_name NULLS LAST;
END; $$;

REVOKE EXECUTE ON FUNCTION public.invite_member_by_email(uuid, text, workspace_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, workspace_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_workspace_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_member_by_email(uuid, text, workspace_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, workspace_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_workspace_members(uuid) TO authenticated;
