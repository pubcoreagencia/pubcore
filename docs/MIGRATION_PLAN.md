# PUB CORE - Plano de migracao Supabase

Este documento prepara a migracao real da PUB CORE do Supabase antigo gerenciado pelo Lovable para o Supabase proprio da PUB. Ele nao executa nenhum passo destrutivo e nao contem credenciais.

Project ref antigo conhecido: `owimmytcffoovmokbple`.

## Estado esperado antes da migracao

- As migrations locais devem aplicar em ambiente limpo com `npx supabase db reset`.
- O novo Supabase deve estar vazio ou em estado controlado, com apenas schema aplicado.
- O app local deve autenticar contra o novo Supabase.
- A importacao deve preservar UUIDs de `auth.users.id`, `profiles.id`, `workspaces.id`, `workspace_id`, `user_id`, `owner_id`, `created_by`, `author_id` e IDs primarios das tabelas operacionais.
- O usuario de teste criado no novo Supabase deve ser removido antes da importacao se ele nao existir no Supabase antigo com o mesmo UUID. Se permanecer, pode criar conflito de e-mail, membership, roles, workspace automatico e contagens divergentes.

## Credenciais necessarias

Guardar fora do repositorio:

- Database URL do Supabase antigo com permissao de leitura/export.
- Database URL do Supabase novo com permissao de restore/import.
- Access token Supabase CLI, se usar `supabase` CLI.
- Credenciais Storage do Supabase antigo e novo, via API/S3/CLI.
- Service role key apenas para scripts de Storage quando inevitavel; nunca commitar.

Nao usar `.env` da aplicacao como arquivo operacional de migracao. Prefira variaveis de ambiente temporarias no terminal.

## Tabelas por ordem de dependencia

### 1. Auth

- `auth.users`
- `auth.identities`

Preservar `id`, `email`, provider identities e metadados. Sem isso, RLS, workspaces e historico perdem referencia.

### 2. Perfis, workspaces e roles

- `profiles`
- `workspaces`
- `workspace_members`
- `user_roles`

Essas tabelas sustentam RLS e o contexto global da aplicacao.

### 3. Empresas e checklists

- `checklist_companies`
- `checklist_tasks`
- `checklist_daily_completions`

Dependem de `workspace_id` e, em tarefas/conclusoes, de `user_id`.

### 4. Ponto e historico

- `ponto_sessions`
- `ponto_session_tasks`
- `ponto_session_edits`

Preservar tempos, status, pausas e vinculos com tarefas/conclusoes. Evitar qualquer import que reabra sessoes antigas ou recrie IDs.

### 5. Kanban

- `kanban_funnels`
- `kanban_columns`
- `kanban_cards`
- `kanban_card_links`
- `kanban_attachments`
- `kanban_cards_archive`

`kanban_attachments.storage_path` deve bater com objetos do bucket `kanban-attachments`.

### 6. Notas e sticky

- `notes`
- `note_categories`
- `sticky_notes`
- `gratitude_entries`

Notas/sticky dependem de usuarios e workspaces; gratitude e pessoal por usuario.

### 7. Arquivos e Storage metadata

- `files_folders`
- `files_items`
- `disco_projects`
- `disco_tracks`
- `disco_versions`
- `disco_comments`

`files_items.storage_path` e `disco_versions.storage_path` devem bater com objetos no bucket `files`.

### 8. Financas

- `finance_categories`
- `finance_transactions`
- `finance_costs`
- `finance_products`
- `pfin_accounts`
- `pfin_categories`
- `pfin_transactions`
- `pfin_goals`

As tabelas `finance_*` sao por workspace. As tabelas `pfin_*` sao por usuario.

### 9. Estoque

- `stock_companies`
- `stock_groups`
- `stock_categories`
- `stock_field_defs`
- `stock_items`
- `stock_movements`

Preservar ordem, campos dinamicos e vinculos por empresa/categoria/grupo.

### 10. Relatorios e operacao

- `completion_reports`
- `calendar_events`
- `crm_leads`

Relatorios dependem de usuario e workspace.

### 11. Tendencias

- `trends_seasonalities`
- `trends_hype`
- `trends_opportunities`

Dependem de workspace e podem gerar acoes para checklist/kanban/calendario.

### 12. Compartilhamento

- `shared_items`
- `shared_item_comments`
- `shared_item_activity`

Migrar por ultimo, pois referencia workspaces de origem/destino, usuarios e itens compartilhados.

## Campos sensiveis por tipo

- `user_id`: quase todos os modulos operacionais, ponto, checklist, financas, estoque, tendencias, notas, shared comments/activity.
- `owner_id`: `workspaces`.
- `created_by`: `files_folders`, `files_items`, `disco_projects`, `disco_tracks`, `disco_versions`.
- `author_id`: `disco_comments`.
- `workspace_id`: tabelas operacionais por workspace.
- `source_workspace_id` e `target_workspace_id`: `shared_items`.
- `shared_by_user_id`: `shared_items`.

## Comandos preparados, nao executar automaticamente

Exemplo de dump somente dados do schema public:

```bash
pg_dump "$SOURCE_DATABASE_URL" \
  --data-only \
  --schema=public \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=pubcore-public-data.dump
```

Exemplo de dump de Auth:

```bash
pg_dump "$SOURCE_DATABASE_URL" \
  --data-only \
  --schema=auth \
  --table=auth.users \
  --table=auth.identities \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=pubcore-auth-data.dump
```

Exemplo de restore em destino ja preparado:

```bash
pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  pubcore-auth-data.dump

pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  pubcore-public-data.dump
```

Observacao: `--disable-triggers` exige permissao elevada. Se indisponivel no Supabase remoto, importar por ordem de dependencia e validar constraints/RLS manualmente.

## Scripts auxiliares

Os scripts ficam em `scripts/migration/` e sao read-only:

```bash
SOURCE_DATABASE_URL="postgresql://..." node scripts/migration/count-records.mjs source reports/source-counts.json
TARGET_DATABASE_URL="postgresql://..." node scripts/migration/count-records.mjs target reports/target-counts.json
node scripts/migration/compare-counts.mjs reports/source-counts.json reports/target-counts.json

SOURCE_DATABASE_URL="postgresql://..." node scripts/migration/list-storage-expected.mjs source reports/source-storage.json
TARGET_DATABASE_URL="postgresql://..." node scripts/migration/list-storage-expected.mjs target reports/target-storage.json

TARGET_DATABASE_URL="postgresql://..." node scripts/migration/detect-orphans.mjs target reports/target-orphans.json
```

## Estrategia de Storage

Buckets obrigatorios:

- `files`
- `kanban-attachments`

Metadata no banco:

- `files_items.storage_path` aponta para objetos em `files`.
- `disco_versions.storage_path` aponta para objetos em `files`.
- `kanban_attachments.storage_path` aponta para objetos em `kanban-attachments`.

Fluxo recomendado:

1. Listar metadata esperada no banco origem com `list-storage-expected.mjs source`.
2. Copiar objetos reais do Storage antigo para o novo preservando exatamente `bucket_id` e `name/storage_path`.
3. Listar metadata/objetos no destino com `list-storage-expected.mjs target`.
4. Conferir `missingObjects` e `orphanObjects`.
5. Testar downloads e signed URLs pelo app.

Opcoes de copia:

- Supabase Storage API com service role temporaria.
- S3 protocol, se habilitado nos dois projetos.
- Script dedicado posterior com streaming arquivo a arquivo, retries e log de falhas.

Nao alterar `storage_path` nos metadados para "facilitar" copia; isso quebraria links historicos.

## Riscos principais

- Auth: se `auth.users.id` mudar, todo historico fica orfao.
- Usuario de teste no destino: pode criar workspace automatico, e-mail duplicado ou role divergente. Remover antes da importacao se nao fizer parte do legado.
- Workspaces: `workspace_members` e `user_roles` precisam ser restaurados antes de validar RLS.
- Ponto: sessoes antigas com status ativo podem sofrer interferencia de jobs/funcoes de fechamento automatico. Validar status antes e depois.
- Checklist: `checklist_daily_completions` e `ponto_session_tasks` preservam historico; nao recriar por seed.
- Storage: migrar metadata sem objetos reais deixa arquivos quebrados.
- Compartilhamento: `shared_items` referencia dois workspaces; migrar antes dos workspaces completos cria orfaos.
- RLS: durante importacao, service role/restore deve ser usado. Testes finais devem ser feitos como usuarios reais.

## Checklist de validacao

- Contagens origem/destino iguais para `auth.users` e `auth.identities`.
- Contagens iguais para todas as tabelas `public`.
- `detect-orphans.mjs target` sem orfaos.
- Buckets `files` e `kanban-attachments` existem no destino.
- `list-storage-expected.mjs target` sem `missingObjects`.
- Usuario master consegue entrar.
- Usuario comum consegue entrar apenas nos seus workspaces.
- Workspaces aparecem com membros e roles corretos.
- Checklist abre com empresas, tarefas e conclusoes historicas.
- Ponto mostra historico e nao duplica sessoes.
- Kanban abre funis, colunas, cards e anexos.
- Central de Arquivos baixa arquivos.
- Discografia baixa versoes/audio.
- Financas, estoque, tendencias e relatorios mostram dados esperados.
- Realtime `postgres_changes` funciona em pelo menos checklist/kanban/arquivos.

## Estrategia de rollback

Antes de importar:

1. Manter o Supabase antigo intacto e somente leitura operacional.
2. Criar dumps versionados do banco antigo.
3. Exportar inventario de Storage do antigo.
4. Criar snapshot/backup do novo Supabase antes do restore, se ja houver dados.

Se a migracao falhar:

1. Nao apontar producao para o novo Supabase.
2. Preservar logs e reports gerados.
3. Recriar o projeto/banco destino ou restaurar snapshot anterior.
4. Corrigir causa em ambiente local.
5. Repetir importacao do zero.

Rollback de aplicacao:

- Reverter variaveis de ambiente do deploy para o Supabase antigo apenas se o antigo ainda estiver operavel.
- Nao misturar escrita simultanea nos dois bancos.

