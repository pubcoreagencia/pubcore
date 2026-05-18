-- Swap master email back to contato.pubcore@gmail.com
CREATE OR REPLACE FUNCTION public.enforce_master_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE u_email text;
BEGIN
  IF NEW.role = 'master' THEN
    SELECT lower(email) INTO u_email FROM auth.users WHERE id = NEW.user_id;
    IF coalesce(u_email,'') <> 'contato.pubcore@gmail.com' THEN
      RAISE EXCEPTION 'Apenas contato.pubcore@gmail.com pode ter o perfil master';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE wsid uuid; uname text; master_email constant text := 'contato.pubcore@gmail.com';
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
END; $function$;

-- Remove master role from pub3d (if exists) and grant to pubcore (if exists)
DELETE FROM public.user_roles
WHERE role = 'master'
  AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'contato.pub3d@gmail.com');

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'master'::app_role FROM auth.users WHERE lower(email) = 'contato.pubcore@gmail.com'
ON CONFLICT DO NOTHING;

-- Ensure pub3d has the global 'user' role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::app_role FROM auth.users WHERE lower(email) = 'contato.pub3d@gmail.com'
ON CONFLICT DO NOTHING;