# PUB CORE - Development

## Ambiente local
Use Node.js com npm. O projeto contem `package-lock.json` e tambem `bun.lockb`, mas a recomendacao atual e usar npm para evitar divergencia de lockfile.

## Instalar dependencias
```bash
npm install
```

## Rodar localmente
```bash
npm run dev
```

O projeto ja rodou localmente com esse comando. A porta/host podem ser definidos pela configuracao do Lovable/Vite.

## Build de producao
```bash
npm run build
```

O build ja passou anteriormente, mas ha warnings de chunks grandes. Apos mudancas relevantes em codigo, UI, rotas, providers, Supabase client ou configuracao, rode o build novamente.

## Preview local
```bash
npm run preview
```

## Lint e formatacao
```bash
npm run lint
npm run format
```

## Branch recomendada
A branch usada para migracao/retomada e:

```bash
codex-migration
```

Novas mudancas devem partir dessa linha, salvo decisao explicita do mantenedor.

## Cuidados com `.env`
- Nao alterar `.env` sem pedido explicito.
- Nao copiar secrets para documentacao, commits, logs ou mensagens.
- Variaveis Supabase esperadas no codigo:
  - `VITE_SUPABASE_URL` ou `SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` ou `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor, para operacoes administrativas confiaveis.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no client.

## Padrao de commits
Use commits pequenos, descritivos e focados em uma mudanca por vez.

Sugestoes de prefixos:
- `docs:` documentacao
- `fix:` correcao funcional
- `feat:` nova funcionalidade
- `refactor:` reorganizacao sem mudanca de comportamento
- `perf:` melhoria de performance
- `chore:` manutencao de tooling/config

Exemplos:
```bash
docs: document project recovery architecture
fix: preserve workspace selection on reload
perf: lazy load finance charts
```

## Regras para evoluir com seguranca
- Antes de mexer em rotas grandes, leia o arquivo inteiro e identifique as tabelas usadas.
- Prefira mudancas pequenas e testaveis.
- Nao recrie modulos do zero sem necessidade.
- Nao altere migrations Supabase sem tarefa especifica.
- Nao remova `bun.lockb` ainda.
- Nao altere `.env`.
- Apos mudancas relevantes, rode `npm run build`.

## Arquivos que merecem cuidado extra
- `src/routes/app.checklists.tsx`
- `src/routes/app.stock.tsx`
- `src/routes/app.finance.tsx`
- `src/routes/app.kanban.tsx`
- `src/routes/app.trends.tsx`
- `src/routes/app.discography.tsx`
- `src/routes/app.files.tsx`
- `src/lib/workspace.tsx`
- `src/lib/ponto.tsx`
- `src/lib/checklist-store.tsx`
- `src/lib/audit.functions.ts`
