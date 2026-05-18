
-- 1) handle_new_user: grant master only to fixed email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wsid uuid; uname text; master_email constant text := 'contato.pub3d@gmail.com';
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  uname := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Workspace');
  INSERT INTO public.workspaces (name, owner_id) VALUES (uname || '''s Workspace', NEW.id) RETURNING id INTO wsid;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (wsid, NEW.id, 'admin');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF lower(NEW.email) = master_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'master') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- 2) Enforce trigger: only contato.pub3d@gmail.com can hold 'master'
CREATE OR REPLACE FUNCTION public.enforce_master_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u_email text;
BEGIN
  IF NEW.role = 'master' THEN
    SELECT lower(email) INTO u_email FROM auth.users WHERE id = NEW.user_id;
    IF coalesce(u_email,'') <> 'contato.pub3d@gmail.com' THEN
      RAISE EXCEPTION 'Apenas contato.pub3d@gmail.com pode ter o perfil master';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS enforce_master_role_trg ON public.user_roles;
CREATE TRIGGER enforce_master_role_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_master_role();

-- 3) Fix current state
DELETE FROM public.user_roles
WHERE role = 'master'
  AND user_id IN (SELECT id FROM auth.users WHERE lower(email) <> 'contato.pub3d@gmail.com');

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'master' FROM auth.users WHERE lower(email) = 'contato.pub3d@gmail.com'
ON CONFLICT DO NOTHING;

-- 4) Tighten workspace_members insert: no self-join to arbitrary workspaces
DROP POLICY IF EXISTS members_insert ON public.workspace_members;
CREATE POLICY members_insert ON public.workspace_members
FOR INSERT TO authenticated
WITH CHECK (
  public.is_workspace_admin(workspace_id, auth.uid())
  OR public.has_app_role(auth.uid(), 'master'::app_role)
);
