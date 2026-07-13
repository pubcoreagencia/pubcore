\# PUB CORE — AGENTS.md



\## Projeto

PUB CORE é uma central de operação empresarial da holding PUB.



\## Stack

\- Vite

\- React

\- TypeScript

\- Supabase

\- Supabase Storage

\- Tailwind/shadcn, se presente



\## Regras críticas

\- Não recriar módulos do zero sem necessidade.

\- Não apagar dados reais.

\- Não alterar `.env` ou expor secrets.

\- Não quebrar integrações com Supabase.

\- Preservar workspaces, histórico, pontos e arquivos.

\- Corrigir bugs com mudanças pequenas e seguras.

\- Qualquer CRUD deve atualizar a interface sem refresh.

\- Kanban e Checklist podem estar na mesma aba, mas os dados devem continuar separados.

\- Histórico deve ser agrupado por dia operacional, não por ponto individual.

\- Empresas principais geram ponto; subempresas não geram ponto.

\- Central de Arquivos deve gerar signed URL no momento da abertura.



\## Comandos

\- Instalar: `npm install`

\- Rodar local: `npm run dev`

\- Build: `npm run build`



\## Prioridades atuais

1\. Corrigir Histórico, Bater Ponto e Checklist.

2\. Corrigir Central de Arquivos.

3\. Corrigir card órfão do Kanban com coluna inexistente.

4\. Melhorar atualização instantânea da UI.

5\. Melhorar responsividade mobile.

6\. Otimizar performance geral.

