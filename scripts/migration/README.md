# PUB CORE migration scripts

These helpers are read-only. They do not dump data, restore data, delete rows, or copy Storage files by themselves.

Required local dependency:

- `psql` available in PATH; or
- Docker with a running PostgreSQL container and `MIGRATION_PSQL_DOCKER_CONTAINER` set.

Environment variables are intentionally explicit:

- `SOURCE_DATABASE_URL` for the old Lovable Supabase database.
- `TARGET_DATABASE_URL` for the new PUB CORE Supabase database.
- `SOURCE_SUPABASE_URL` for the old Lovable Supabase API URL.
- `SOURCE_SERVICE_ROLE_KEY` for read/admin API checks against the old project.
- `MIGRATION_PSQL_DOCKER_CONTAINER` optional fallback when Windows does not have local `psql`.

## Como localizar credenciais da origem

Project ref antigo conhecido: `owimmytcffoovmokbple`.

Procure as credenciais da origem sem commitar ou colar secrets no repositorio:

- Lovable project settings: variaveis Supabase antigas, integrações ou seção de backend/database.
- Supabase dashboard antigo, se houver acesso direto ao projeto gerenciado pelo Lovable.
- Arquivos de deploy/hosting antigos fora do git, secrets manager ou painel Cloudflare.
- Export SQL baixado do painel Lovable/Supabase, quando acesso direto ao banco nao existir.
- Historico local da maquina apenas com cuidado: nao copie secrets para docs, issues, commits ou mensagens.

Credenciais suficientes por tipo de migracao:

- `DATABASE_URL`: suficiente para contagens, dumps SQL com `pg_dump`, restore controlado, validacao de orfaos e inventario de metadata. E a credencial mais completa para migrar banco preservando UUIDs.
- `service_role key`: suficiente para ler dados via Supabase API, listar usuarios via Auth Admin API e copiar Storage via API. Nao substitui perfeitamente `DATABASE_URL` para dump/restore completo de `auth` e schema.
- `anon key`: suficiente apenas para testar API publica/RLS como cliente anonimo. Nao e suficiente para migracao real.
- Acesso ao painel Lovable: pode ser suficiente para localizar URL, anon key, service role, export SQL ou ferramenta de export. Depende do que o Lovable expuser no projeto antigo.
- Export SQL: pode ser suficiente para migrar dados se incluir `auth`, `public` e metadata de `storage`. Nao migra arquivos reais do Storage; os objetos precisam ser copiados separadamente.

## Testes seguros de acesso a origem

Os testes abaixo nao rodam automaticamente e nao imprimem secrets.

Teste read-only via PostgreSQL:

```bash
SOURCE_DATABASE_URL="postgresql://..." node scripts/migration/test-source-db.mjs
```

Teste read-only via Supabase API:

```bash
SOURCE_SUPABASE_URL="https://owimmytcffoovmokbple.supabase.co" \
SOURCE_SERVICE_ROLE_KEY="..." \
node scripts/migration/test-source-api.mjs
```

No PowerShell, prefira definir variaveis so para a sessao:

```powershell
$env:SOURCE_DATABASE_URL = "postgresql://..."
node scripts/migration/test-source-db.mjs
Remove-Item Env:\SOURCE_DATABASE_URL
```

```powershell
$env:SOURCE_SUPABASE_URL = "https://owimmytcffoovmokbple.supabase.co"
$env:SOURCE_SERVICE_ROLE_KEY = "..."
node scripts/migration/test-source-api.mjs
Remove-Item Env:\SOURCE_SUPABASE_URL
Remove-Item Env:\SOURCE_SERVICE_ROLE_KEY
```

## Fallback via Docker para psql

Se o Windows nao tiver `psql` instalado, mas houver um container PostgreSQL rodando, defina:

```powershell
$env:MIGRATION_PSQL_DOCKER_CONTAINER = "pubcore-restore-test"
```

Com isso, os scripts que usam PostgreSQL executam:

```text
docker exec <container> psql ...
```

Exemplos:

```powershell
$env:MIGRATION_PSQL_DOCKER_CONTAINER = "pubcore-restore-test"
$env:TARGET_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
node scripts/migration/count-records.mjs target reports/restored-local-counts.json
node scripts/migration/detect-orphans.mjs target reports/restored-local-orphans.json
Remove-Item Env:\TARGET_DATABASE_URL
Remove-Item Env:\MIGRATION_PSQL_DOCKER_CONTAINER
```

Observacao: quando o script roda via `docker exec`, a URL do banco deve fazer sentido de dentro do container. Para o container `pubcore-restore-test`, normalmente use host `127.0.0.1` e porta interna `5432`.

Examples:

```bash
SOURCE_DATABASE_URL="postgresql://..." node scripts/migration/count-records.mjs source reports/source-counts.json
TARGET_DATABASE_URL="postgresql://..." node scripts/migration/count-records.mjs target reports/target-counts.json
node scripts/migration/compare-counts.mjs reports/source-counts.json reports/target-counts.json

SOURCE_DATABASE_URL="postgresql://..." node scripts/migration/list-storage-expected.mjs source reports/source-storage.json
TARGET_DATABASE_URL="postgresql://..." node scripts/migration/list-storage-expected.mjs target reports/target-storage.json

TARGET_DATABASE_URL="postgresql://..." node scripts/migration/detect-orphans.mjs target reports/target-orphans.json
```
