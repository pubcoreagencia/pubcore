# PUB CORE - Modules

## Visao geral
Este documento lista os principais modulos da PUB CORE, os arquivos mais importantes, tabelas Supabase relacionadas quando identificaveis e riscos de acoplamento.

## Centro Operacional
- Arquivos principais: `src/routes/app.operacao.tsx`, `src/routes/app.index.tsx`, `src/lib/operations.tsx`.
- Tabelas: `ponto_sessions`, `ponto_session_tasks`, `checklist_tasks`, `kanban_funnels`, `kanban_cards`, `notes`, `files_items`.
- Riscos: agrega dados de varios dominios; consultas amplas podem afetar performance.
- Acoplamento: depende de `useAuth`, `useWorkspace`, `useOperationalData` e componentes de metricas.

## Kanban
- Arquivo principal: `src/routes/app.kanban.tsx`.
- Componentes relacionados: `src/components/kanban/FlowCanvas.tsx`, `src/components/KanbanAttachments.tsx`.
- Tabelas: `kanban_funnels`, `kanban_columns`, `kanban_cards`, `kanban_attachments`, `kanban_card_links`, `ponto_session_tasks`.
- Storage: bucket `kanban-attachments`.
- Riscos: rota grande, drag/drop, anexos, fluxo visual e integracao com ponto/checklist.
- Acoplamento: mistura UI, persistencia, realtime, reordenacao e logica de conclusao.

## Checklist
- Arquivo principal: `src/routes/app.checklists.tsx`.
- Provider: `src/lib/checklist-store.tsx`.
- Tabelas: `checklist_tasks`, `checklist_daily_completions`, `ponto_session_tasks`.
- Riscos: reset diario, historico de conclusoes, vinculo com sessao de ponto ativa.
- Acoplamento: depende de `PontoProvider`, `WorkspaceProvider`, `ChecklistCompaniesProvider` e realtime.

## Bater Ponto, Historico e Metricas
- Arquivos principais: `src/lib/ponto.tsx`, `src/components/PontoHeader.tsx`, `src/components/PontoAutoTracker.tsx`, `src/components/EditPontoSessionDialog.tsx`, `src/lib/operations.tsx`.
- Tabelas: `ponto_sessions`, `ponto_session_tasks`, `ponto_session_edits`.
- Riscos: sessao ativa por empresa, fechamento automatico de sessoes abertas, estado local em `localStorage`, sincronizacao entre abas e Supabase.
- Acoplamento: usado por checklist, kanban, dashboard e relatorios.

## Relatorios de Conclusao
- Arquivos principais: `src/routes/app.completion-reports.tsx`, `src/components/CompletionReportDialog.tsx`, `src/components/DailyReportDialog.tsx`.
- Tabelas: `completion_reports`, `checklist_tasks`, `checklist_daily_completions`, `ponto_sessions`, `ponto_session_tasks`, `kanban_cards`, `notes`, `files_items`.
- Dependencias: `jspdf` via import dinamico.
- Riscos: agrega dados de muitos modulos; qualquer mudanca em schema pode quebrar relatorios.
- Acoplamento: forte com workspace, usuario, empresas, ponto, checklist e kanban.

## Central de Arquivos
- Arquivo principal: `src/routes/app.files.tsx`.
- Tabelas: `files_folders`, `files_items`.
- Storage: bucket `files`.
- Dependencias: `jszip` via import dinamico.
- Riscos: operacoes de upload, download, remocao e paths de storage; risco de inconsistencias entre tabela e objeto no bucket.
- Acoplamento: compartilhamento cross-workspace e discografia tambem usam storage.

## Discografia
- Arquivo principal: `src/routes/app.discography.tsx`.
- Tabelas: `disco_projects`, `disco_tracks`, `disco_versions`, `disco_comments`.
- Storage: bucket `files`.
- Riscos: upload/remocao de versoes, comentarios, tracks e projetos; rota grande.
- Acoplamento: compartilha infraestrutura de arquivos e workspace.

## Empresas
- Arquivos principais: `src/routes/app.companies.tsx`, `src/lib/checklist-companies.tsx`, `src/components/FirstCompanyOnboarding.tsx`.
- Tabelas: `checklist_companies`, com cascatas via RPC como `rename_checklist_company` e `delete_checklist_company_cascade`.
- Riscos: renomear/remover empresa afeta checklist, historico e possivelmente ponto.
- Acoplamento: empresas sao usadas como eixo visual e operacional em varios modulos.

## Workspaces e Permissoes
- Arquivo principal: `src/lib/workspace.tsx`.
- Componentes: `src/components/WorkspaceSwitcher.tsx`, `src/components/WorkspaceMembersPanel.tsx`.
- Tabelas: `workspaces`, `workspace_members`, `user_roles`, `profiles`.
- Riscos: master pode ver todos os workspaces; workspace ativo fica em `localStorage`; bugs podem misturar dados.
- Acoplamento: todos os modulos autenticados dependem do workspace ativo.

## Financas
- Arquivo principal: `src/routes/app.finance.tsx`.
- Tabelas: `finance_transactions`, `finance_costs`, `finance_products`, `finance_categories`.
- Dependencias: `recharts`.
- Riscos: rota grande, calculos financeiros, formularios e exclusoes.
- Acoplamento: workspace e produtos/custos internos.

## Financas Pessoais
- Arquivo principal: `src/routes/app.personal-finance.tsx`.
- Tabelas: `pfin_accounts`, `pfin_categories`, `pfin_transactions`, `pfin_goals`.
- Riscos: dados sensiveis de usuario; escopo e RLS devem permanecer por usuario.
- Acoplamento: menor com modulos operacionais, mas sensivel por privacidade.

## Estoque
- Arquivo principal: `src/routes/app.stock.tsx`.
- Tabelas: `stock_items`, `stock_categories`, `stock_groups`, `stock_companies`, `stock_movements`, `stock_field_defs`.
- Dependencias: `@dnd-kit`.
- Riscos: rota grande, campos dinamicos, movimentacoes e drag/drop.
- Acoplamento: pode cruzar com empresas e financas, dependendo da evolucao.

## Notas e Sticky Notes
- Arquivos principais: `src/routes/app.notes.tsx`, `src/components/StickyNotesPanel.tsx`, `src/components/StickyNotesWidget.tsx`.
- Tabelas: `notes`, `note_categories`, `sticky_notes`.
- Riscos: autosave, favoritos, pinned, categorias e widgets globais.
- Acoplamento: widget global aparece no layout autenticado desktop.

## Painel de Tendencias
- Arquivo principal: `src/routes/app.trends.tsx`.
- Tabelas: `trends_seasonalities`, `trends_hype`, `trends_opportunities`.
- Riscos: rota grande, filtros e dados estrategicos.
- Acoplamento: workspace e possivelmente relatorios futuros.

## Compartilhados
- Arquivos principais: `src/routes/app.shared.tsx`, `src/lib/sharing.ts`, `src/components/ShareDialog.tsx`, `src/components/ShareButton.tsx`.
- Tabelas: `shared_items`, `shared_item_comments`, `shared_item_activity`.
- Riscos: permissoes cross-workspace; risco alto de vazamento se policies ou filtros forem alterados sem cuidado.
- Acoplamento: checklist, kanban, arquivos, notas e calendario.

## Configuracoes e Admin
- Arquivos principais: `src/routes/app.settings.tsx`, `src/routes/app.admin-accounts.tsx`, `src/lib/auth.tsx`, `src/lib/theme.tsx`.
- Tabelas: `profiles`, `user_roles`, `workspace_members`.
- Riscos: aprovacao de contas, tema, papeis e permissoes.
- Acoplamento: autentica todos os fluxos principais.

## Auditoria
- Arquivos principais: `src/routes/auditoria-pubcore.tsx`, `src/lib/audit.functions.ts`.
- Tabelas: diversas, consultadas para contagens e inconsistencias.
- Riscos: usa service role no servidor; manter read-only e sem expor dados sensiveis.
- Acoplamento: modulo administrativo transversal.
