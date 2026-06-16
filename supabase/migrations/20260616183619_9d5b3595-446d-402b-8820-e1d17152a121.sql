
-- ============ trends_seasonalities ============
CREATE TABLE public.trends_seasonalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid,
  owner_email text NOT NULL DEFAULT '',
  name text NOT NULL,
  event_date date,
  recurring_month smallint,
  recurring_day smallint,
  category text NOT NULL DEFAULT 'Comercial',
  description text,
  opportunity text,
  company text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'idea',
  notes text,
  ideas jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  assignee text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trends_seasonalities_ws ON public.trends_seasonalities(workspace_id);
CREATE INDEX idx_trends_seasonalities_date ON public.trends_seasonalities(event_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trends_seasonalities TO authenticated;
GRANT ALL ON public.trends_seasonalities TO service_role;
ALTER TABLE public.trends_seasonalities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.trends_seasonalities FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY "ws_insert" ON public.trends_seasonalities FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY "ws_update" ON public.trends_seasonalities FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY "ws_delete" ON public.trends_seasonalities FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trends_seasonalities_set_updated BEFORE UPDATE ON public.trends_seasonalities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ trends_hype ============
CREATE TABLE public.trends_hype (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid,
  owner_email text NOT NULL DEFAULT '',
  term text NOT NULL,
  description text,
  region text DEFAULT 'BR',
  period text DEFAULT '30d',
  category text,
  source text DEFAULT 'manual',
  growth integer,
  related_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'monitor',
  priority text NOT NULL DEFAULT 'medium',
  company text,
  notes text,
  external_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trends_hype_ws ON public.trends_hype(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trends_hype TO authenticated;
GRANT ALL ON public.trends_hype TO service_role;
ALTER TABLE public.trends_hype ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.trends_hype FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY "ws_insert" ON public.trends_hype FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY "ws_update" ON public.trends_hype FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY "ws_delete" ON public.trends_hype FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trends_hype_set_updated BEFORE UPDATE ON public.trends_hype
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ trends_opportunities ============
CREATE TABLE public.trends_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid,
  owner_email text NOT NULL DEFAULT '',
  title text NOT NULL,
  reason text,
  source_kind text,
  source_id uuid,
  company text,
  status text NOT NULL DEFAULT 'monitor',
  priority text NOT NULL DEFAULT 'medium',
  assignee text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trends_opps_ws ON public.trends_opportunities(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trends_opportunities TO authenticated;
GRANT ALL ON public.trends_opportunities TO service_role;
ALTER TABLE public.trends_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select" ON public.trends_opportunities FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY "ws_insert" ON public.trends_opportunities FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY "ws_update" ON public.trends_opportunities FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));
CREATE POLICY "ws_delete" ON public.trends_opportunities FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trends_opps_set_updated BEFORE UPDATE ON public.trends_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Função de seed de molde sazonal por workspace ============
CREATE OR REPLACE FUNCTION public.seed_trends_seasonalities(_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_email text;
BEGIN
  IF NOT (public.is_workspace_member(_workspace_id, auth.uid()) OR public.has_app_role(auth.uid(), 'master'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.trends_seasonalities (workspace_id, user_id, owner_email, name, recurring_month, recurring_day, category, description, opportunity, priority)
  SELECT _workspace_id, auth.uid(), COALESCE(v_email,''), n.name, n.m, n.d, n.cat, n.descr, n.opp, n.pri
  FROM (VALUES
    ('Ano Novo', 1, 1, 'Feriado', 'Início do ano, planejamento e resoluções', 'Campanhas de recomeço, planners, novos produtos', 'high'),
    ('Carnaval', 2, NULL, 'Cultural', 'Maior festa popular do Brasil', 'Produtos personalizados, looks, delivery, eventos', 'high'),
    ('Dia Internacional da Mulher', 3, 8, 'Comemorativa', 'Homenagens e campanhas de empoderamento', 'Campanhas, kits, conteúdo, promoções', 'high'),
    ('Dia do Consumidor', 3, 15, 'E-commerce', 'Black Friday do primeiro semestre', 'Promoções relâmpago, cupons, frete grátis', 'high'),
    ('Páscoa', 4, NULL, 'Comemorativa', 'Datas variáveis - chocolate, família', 'Kits personalizados, embalagens 3D, delivery', 'high'),
    ('Dia das Mães', 5, NULL, 'Comemorativa', 'Segundo domingo de maio', 'Presentes personalizados, kits, audiovisual emocional', 'high'),
    ('Dia dos Namorados', 6, 12, 'Comemorativa', 'Data afetiva forte no Brasil', 'Kits românticos, jantares, playlist, presentes 3D', 'high'),
    ('Festa Junina', 6, 24, 'Cultural', 'Tradição regional forte', 'Cardápios temáticos, brindes, decoração', 'medium'),
    ('Dia do Amigo', 7, 20, 'Comemorativa', 'Engajamento social', 'Conteúdo, sorteios, indique-um-amigo', 'medium'),
    ('Volta às Aulas', 7, 25, 'Sazonal', 'Retomada escolar', 'Material personalizado, organização, kits', 'medium'),
    ('Dia dos Pais', 8, NULL, 'Comemorativa', 'Segundo domingo de agosto', 'Kits, presentes, audiovisual, delivery especial', 'high'),
    ('Dia do Cliente', 9, 15, 'Comercial', 'Relacionamento com clientes', 'Cupons exclusivos, brindes, agradecimento', 'high'),
    ('Independência do Brasil', 9, 7, 'Feriado', 'Feriado nacional', 'Campanhas patrióticas, promoções', 'low'),
    ('Primavera', 9, 22, 'Sazonal', 'Mudança de estação', 'Coleções, decoração, conteúdo leve', 'low'),
    ('Dia das Crianças', 10, 12, 'Comemorativa', 'Foco em famílias', 'Brinquedos personalizados, kits, eventos', 'high'),
    ('Halloween', 10, 31, 'Cultural', 'Crescente no Brasil', 'Produtos temáticos, embalagens, conteúdo', 'medium'),
    ('Dia dos Mortos / Finados', 11, 2, 'Feriado', 'Feriado nacional', 'Conteúdo sensível, não promocional', 'low'),
    ('Black November', 11, 1, 'E-commerce', 'Mês de promoções', 'Calendário de ofertas, campanhas progressivas', 'high'),
    ('Black Friday', 11, 28, 'E-commerce', 'Última sexta de novembro', 'Maior promoção do ano - estoque, criativos, ads', 'high'),
    ('Cyber Monday', 12, 1, 'E-commerce', 'Segunda após Black Friday', 'Ofertas digitais, serviços online', 'high'),
    ('Natal', 12, 25, 'Comemorativa', 'Maior data de presentes', 'Kits, embalagens premium, decoração, delivery', 'high'),
    ('Réveillon', 12, 31, 'Cultural', 'Virada do ano', 'Eventos, looks, delivery, audiovisual', 'high'),
    ('Dia do Solteiro (11.11)', 11, 11, 'E-commerce', 'Importado da Ásia, em crescimento', 'Promoções de auto-presente, kits individuais', 'medium'),
    ('Outubro Rosa', 10, 1, 'Causa', 'Conscientização câncer de mama', 'Conteúdo de causa, produtos com reverso', 'medium'),
    ('Novembro Azul', 11, 1, 'Causa', 'Saúde do homem', 'Conteúdo de causa, parcerias', 'medium'),
    ('Dia do Profissional de Marketing', 8, 27, 'Nicho', 'Networking e conteúdo B2B', 'Conteúdo institucional, cases', 'low'),
    ('Dia da Música', 6, 21, 'Nicho', 'Cultura musical', 'Playlists, lançamentos, conteúdo PUB Records', 'medium'),
    ('Dia do Cinema Brasileiro', 6, 19, 'Nicho', 'Audiovisual', 'Conteúdo, behind-the-scenes, PUB Films', 'medium'),
    ('Dia da Impressão 3D', 12, 3, 'Nicho', 'Comemoração da tecnologia', 'Cases, demos, conteúdo PUB 3D', 'medium'),
    ('Dia do Empreendedor', 10, 5, 'Nicho', 'Negócios e holding', 'Conteúdo institucional, bastidores', 'medium'),
    ('Dia Mundial do Meio Ambiente', 6, 5, 'Causa', 'Sustentabilidade', 'Produtos sustentáveis, conteúdo de causa', 'low'),
    ('Dia do Trabalhador', 5, 1, 'Feriado', 'Feriado nacional', 'Reconhecimento de equipe, conteúdo interno', 'low'),
    ('Tiradentes', 4, 21, 'Feriado', 'Feriado nacional', 'Pausa estratégica, conteúdo histórico', 'low'),
    ('Proclamação da República', 11, 15, 'Feriado', 'Feriado nacional', 'Pausa estratégica', 'low'),
    ('Corpus Christi', 6, NULL, 'Feriado', 'Feriado variável (Junho)', 'Pausa de equipe, planejamento', 'low'),
    ('Dia dos Avós', 7, 26, 'Comemorativa', 'Em crescimento', 'Presentes personalizados, audiovisual', 'medium'),
    ('Dia da Secretária', 9, 30, 'Comemorativa', 'B2B clássico', 'Kits corporativos', 'low'),
    ('Dia do Médico', 10, 18, 'Comemorativa', 'B2B saúde', 'Kits personalizados, brindes', 'low')
  ) AS n(name, m, d, cat, descr, opp, pri)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.trends_seasonalities ts
    WHERE ts.workspace_id = _workspace_id AND ts.name = n.name
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
