# Refator do Bater Ponto — Subpontos por empresa

## Visão geral

Hoje existe **uma única sessão de ponto** por usuário/dia (`ponto_sessions`). O sistema vai virar **uma sessão por empresa por dia**, cada uma com seu próprio timer, podendo haver várias sessões abertas/encerradas no mesmo dia, mas **apenas uma “ativa” (working) por vez**. O histórico continua mostrando **uma linha por dia**, expansível para revelar o detalhe por empresa.

Empresas (workspaces operacionais internos da holding): **PUB 3D, PUB IA, PUB RECORDS, PUB FILMS** (mesma lista já usada no resto do app via `COMPANIES`).

## Mudanças de dados (Supabase)

Migration única:
- Adicionar `company text` em `ponto_sessions` (nullable para retrocompat; novos registros sempre populam).
- Índice: `(workspace_id, user_id, started_at)` e `(workspace_id, user_id, company, started_at)`.
- `ponto_session_tasks` já tem `company` — manter; passar a vincular usando o subponto ativo daquela empresa.

Sem mudanças em RLS (já é por workspace).

## Mudanças no estado / lógica (`src/lib/ponto.tsx`)

Reescrita do `PontoProvider` para suportar múltiplas sessões simultâneas:
- Estado passa a ser `sessions: Record<company, PontoSession>` em vez de uma única.
- Apenas **uma empresa pode estar `working`** ao mesmo tempo. `startCompany(company)` pausa automaticamente a anterior (ou encerra, conforme regra — vou usar **pausar** para preservar tempo do dia).
- `endCompany(company)` encerra apenas a sessão daquela empresa.
- Persistência local (`localStorage` + `BroadcastChannel`) atualizada para o novo shape, com migração silenciosa do shape antigo.
- `getActivePontoSession()` passa a retornar `{ sessionId, company, ownerEmail, userName }` da empresa ativa — usado pelo checklist para vincular tarefas concluídas ao subponto correto.
- `compute` e `fmtTime` ficam iguais; passam a operar por sessão.

## Auto‑tracker (`PontoAutoTracker.tsx`)

Hoje **auto‑inicia** uma sessão no login. Isso quebra o modelo novo (usuário tem que escolher a empresa).
- Remover o auto‑start; manter apenas o **encerramento por inatividade** (30 min) — agora aplicado à empresa ativa.
- Manter heartbeat de `updated_at`.
- Manter adoção de sessões em andamento ao logar (consulta passa a buscar **todas** as sessões `working/paused` do dia e adota cada uma na sua empresa).

## Notificações nativas

- Pedir `Notification.requestPermission()` na primeira vez que o usuário inicia um expediente (não no login, para não ser intrusivo). Fallback visual com toast se negado.
- Disparar notificação **uma vez** quando `productiveMs` daquela empresa cruzar **1h30min** no dia (90 * 60 * 1000). Marcador `notified90_<company>_<yyyy-mm-dd>` no localStorage para não repetir.
- Notificação: título `PUB CORE`, body `"{COMPANY} excedeu 1h30min de expediente hoje."`. Não pausa nem reseta o timer.

## UI

### Centro Operacional (`app.checklists.tsx`)
Adicionar um bloco **“Expedientes por empresa”** acima do kanban/checklist com 4 cards (um por empresa):
- Nome da empresa + cor
- Timer ao vivo (tempo total do dia somando todas as sessões daquela empresa)
- Status: `Iniciar` / `Pausar` / `Encerrar`
- Indicador visual sutil de “ativa agora” + barra de progresso até 1h30 (apenas referência, não bloqueia)

### `PontoHeader.tsx`
Mostrar a empresa ativa + timer dela. Se nenhuma ativa, esconde como hoje.

### Histórico
A view de histórico continua **uma linha por dia** com soma total, mas cada linha vira expansível, listando por empresa: tempo, tarefas vinculadas. Reutilizar a query já existente, agrupando client‑side por `company` + `date(started_at)`.

## Integração com o Checklist

`checklist-store.tsx` já registra `ponto_session_tasks` ao concluir uma tarefa. Passa a usar `getActivePontoSession()` novo (com `company`) e grava `company` = empresa do subponto ativo (não a da tarefa). Se não houver subponto ativo, mantém comportamento atual (não vincula).

## Arquivos afetados

- `supabase` migration: `ponto_sessions.company` + índices
- `src/lib/ponto.tsx` — reescrita do provider
- `src/components/PontoAutoTracker.tsx` — remover auto‑start, adaptar idle/adoption
- `src/components/PontoHeader.tsx` — exibir empresa ativa
- `src/routes/app.checklists.tsx` — novo bloco de cards por empresa
- `src/lib/checklist-store.tsx` — usar company do subponto ativo
- Onde houver histórico de ponto: ajustar agrupamento + expansão

## Fora de escopo

- Não mexer no funcionamento do Kanban/Checklist em si.
- Não criar “workspaces” Supabase separados por empresa — `company` continua sendo um campo dentro do workspace do usuário.
- Sem mudanças de RLS.

Aprova pra eu seguir?
