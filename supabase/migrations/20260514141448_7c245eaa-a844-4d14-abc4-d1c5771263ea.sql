
CREATE TABLE public.note_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'oklch(0.78 0.15 75)',
  icon text NOT NULL DEFAULT 'Sparkles',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.note_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY note_categories_select ON public.note_categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY note_categories_insert ON public.note_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY note_categories_update ON public.note_categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY note_categories_delete ON public.note_categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER note_categories_set_updated_at
BEFORE UPDATE ON public.note_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.note_categories;
