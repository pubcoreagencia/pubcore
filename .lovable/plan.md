## Visão geral

Transformar a PUB CORE de uma plataforma com identidade interna da Holding PUB para um SaaS de gestão empresarial multiempresa genérico, onde cada workspace começa **vazio** e o usuário monta sua própria operação (estilo ClickUp/Notion/Monday).

A mudança é **conceitual e de seeding**, não destrutiva: contas e dados existentes ficam intactos. Apenas novos workspaces deixam de receber dados pré-cadastrados, e a UI deixa de exibir nomes/exemplos das empresas da PUB.

## 1. Auditoria e remoção de referências internas da PUB

Varrer o código removendo qualquer string/exemplo/placeholder que cite empresas da holding (`PUB IA`, `PUB 3D`, `PUB FISHING`, `PUB MARKETING`, `PUB ECOM`, `Empresa Exemplo PUB`, etc.).

Locais já conhecidos a limpar:

- `src/lib/mock-data.ts` — `DEFAULT_COMPANIES`, `DEFAULT_COMPANIES_COLORS`, qualquer task/lead/produto mock que use nomes PUB. Esvaziar arrays usados como seed; manter tipos/constantes neutras.
- `src/routes/app.city.tsx` — remover o bloco hardcoded com `companies: ["PUB ECOM", ...]`. A "cidade" passa a refletir empresas reais do workspace ou exibe estado vazio.
- `src/components/FirstShiftPanel.tsx`, `ShiftRotationPanel.tsx`, `EditPontoSessionDialog.tsx`, `PontoAutoTracker.tsx`, `lib/ponto.tsx`, `lib/checklist-companies.tsx`, `lib/checklist-store.tsx` — onde houver fallback para `DEFAULT_COMPANIES`, trocar por "lista vazia + CTA para cadastrar primeira empresa na Checklist".
- Placeholders em inputs (`placeholder="Ex: PUB IA"` etc.) → trocar por neutros (`"Ex: Minha Empresa"`, `"Nome da empresa"`).
- Textos institucionais que digam "central operacional da PUB", "ferramenta interna", etc. → reescrever como "plataforma de gestão empresarial".

A marca **PUB CORE** continua como nome do produto (logo, sidebar, login). Não removemos o branding do produto — só as empresas internas da holding.

## 2. Seed do banco: novos workspaces começam vazios

Auditar a função `public.handle_new_user()` e qualquer trigger/função que rode no `CREATE WORKSPACE` ou no signup. Garantir que ela **só** crie:

- registro em `workspaces`
- registro em `workspace_members` (owner = admin)
- registro em `user_roles` (`user`)
- registro em `profiles`

Nenhum insert automático em: `checklist_companies`, `checklist_tasks`, `kanban_funnels`, `kanban_columns`, `kanban_cards`, `crm_leads`, `finance_*`, `stock_*`, `ponto_sessions`, `note_categories`, `notes`, `sticky_notes`, `calendar_events`, `gratitude_entries`.

Se houver triggers/funções que populem qualquer dessas tabelas no momento de criar workspace, removê-las via migração. Workspaces existentes **não são tocados**.

## 3. UI de empty-state em cada módulo

Onde hoje a UI cai num fallback com nomes PUB ou exemplos, passar a renderizar um **empty state** consistente: ícone + título curto + 1 frase explicando + botão primário para criar o primeiro item. Padronizar via componente `EmptyState` reutilizável em `src/components/EmptyState.tsx`.

Aplicar em (no mínimo):

- Checklists → "Nenhuma empresa cadastrada — Adicionar empresa"
- Bater Ponto → "Cadastre uma empresa na Checklist para começar a bater ponto"
- Kanban → "Nenhum funil — Criar primeiro funil"
- CRM → "Nenhum lead — Adicionar lead"
- Estoque, Financeiro, Notas, Calendário, Cidade, etc. → mesmo padrão

## 4. Onboarding guiado (multi-etapa, opcional)

Detectar workspace vazio (zero empresas em `checklist_companies`) e exibir um wizard sobreposto à tela inicial (`/app`):

- Etapa 1 — Criar primeira empresa (nome, segmento, responsável, cor)
- Etapa 2 — Criar primeiro funil (Kanban) — opcional/skippable
- Etapa 3 — Criar primeira equipe / convidar membros — opcional/skippable
- Etapa 4 — Criar primeiro processo (checklist) — opcional/skippable
- Etapa 5 — "Tudo pronto — ir para o dashboard"

Cada etapa salva imediatamente no Supabase e pode ser pulada. Wizard fica acessível depois em `Configurações → Onboarding`. Persistência: flag `onboarding_completed_at` na `profiles`.

Arquivos novos:

```
src/components/onboarding/OnboardingWizard.tsx
src/components/onboarding/steps/StepCompany.tsx
src/components/onboarding/steps/StepFunnel.tsx
src/components/onboarding/steps/StepTeam.tsx
src/components/onboarding/steps/StepProcess.tsx
src/components/EmptyState.tsx
```

## 5. Migração de banco

```sql
-- 5.1: adicionar flag de onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL;

-- 5.2: revisar handle_new_user() para garantir que NÃO popula
-- checklist_companies, kanban_*, crm_*, etc.
-- (rewrite mantendo apenas: profiles + workspace + workspace_members + user_roles)
```

Nada é deletado. Nenhum workspace existente é alterado.

## 6. Compatibilidade

- Auth, sessões, roles: intactos.
- Workspaces existentes: dados preservados.
- Permissões e RLS: inalteradas.
- Integrações: inalteradas.
- A flag `onboarding_completed_at` é nullable — contas antigas ficam com `null` e o wizard não aparece para elas (consideramos antigas como onboarded; só exibe wizard quando o workspace está realmente vazio E é criado após esta atualização).

## 7. O que NÃO muda

- Nome do produto: **PUB CORE** (logo, sidebar, login, favicon).
- Tabelas, RLS, estrutura de módulos.
- Funcionalidade de Bater Ponto, Kanban (hibrido), Checklists, etc.
- Dados de workspaces existentes.

## Escopo do MVP desta entrega

1. Migração: `onboarding_completed_at` + revisão do `handle_new_user`.
2. Limpar `mock-data.ts`, `app.city.tsx`, fallbacks com `DEFAULT_COMPANIES`, placeholders.
3. `EmptyState` reutilizável aplicado nos módulos principais (Checklist, Bater Ponto, Kanban, CRM).
4. `OnboardingWizard` mínimo (5 etapas, todas pulaveis exceto a 1, persiste no Supabase).
5. Revisar textos institucionais ("central operacional da PUB" → linguagem neutra).

Refinamentos futuros (não nesta entrega): seleção de templates de funil/checklist, importação de dados, vídeos de onboarding por módulo.

## Confirmação

Posso seguir? Começo pela migração + auditoria de strings PUB.
