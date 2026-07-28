# PUB CORE - AGENTS.md

## Projeto
PUB CORE e uma central de operacao empresarial da holding PUB. O projeto foi criado originalmente no Lovable e agora deve ser mantido localmente com Codex, preservando os dados e fluxos existentes.

## Stack real
- Vite
- React
- TypeScript
- TanStack Router/Start
- Supabase
- Supabase Storage
- Cloudflare/Nitro
- Tailwind CSS
- shadcn/Radix UI
- Recharts
- dnd-kit
- jsPDF, html2canvas, html-to-image e JSZip

## Comandos reais
- Instalar dependencias: `npm install`
- Rodar localmente: `npm run dev`
- Build de producao: `npm run build`
- Preview local do build: `npm run preview`
- Lint: `npm run lint`
- Formatacao: `npm run format`

## Branch e package manager
- Branch de retomada/migracao: `codex-migration`.
- Use `npm` como gerenciador padrao.
- Nao remover `bun.lockb` ainda, mas nao usar Bun para novas rotinas sem decisao explicita.

## Regras criticas de desenvolvimento
- Nao recriar modulos do zero sem necessidade.
- Nao apagar dados reais.
- Nao alterar `.env` nem expor secrets.
- Nao quebrar integracoes com Supabase.
- Nao alterar migrations ou configuracao Supabase sem tarefa explicita.
- Preservar workspaces, usuarios, permissoes, historico, pontos e arquivos.
- Fazer mudancas pequenas, seguras e testaveis.
- Apos mudancas relevantes, rodar `npm run build`.
- Antes de alterar rotas grandes, ler o modulo inteiro e entender os efeitos em providers globais.

## Modulos sensiveis
- Workspaces: `src/lib/workspace.tsx`
- Autenticacao: `src/lib/auth.tsx`
- Ponto: `src/lib/ponto.tsx`
- Checklist: `src/lib/checklist-store.tsx`
- Empresas: `src/lib/checklist-companies.tsx`
- Kanban: `src/routes/app.kanban.tsx`
- Central de Arquivos: `src/routes/app.files.tsx`
- Financas: `src/routes/app.finance.tsx`
- Estoque: `src/routes/app.stock.tsx`
- Discografia: `src/routes/app.discography.tsx`
- Auditoria server-side: `src/lib/audit.functions.ts`

## Prioridades gerais
- Melhorar estabilidade.
- Melhorar responsividade mobile.
- Reduzir gargalos de performance.
- Garantir atualizacao instantanea da interface.
- Melhorar UX das ferramentas principais.
- Manter a PUB CORE com aparencia profissional de central operacional empresarial.

## Observacoes tecnicas
- O build atual ja passou anteriormente, mas ha warnings de chunks grandes.
- Rotas monoliticas concentram muita logica de UI, dados e estado.
- Otimizacoes futuras devem priorizar code splitting, lazy loading e isolamento de bibliotecas pesadas como `jspdf`, `html2canvas`, `jszip`, `recharts` e `@dnd-kit`.
