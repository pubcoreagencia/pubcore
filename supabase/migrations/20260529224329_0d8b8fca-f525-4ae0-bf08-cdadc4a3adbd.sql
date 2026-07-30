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
    IF coalesce(u_email,'') NOT IN ('contato.pubcore@gmail.com','m4cktheus@gmail.com') THEN
      RAISE EXCEPTION 'Apenas contas autorizadas podem ter o perfil master';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'master'::public.app_role
FROM auth.users
WHERE id = '9f79e8f9-9965-4bdc-8b75-85140c333354'
  AND lower(email) IN ('contato.pubcore@gmail.com','m4cktheus@gmail.com')
ON CONFLICT DO NOTHING;
