-- Add content column to gratitude_entries
ALTER TABLE public.gratitude_entries ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';

-- Migrate existing data: concatenate all fields into content
UPDATE public.gratitude_entries
SET content = TRIM(CONCAT_WS(
  E'\n\n',
  CASE WHEN gratitude IS NOT NULL AND gratitude <> '' THEN 'GRATIDÃO:\n' || gratitude END,
  CASE WHEN objectives IS NOT NULL AND objectives <> '' THEN 'OBJETIVOS:\n' || objectives END,
  CASE WHEN mission IS NOT NULL AND mission <> '' THEN 'MISSÃO:\n' || mission END,
  CASE WHEN dreams IS NOT NULL AND dreams <> '' THEN 'SONHOS & METAS:\n' || dreams END,
  CASE WHEN reflection IS NOT NULL AND reflection <> '' THEN 'REFLEXÃO:\n' || reflection END
))
WHERE content IS NULL OR content = '';

-- Make content NOT NULL after migration
ALTER TABLE public.gratitude_entries ALTER COLUMN content SET NOT NULL;
ALTER TABLE public.gratitude_entries ALTER COLUMN content DROP DEFAULT;

-- Drop old columns
ALTER TABLE public.gratitude_entries DROP COLUMN IF EXISTS gratitude;
ALTER TABLE public.gratitude_entries DROP COLUMN IF EXISTS objectives;
ALTER TABLE public.gratitude_entries DROP COLUMN IF EXISTS mission;
ALTER TABLE public.gratitude_entries DROP COLUMN IF EXISTS dreams;
ALTER TABLE public.gratitude_entries DROP COLUMN IF EXISTS reflection;