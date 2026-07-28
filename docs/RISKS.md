# PUB CORE - Risks

## Objetivo
Este documento lista riscos tecnicos aparentes antes de evoluir a PUB CORE fora do Lovable. Ele deve ser consultado antes de alterar rotas, providers, Supabase, Storage ou fluxos criticos.

## Arquivos grandes e sensiveis
Rotas grandes concentram UI, estado, queries Supabase, realtime e regras de negocio.

Arquivos mais sensiveis:
- `src/routes/app.checklists.tsx`
- `src/routes/app.stock.tsx`
- `src/routes/app.finance.tsx`
- `src/routes/app.kanban.tsx`
- `src/routes/app.trends.tsx`
- `src/routes/app.discography.tsx`
- `src/routes/app.files.tsx`
- `src/routes/app.notes.tsx`
- `src/routes/app.personal-finance.tsx`
- `src/routes/app.completion-reports.tsx`

Risco: alteracoes locais podem causar regressao em comportamento distante dentro do mesmo arquivo.

Mitigacao: fazer mudancas pequenas, ler imports/efeitos/hooks antes de editar, validar com build e testar manualmente a rota afetada.

## Riscos de workspace
O workspace ativo e central para quase todos os modulos autenticados.

Pontos sensiveis:
- `src/lib/workspace.tsx`
- `workspaces`
- `workspace_members`
- `user_roles`
- `profiles`
- `localStorage` key `pubcore_active_workspace`

Riscos:
- Misturar dados entre workspaces.
- Master visualizar/alterar workspace errado.
- Realtime atualizar dados fora do workspace ativo.
- Criacao ou troca de workspace afetar providers filhos.

Mitigacao: qualquer query nova deve filtrar por `workspace_id` quando o dominio for multiworkspace.

## Riscos de ponto e checklist
Ponto e checklist estao fortemente acoplados.

Pontos sensiveis:
- `src/lib/ponto.tsx`
- `src/lib/checklist-store.tsx`
- `ponto_sessions`
- `ponto_session_tasks`
- `checklist_tasks`
- `checklist_daily_completions`

Riscos:
- Sessao de ponto ficar aberta indevidamente.
- Pausas e encerramentos calcularem tempos errados.
- Checklist resetar ou historizar conclusoes no dia errado.
- Tarefas concluidas nao serem vinculadas a sessao de ponto ativa.
- Estado local divergir do Supabase em multiplas abas/dispositivos.

Mitigacao: testar fluxo start/pause/resume/end, checklist done/undone e troca de empresa/workspace antes de entregar mudancas.

## Riscos de Supabase/RLS
O projeto depende de RLS, policies por usuario/workspace e algumas RPCs.

Riscos:
- Policies antigas ou novas ficarem permissivas demais.
- Mudancas em tabelas quebrarem tipos gerados em `src/integrations/supabase/types.ts`.
- Uso indevido de service role no client.
- RPCs de cascata afetarem dados alem do esperado.

Pontos de atencao:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`
- `src/integrations/supabase/auth-middleware.ts`
- `src/lib/audit.functions.ts`
- `supabase/migrations`

Mitigacao: nao alterar migrations/RLS sem tarefa explicita; se alterar, revisar o estado real no Supabase remoto e testar com usuario comum e master.

## Riscos de Storage
Buckets usados:
- `files`
- `kanban-attachments`

Riscos:
- Objeto removido do Storage mas registro permanecer na tabela.
- Registro removido mas objeto permanecer no bucket.
- Signed URL expirar ou ser usado em contexto errado.
- Path de Storage nao respeitar workspace/usuario.
- Policies de `storage.objects` permitirem acesso indevido.

Modulos afetados:
- Central de Arquivos
- Discografia
- Kanban Attachments

Mitigacao: em mudancas de arquivos/anexos, testar upload, download, preview, rename/move quando aplicavel e delete.

## Riscos de performance
Gargalos aparentes:
- Rotas monoliticas grandes.
- Imports diretos de bibliotecas pesadas como `recharts` em algumas rotas.
- Consultas com limites altos, como milhares de sessoes/tarefas.
- Realtime que recarrega listas completas.
- Widgets globais montados em todo `/app`.

Mitigacao:
- Introduzir lazy loading por rota/componente pesado.
- Manter imports dinamicos para PDF/ZIP.
- Preferir queries filtradas e paginadas.
- Evitar recarregar colecoes completas em cada evento realtime quando o volume crescer.

## Riscos de mexer em rotas monoliticas
Rotas grandes nao devem ser reescritas de uma vez.

Riscos:
- Perder comportamento de formularios, filtros e estados transitorios.
- Quebrar responsividade mobile.
- Quebrar realtime ou optimistic UI.
- Introduzir regressao em modulos compartilhados.

Mitigacao:
- Extrair codigo em etapas pequenas.
- Primeiro mover funcoes puras ou componentes isolados.
- Manter assinaturas e comportamento.
- Rodar `npm run build`.
- Fazer teste manual da rota antes e depois.

## Risco de dependencia Lovable
O projeto ainda usa configuracao e auth do Lovable.

Pontos sensiveis:
- `@lovable.dev/vite-tanstack-config`
- `@lovable.dev/cloud-auth-js`
- `src/integrations/lovable/index.ts`
- `vite.config.ts`

Risco: remover ou duplicar configuracao pode quebrar build, auth ou server entry.

Mitigacao: nao substituir a configuracao Lovable sem uma etapa dedicada de desacoplamento.
