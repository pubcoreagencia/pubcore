ALTER TABLE public.ponto_sessions ADD COLUMN IF NOT EXISTS company text;
CREATE INDEX IF NOT EXISTS idx_ponto_sessions_ws_user_started ON public.ponto_sessions(workspace_id, user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ponto_sessions_ws_user_company_started ON public.ponto_sessions(workspace_id, user_id, company, started_at DESC);