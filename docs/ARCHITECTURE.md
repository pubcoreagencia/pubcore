# PUB CORE - Architecture

## Objetivo
Este documento registra o estado tecnico atual da PUB CORE para continuidade segura fora do Lovable. Ele descreve a arquitetura observada no codigo local, sem propor mudancas funcionais imediatas.

## Stack real do projeto
- Runtime/app: Vite, React 19, TypeScript, TanStack Router e TanStack Start.
- Backend principal: Supabase, com Auth, Postgres, Realtime e Storage.
- Deploy/runtime alvo: Cloudflare/Nitro via `@cloudflare/vite-plugin` e `wrangler.jsonc`.
- UI: Tailwind CSS 4, shadcn/Radix UI, lucide-react.
- Dados e visualizacao: Recharts, date-fns.
- Interacoes ricas: dnd-kit, react-resizable-panels, react-day-picker.
- Exportacao/arquivos: jsPDF, html2canvas, html-to-image, JSZip.
- Legado Lovable: `@lovable.dev/vite-tanstack-config` e `@lovable.dev/cloud-auth-js`.

## Configuracao de build e deploy
- `vite.config.ts` delega para `@lovable.dev/vite-tanstack-config`.
- O comentario em `vite.config.ts` informa que plugins como TanStack Start, React, Tailwind, Cloudflare, alias `@` e injecao de env ja sao configurados pelo pacote Lovable. Nao duplicar esses plugins.
- `wrangler.jsonc` aponta `main` para `@tanstack/react-start/server-entry`.
- `wrangler.jsonc` usa `compatibility_flags: ["nodejs_compat"]`.
- `supabase/config.toml` aponta para o projeto Supabase `owimmytcffoovmokbple`.

## Estrutura de rotas
As rotas ficam em `src/routes` e usam `createFileRoute`.

Rotas publicas:
- `/`: `src/routes/index.tsx`, redireciona para a area principal.
- `/login`: `src/routes/login.tsx`.
- `/reset-password`: `src/routes/reset-password.tsx`.
- `/auditoria-pubcore`: `src/routes/auditoria-pubcore.tsx`.

Layout autenticado:
- `/app`: `src/routes/app.tsx`.

Rotas autenticadas principais:
- `/app`: `src/routes/app.index.tsx`
- `/app/operacao`: `src/routes/app.operacao.tsx`
- `/app/kanban`: `src/routes/app.kanban.tsx`
- `/app/checklists`: `src/routes/app.checklists.tsx`
- `/app/completion-reports`: `src/routes/app.completion-reports.tsx`
- `/app/files`: `src/routes/app.files.tsx`
- `/app/discography`: `src/routes/app.discography.tsx`
- `/app/companies`: `src/routes/app.companies.tsx`
- `/app/finance`: `src/routes/app.finance.tsx`
- `/app/personal-finance`: `src/routes/app.personal-finance.tsx`
- `/app/stock`: `src/routes/app.stock.tsx`
- `/app/notes`: `src/routes/app.notes.tsx`
- `/app/trends`: `src/routes/app.trends.tsx`
- `/app/settings`: `src/routes/app.settings.tsx`
- `/app/shared`: `src/routes/app.shared.tsx`
- `/app/calendar`: `src/routes/app.calendar.tsx`
- `/app/crm`: `src/routes/app.crm.tsx`
- `/app/admin-accounts`: `src/routes/app.admin-accounts.tsx`
- `/app/city`: `src/routes/app.city.tsx`
- `/app/calculator`: `src/routes/app.calculator.tsx`
- `/app/calc3d`: `src/routes/app.calc3d.tsx`
- `/app/gratitude`: `src/routes/app.gratitude.tsx`
- `/app/sticky-notes`: `src/routes/app.sticky-notes.tsx`

## Providers globais
O root global fica em `src/routes/__root.tsx`:
- `ThemeProvider`
- `AuthProvider`

O layout autenticado fica em `src/routes/app.tsx`:
- `WorkspaceProvider`
- `PontoProvider`
- `ChecklistCompaniesProvider`
- `ChecklistProvider`

Componentes globais montados no layout autenticado:
- `PontoAutoTracker`
- `GratitudePanel`
- `FirstCompanyOnboarding`
- `ShiftRotationPanel`
- `CalculatorWidget`
- `StickyNotesWidget`
- `Sidebar`
- `MobileNav`
- `PontoHeader`

## Fluxo geral da aplicacao autenticada
1. O usuario entra por `/login` ou por redirecionamento para `/app`.
2. `AuthProvider` carrega sessao Supabase e perfil.
3. `src/routes/app.tsx` bloqueia acesso sem usuario e redireciona para `/login`.
4. Se `accountStatus` nao for `approved`, exibe `PendingApprovalScreen`.
5. `WorkspaceProvider` carrega workspaces, papel master e workspace ativo.
6. Providers de ponto, empresas e checklist inicializam dados do workspace ativo.
7. Rotas internas consomem Supabase diretamente ou via providers/hooks compartilhados.
8. Realtime do Supabase e estado otimista atualizam a interface em varios modulos.

## Dependencias criticas
- Supabase Auth e tabela `profiles`.
- Workspaces: `workspaces`, `workspace_members`, `user_roles`.
- Ponto: `ponto_sessions`, `ponto_session_tasks`, `ponto_session_edits`.
- Checklist: `checklist_companies`, `checklist_tasks`, `checklist_daily_completions`.
- Kanban: `kanban_funnels`, `kanban_columns`, `kanban_cards`, `kanban_attachments`, `kanban_card_links`.
- Storage: buckets `files` e `kanban-attachments`.
- Server functions: `src/lib/audit.functions.ts` usa service role apenas no servidor.

## Observacao de arquitetura
O projeto esta funcional, mas muitas telas concentram logica de UI, consultas Supabase, estado local, realtime e regras de dominio no mesmo arquivo. A evolucao deve ser incremental e preservar comportamento existente.
