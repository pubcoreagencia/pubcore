ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL;

-- Reescrita defensiva de handle_new_user: garante que novos usuários NÃO recebem
-- nenhum dado pré-cadastrado (empresas, funis, kanban, crm, etc.). Apenas o
-- esqueleto mínimo é criado: profile, workspace, membership, role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  wsid uuid;
  uname text;
  master_email constant text := 'contato.pubcore@gmail.com';
  new_status text;
BEGIN
  new_status := CASE WHEN lower(NEW.email) = master_email THEN 'approved' ELSE 'pending' END;

  INSERT INTO public.profiles (id, email, display_name, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), new_status)
  ON CONFLICT (id) DO NOTHING;

  uname := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Workspace');
  INSERT INTO public.workspaces (name, owner_id) VALUES (uname || '''s Workspace', NEW.id) RETURNING id INTO wsid;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (wsid, NEW.id, 'admin');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF lower(NEW.email) = master_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'master') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;