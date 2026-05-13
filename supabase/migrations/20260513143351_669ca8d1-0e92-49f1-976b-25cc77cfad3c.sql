
CREATE TABLE public.kanban_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY kanban_columns_select ON public.kanban_columns FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY kanban_columns_insert ON public.kanban_columns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY kanban_columns_update ON public.kanban_columns FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY kanban_columns_delete ON public.kanban_columns FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER kanban_columns_updated_at BEFORE UPDATE ON public.kanban_columns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS column_id uuid REFERENCES public.kanban_columns(id) ON DELETE SET NULL;

ALTER TABLE public.kanban_cards ALTER COLUMN column_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS kanban_cards_column_id_idx ON public.kanban_cards(column_id);
CREATE INDEX IF NOT EXISTS kanban_columns_user_position_idx ON public.kanban_columns(user_id, position);

ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_columns;
ALTER TABLE public.kanban_columns REPLICA IDENTITY FULL;
ALTER TABLE public.kanban_cards REPLICA IDENTITY FULL;
