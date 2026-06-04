
-- Campos para edição manual de expedientes encerrados
ALTER TABLE public.ponto_sessions
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by uuid,
  ADD COLUMN IF NOT EXISTS original_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_ended_at timestamptz;

-- Tabela de auditoria das edições manuais
CREATE TABLE IF NOT EXISTS public.ponto_session_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ponto_sessions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  edited_by uuid NOT NULL,
  edited_by_email text,
  previous jsonb NOT NULL,
  next jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_session_edits_session ON public.ponto_session_edits(session_id);
CREATE INDEX IF NOT EXISTS idx_ponto_session_edits_workspace ON public.ponto_session_edits(workspace_id, created_at DESC);

GRANT SELECT, INSERT ON public.ponto_session_edits TO authenticated;
GRANT ALL ON public.ponto_session_edits TO service_role;

ALTER TABLE public.ponto_session_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read workspace edits"
  ON public.ponto_session_edits FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "users can insert their own edits"
  ON public.ponto_session_edits FOR INSERT
  TO authenticated
  WITH CHECK (
    edited_by = auth.uid()
    AND public.is_workspace_member(workspace_id, auth.uid())
  );
