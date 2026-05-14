CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  owner_email TEXT NOT NULL,
  user_name TEXT,
  title TEXT NOT NULL DEFAULT 'Sem título',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Ideias',
  company TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  color TEXT,
  favorite BOOLEAN NOT NULL DEFAULT false,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_select ON public.notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notes_insert ON public.notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY notes_update ON public.notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notes_delete ON public.notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX notes_user_updated_idx ON public.notes (user_id, updated_at DESC);
CREATE INDEX notes_user_category_idx ON public.notes (user_id, category);

CREATE TRIGGER notes_set_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;