
ALTER TABLE public.checklist_companies
  ADD COLUMN IF NOT EXISTS ponto_daily_limit_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS ponto_limit_enabled boolean NOT NULL DEFAULT true;
