
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'files_folders',
    'files_items',
    'ponto_sessions',
    'ponto_session_tasks',
    'ponto_session_edits',
    'kanban_card_links',
    'checklist_daily_completions',
    'gratitude_entries'
  ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Garante que UPDATE/DELETE entreguem payload completo (necessário p/ patches incrementais)
ALTER TABLE public.files_folders REPLICA IDENTITY FULL;
ALTER TABLE public.files_items REPLICA IDENTITY FULL;
ALTER TABLE public.ponto_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.ponto_session_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.kanban_card_links REPLICA IDENTITY FULL;
ALTER TABLE public.checklist_daily_completions REPLICA IDENTITY FULL;
ALTER TABLE public.gratitude_entries REPLICA IDENTITY FULL;
