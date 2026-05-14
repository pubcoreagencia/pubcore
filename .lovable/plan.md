# Refatoração: PUB CORE → Plataforma Multi-Workspace

Transformar a PUB CORE numa arquitetura inspirada no Lovable, com workspaces isolados, hierarquia de papéis (MASTER, WORKSPACE_ADMIN, MEMBER) e um painel global MASTER.

---

## 1. Banco de dados (Supabase)

### Novas tabelas
- **`workspaces`** — `id`, `name`, `slug`, `owner_id`, `created_at`
- **`workspace_members`** — `id`, `workspace_id`, `user_id`, `role` (`admin` | `member`), `created_at`. Único por (workspace_id, user_id).
- **`app_roles`** (enum global): `master`, `user`
- **`user_roles`** — `id`, `user_id`, `role app_role` (segue o padrão de segurança recomendado, separado de `profiles`)

### Funções `SECURITY DEFINER`
- `has_app_role(_user_id uuid, _role app_role) returns boolean` — checa MASTER global
- `is_workspace_member(_workspace_id uuid, _user_id uuid) returns boolean`
- `is_workspace_admin(_workspace_id uuid, _user_id uuid) returns boolean`
- `current_workspace_id()` — lê de `auth.jwt()` claim opcional, fallback ao primeiro workspace do usuário

### Migração das tabelas existentes
Adicionar coluna `workspace_id uuid not null` em:
`notes`, `note_categories`, `checklist_tasks`, `kanban_columns`, `kanban_cards`, `crm_leads`, `calendar_events`, `ponto_sessions`, `ponto_session_tasks`, `activity_log`.

Backfill: para cada `user_id` distinto, criar um workspace pessoal (`{display_name}'s Workspace`), inserir `workspace_members` como `admin`, e atribuir esse `workspace_id` a todas as linhas existentes daquele usuário.

### RLS — substituir políticas atuais
Para todas as tabelas operacionais, política nova:
```
USING (
  is_workspace_member(workspace_id, auth.uid())
  OR has_app_role(auth.uid(), 'master')
)
```
Mutações: idem + checagem em `WITH CHECK`. MASTER vê e edita tudo.

### Bootstrap
- Trigger `handle_new_user` estendido: cria profile + workspace pessoal + membership `admin` + role `user`.
- Seed manual: promover o primeiro usuário (ou um e-mail informado) a `master` via `supabase--insert`.

---

## 2. Camada de aplicação

### Novo store: `src/lib/workspace.tsx`
Context provider `WorkspaceProvider` que:
- Carrega workspaces do usuário + role global (`master` ou `user`)
- Persiste workspace ativo em `localStorage` (`pubcore_active_workspace`)
- Expõe `{ workspaces, activeWorkspace, setActiveWorkspace, role, isMaster, isWorkspaceAdmin, refresh }`
- Realtime nas tabelas `workspaces` e `workspace_members`

Montar dentro de `src/routes/app.tsx`, **acima** dos providers existentes (Ponto, Checklist).

### Refatorar acesso a dados
Todos os `supabase.from(...).select()` / `.insert()` nas stores e rotas (`operations.tsx`, `checklist-store.tsx`, `app.notes.tsx`, `app.kanban.tsx`, `app.calendar.tsx`, `app.crm.tsx`, `ponto.tsx`, `activity-log.ts`) passam a:
- filtrar por `workspace_id = activeWorkspace.id` (em vez de `user_id`)
- incluir `workspace_id` em todo `insert`
- canais realtime usam filtro `workspace_id=eq.${activeWorkspace.id}`

Ao trocar de workspace → recarregar dados.

### UI

**Workspace switcher** no topo da `Sidebar`:
- Dropdown com workspaces do usuário, atalho "Criar workspace", e (se MASTER) "Ver todos os workspaces"
- Modal de criação simples (nome → cria workspace + membership admin)

**Master Dashboard** — nova rota `src/routes/app.master.tsx` (visível só para MASTER):
- Lista de todos os workspaces (nome, owner, nº membros, última atividade)
- Lista de todos os usuários com role atual + dropdown para promover/rebaixar
- KPIs globais: total workspaces, usuários, sessões hoje, tarefas concluídas
- Botão "Entrar neste workspace" → seta `activeWorkspace` mesmo sem ser membro (MASTER bypass)

Item "Master" na sidebar só aparece se `isMaster`.

**Settings** (`app.settings.tsx`): nova aba "Workspace" com nome, lista de membros, convidar por e-mail (cria membership se o usuário existir), promover/remover (só admin).

### Proteção de rotas
- `/app/master` → redireciona se não for MASTER
- Guards de mutação: a UI de admin (gerenciar membros, deletar workspace) só renderiza se `isWorkspaceAdmin || isMaster`

---

## 3. Detalhes técnicos

- Tipos atualizados em `src/integrations/supabase/types.ts` automaticamente após migração.
- Realtime: habilitar replicação em `workspaces`, `workspace_members`, `user_roles`.
- Activity log passa a registrar `workspace_id` para isolamento.
- Backwards-compat: como vamos backfillar, nenhum dado se perde; usuários veem o "workspace pessoal" deles ao primeiro login.
- Promoção do primeiro MASTER: vou perguntar o e-mail antes de aplicar.

---

## 4. Etapas de execução

1. **Migration**: criar tabelas, enums, funções, adicionar `workspace_id` a todas as tabelas operacionais, backfill, novas RLS, trigger `handle_new_user`. Pedir aprovação.
2. **Promover MASTER** via `supabase--insert` (após confirmar e-mail).
3. **`WorkspaceProvider`** + integração no layout `app.tsx`.
4. **Refatorar stores e rotas** para usar `workspace_id`.
5. **Workspace switcher** na Sidebar + modal de criação.
6. **Master Dashboard** (`app.master.tsx`).
7. **Settings → aba Workspace** (membros, convites, promoções).
8. Smoke test: criar 2º workspace, alternar, verificar isolamento.

---

## Pergunta antes de iniciar

**Qual e-mail deve ser promovido a MASTER inicial?** Sem isso o painel global fica inacessível no primeiro deploy.
