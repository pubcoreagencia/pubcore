# PUB CORE - Restore a partir do backup Lovable

Backup recebido:

```text
C:\Users\lu\pubcore-migration-export\pubcore_260730.backup
```

TOC analisado:

```text
C:\Users\lu\pubcore-migration-export\backup_toc.txt
```

O backup nao deve ser commitado no repositorio.

## Diagnostico do backup

O `backup_toc.txt` indica:

- Formato: `CUSTOM`
- Compressao: `zstd`
- Dump criado em: `2026-07-30 19:50:15 UTC`
- Database origem: `postgres`
- Versao origem: PostgreSQL `17.6`
- Versao do `pg_dump`: `18.4`
- TOC entries: `1313`

Schemas presentes no TOC incluem `auth`, `public`, `storage`, `realtime`, `cron`, `extensions`, `vault` e schemas internos Supabase.

Entradas `TABLE DATA` criticas confirmadas:

- `auth.users`
- `auth.identities`
- `public.profiles`
- `public.workspaces`
- `public.workspace_members`
- `public.user_roles`
- `public.ponto_sessions`
- `public.ponto_session_tasks`
- `public.ponto_session_edits`
- `public.kanban_funnels`
- `public.kanban_columns`
- `public.kanban_cards`
- `public.kanban_card_links`
- `public.kanban_attachments`
- `public.files_folders`
- `public.files_items`
- `storage.buckets`
- `storage.objects`

Tambem ha dados dos modulos Checklist, Financas, Estoque, Discografia, Relatorios, Tendencias, Compartilhamento, Notas, Sticky notes, Calendario e CRM.

## Estrategia recomendada

Nao restaurar o backup completo diretamente no Supabase novo como primeira acao.

O backup completo contem schemas internos gerenciados pelo Supabase, como `auth`, `storage`, `realtime`, `cron`, `vault`, `graphql`, `extensions` e `supabase_migrations`. Restaurar tudo em cima de um projeto Supabase novo pode conflitar com objetos internos ja existentes, owners, ACLs, extensoes, realtime partitions e migrations metadata.

Estrategia mais segura:

1. Restaurar primeiro em banco temporario/local para inventario e contagens.
2. Comparar schema/dados do backup com as migrations atuais da PUB CORE.
3. No Supabase novo, manter o schema criado pelas migrations ja validadas.
4. Fazer restore seletivo/data-only dos dados necessarios, preservando UUIDs.
5. Importar `auth.users` e `auth.identities` antes de `public`.
6. Importar `storage.buckets` e `storage.objects` como metadata, mas copiar arquivos fisicos separadamente.

## Opcoes de restore

### Backup completo

Uso recomendado: apenas em banco temporario/local.

Vantagem: reproduz o estado Lovable com mais fidelidade para analise.

Risco: no Supabase novo real, pode sobrescrever/conflitar com schemas internos gerenciados pelo Supabase.

### Data-only

Uso recomendado: principal caminho para o Supabase novo.

Vantagem: preserva o schema novo ja aplicado por migrations e importa apenas dados.

Risco: exige ordem correta e banco destino limpo de dados de teste conflitantes.

### Schemas seletivos

Uso recomendado: sim, mas com cuidado:

- `auth`: necessario para preservar usuarios e UUIDs.
- `public`: necessario para dados operacionais.
- `storage`: necessario para buckets e metadata de objetos.

Evitar restore remoto de `realtime`, `cron`, `vault`, `graphql`, `extensions` e `supabase_migrations` sem uma razao explicita.

### Banco temporario primeiro

Uso recomendado: obrigatorio antes do restore real.

Ele permite extrair contagens, detectar orfaos e validar o comportamento do dump sem tocar no Supabase novo.

## Preparacao antes do restore real

1. Confirmar que o app local funciona contra o novo Supabase.
2. Confirmar que as migrations aplicam limpo.
3. Criar backup/snapshot do Supabase novo antes de qualquer restore real.
4. Remover usuario de teste e workspace automatico do novo Supabase, se esse usuario nao existir no backup Lovable com o mesmo UUID.
5. Confirmar que nao ha usuarios reais escrevendo no Supabase antigo durante janela de migracao.
6. Baixar/inventariar arquivos fisicos dos buckets antigos.

## Usuario de teste no Supabase novo

O usuario de teste provavelmente deve ser removido antes da importacao final.

Motivos:

- Pode haver conflito por e-mail em `auth.users`.
- O trigger de novo usuario pode ter criado `profiles`, `workspaces`, `workspace_members` e `user_roles`.
- As contagens destino ficarao maiores que a origem.
- RLS pode mostrar workspace extra para o usuario de teste.

Nao remover manualmente sem backup/snapshot do destino. A limpeza deve apagar em cascata o usuario e os dados automaticos associados, ou recriar o projeto destino limpo antes da importacao.

## Comandos seguros com Docker postgres:latest

Validar lista do archive:

```powershell
docker run --rm -v "C:/Users/lu/pubcore-migration-export:/backup:ro" postgres:latest pg_restore --list "/backup/pubcore_260730.backup"
```

Gerar um TOC novo, se necessario:

```powershell
docker run --rm -v "C:/Users/lu/pubcore-migration-export:/backup:ro" postgres:latest pg_restore --list "/backup/pubcore_260730.backup" > C:\Users\lu\pubcore-migration-export\backup_toc.txt
```

Subir banco temporario:

```powershell
docker run --name pubcore-restore-test -e POSTGRES_PASSWORD=postgres -p 55432:5432 -d postgres:latest
```

Restaurar backup completo apenas no banco temporario:

```powershell
docker run --rm --network host -v "C:/Users/lu/pubcore-migration-export:/backup:ro" postgres:latest pg_restore --verbose --clean --if-exists --no-owner --no-privileges --dbname "postgresql://postgres:postgres@127.0.0.1:55432/postgres" "/backup/pubcore_260730.backup"
```

Contar registros no banco temporario restaurado:

```powershell
$env:TARGET_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:55432/postgres"
node scripts/migration/count-records.mjs target reports/restored-local-counts.json
Remove-Item Env:\TARGET_DATABASE_URL
```

Parar banco temporario:

```powershell
docker rm -f pubcore-restore-test
```

Gerar comandos sem executar:

```powershell
node scripts/migration/restore/prepare-local-restore.mjs
```

## Comandos preparados para restore real

Nao executar antes de snapshot do Supabase novo e revisao final.

Exemplo de restore data-only seletivo para destino:

```powershell
pg_restore --verbose --data-only --no-owner --no-privileges --disable-triggers --schema=auth --table=auth.users --table=auth.identities --dbname "$env:TARGET_DATABASE_URL" "C:\Users\lu\pubcore-migration-export\pubcore_260730.backup"
```

```powershell
pg_restore --verbose --data-only --no-owner --no-privileges --disable-triggers --schema=public --dbname "$env:TARGET_DATABASE_URL" "C:\Users\lu\pubcore-migration-export\pubcore_260730.backup"
```

```powershell
pg_restore --verbose --data-only --no-owner --no-privileges --disable-triggers --schema=storage --table=storage.buckets --table=storage.objects --dbname "$env:TARGET_DATABASE_URL" "C:\Users\lu\pubcore-migration-export\pubcore_260730.backup"
```

Observacao: `--disable-triggers` pode exigir permissao elevada. Se nao funcionar no Supabase remoto, preparar restore por lista filtrada e ordem de dependencia.

## Scripts auxiliares

```powershell
node scripts/migration/restore/validate-backup.mjs
node scripts/migration/restore/list-backup-contents.mjs
node scripts/migration/restore/list-table-data.mjs
node scripts/migration/restore/list-table-data.mjs --json
node scripts/migration/restore/prepare-local-restore.mjs
node scripts/migration/restore/compare-after-restore.mjs reports/source-counts.json reports/restored-local-counts.json
```

## Storage

`storage.buckets` e `storage.objects` sao metadata no banco.

Eles nao garantem que os arquivos fisicos dos buckets foram incluidos no export do Lovable. Para a PUB CORE, os buckets criticos sao:

- `files`
- `kanban-attachments`

Os arquivos reais precisam ser baixados do Storage antigo e enviados ao Storage novo preservando exatamente os paths:

- `files_items.storage_path`
- `disco_versions.storage_path`
- `kanban_attachments.storage_path`

Depois da copia, rodar:

```powershell
$env:TARGET_DATABASE_URL = "postgresql://..."
node scripts/migration/list-storage-expected.mjs target reports/target-storage.json
Remove-Item Env:\TARGET_DATABASE_URL
```

O resultado deve ter `missingObjects` vazio.

## Checklist pos-restore

- Login funciona com usuario migrado.
- `auth.users.id` bate com `profiles.id`.
- `profiles.status` e preferencias estao corretos.
- Workspaces aparecem corretamente.
- `workspace_members` preserva membros e roles.
- `user_roles` preserva master/user.
- Checklists carregam empresas, tarefas e conclusoes diarias.
- Ponto mostra historico, sessoes, tarefas e edicoes.
- Kanban mostra funis, colunas, cards, links e anexos.
- Central de Arquivos lista pastas e arquivos.
- Buckets `files` e `kanban-attachments` existem.
- `storage.objects` contem metadata esperada.
- Arquivos reais baixam por signed URL.
- Discografia mostra projetos, faixas, versoes e comentarios.
- Financas, estoque, relatorios, tendencias e compartilhamento carregam dados.
- Usuario comum nao enxerga workspace alheio.
- Usuario master consegue operar administracao esperada.

## Riscos antes do restore real

- Restaurar schema interno completo pode conflitar com Supabase gerenciado.
- Usuario de teste no destino pode gerar conflito de e-mail/UUID e workspace extra.
- Dados public sem Auth preservado viram orfaos.
- Storage metadata sem arquivos reais gera links quebrados.
- Import parcial de `shared_items` pode quebrar compartilhamentos entre workspaces.
- `cron` e funcoes de ponto podem agir sobre sessoes migradas; validar status de sessoes ativas.
- `storage.objects.owner` pode referenciar usuarios antigos; preservar `auth.users` antes.
- O backup tem metadata de realtime messages particionadas; nao migrar isso para o destino salvo necessidade comprovada.

## Rollback

Antes do restore real:

1. Snapshot/backup do Supabase novo.
2. Backup preservado do Lovable Cloud.
3. Inventario de Storage antigo.
4. Relatorios de contagem origem/local.

Se falhar:

1. Nao apontar producao para o novo Supabase.
2. Restaurar snapshot do novo ou recriar destino limpo.
3. Corrigir o processo em banco temporario.
4. Reexecutar importacao do zero.

