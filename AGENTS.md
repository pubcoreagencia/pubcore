# PUB CORE — AGENTS.md

## Projeto
PUB CORE é uma central de operação empresarial da holding PUB, criada originalmente no Lovable e agora migrada para desenvolvimento com Codex.

## Stack
- Vite
- React
- TypeScript
- TanStack Router/Start
- Supabase
- Supabase Storage
- Cloudflare/Nitro
- Tailwind/shadcn quando aplicável

## Comandos
- Instalar dependências: `npm install`
- Rodar localmente: `npm run dev`
- Build de produção: `npm run build`

## Regras de desenvolvimento
- Não recriar módulos do zero sem necessidade.
- Não apagar dados reais.
- Não alterar `.env` nem expor secrets.
- Não quebrar integrações com Supabase.
- Preservar workspaces, usuários, permissões, histórico, pontos e arquivos.
- Fazer mudanças pequenas, seguras e testáveis.
- Após mudanças relevantes, rodar `npm run build`.

## Prioridades gerais
- Melhorar estabilidade.
- Melhorar responsividade mobile.
- Reduzir gargalos de performance.
- Garantir atualização instantânea da interface.
- Melhorar UX das ferramentas principais.
- Manter a PUB CORE com aparência profissional de central operacional empresarial.

## Observações técnicas
O build atual passa, mas há warnings de chunks grandes. Futuramente otimizar code-splitting, lazy loading e carregamento de bibliotecas pesadas como jspdf, html2canvas e recharts.