DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for any auth users that signed up without the trigger
INSERT INTO public.profiles (id, email, display_name, status)
SELECT u.id, u.email,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
  CASE WHEN lower(u.email) = 'contato.pubcore@gmail.com' THEN 'approved' ELSE 'pending' END
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill workspaces/roles for those users
INSERT INTO public.workspaces (name, owner_id)
SELECT COALESCE(u.raw_user_meta_data->>'name', split_part(u.email,'@',1), 'Workspace') || '''s Workspace', u.id
FROM auth.users u
LEFT JOIN public.workspaces w ON w.owner_id = u.id
WHERE w.id IS NULL;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'admin'
FROM public.workspaces w
LEFT JOIN public.workspace_members m ON m.workspace_id = w.id AND m.user_id = w.owner_id
WHERE m.user_id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'user' FROM public.profiles p
LEFT JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'user'
WHERE r.user_id IS NULL;