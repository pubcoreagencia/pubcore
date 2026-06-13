# Plano de Otimização — PUB CORE

Foco: ganhos reais de performance, estabilidade e fluidez **sem alterar design, funcionalidades ou integrações**. Aplicação cirúrgica nos pontos com maior custo (rotas com 1k+ linhas, widgets globais, realtime, drag-and-drop).

## 1. Code-splitting global (impacto: tempo de boot)
- Converter todas as rotas pesadas (`app.kanban`, `app.stock`, `app.finance`, `app.checklists`, `app.notes`, `app.files`, `app.city`, `app.calc3d`, `app.index`) para **lazy chunks** via `React.lazy` + `Suspense` com skeleton já presente.
- Hoje o bundle inicial carrega todas as ferramentas mesmo quando o usuário só abre o Dashboard.

## 2. Realtime e queries Supabase
- Auditar todas as `supabase.channel(...)` para garantir cleanup no `useEffect` (já vi pelo menos um caso correto, validar os demais).
- Substituir `select("*")` por **lista explícita de campos** nas rotas grandes (Kanban, Stock, Finance, Notes, Files).
- Remover refetchs duplicados após mutação quando já existe subscription realtime (hoje muitas rotas fazem `loadX()` + recebem evento realtime → query dupla).
- Adicionar `.limit()` + paginação incremental em Estoque, Finanças e Central de Arquivos.

## 3. Kanban (prioridade alta)
- Estado otimista em **delete/move/edit**: aplicar mudança local antes do round-trip Supabase, com rollback em erro.
- Memoizar `KanbanCard` e `KanbanColumn` com `React.memo` + comparador raso.
- Trocar refetch completo por *patch* no estado quando vier evento realtime (já parcial; completar para todos os eventos).
- Reduzir re-render durante drag: extrair posição/transform para CSS-only enquanto arrasta, persistir só no drop.

## 4. Widgets globais (Sticky Notes, Calculator)
- Aplicar `React.memo` e mover timers/intervalos para dentro de `useEffect` com dependências corretas (evitar múltiplos timers simultâneos).
- Garantir que o widget de notas não dispara save em cada keystroke (já tem debounce de 500ms — validar).

## 5. Bater Ponto
- Garantir 1 único `setInterval` por sessão ativa (usar `useRef` para guarda).
- Mover cálculo do cronômetro para um componente isolado memoizado, evitando re-render do header inteiro a cada segundo.

## 6. Listas grandes
- Estoque, Finanças (transações), Notas, Arquivos: aplicar virtualização leve via paginação por scroll (chunks de 50) sem libs novas, ou ordenação server-side com `range()`.

## 7. Central de Arquivos
- Lazy-load do preview (só carrega URL assinada quando o item entra no viewport / é clicado).
- Debounce na busca (300ms).
- Limitar fetch inicial a 200 itens da pasta atual.

## 8. Boot do app
- Pré-carregar apenas dados do Dashboard no `loader` da rota `/app`; ferramentas pesadas carregam sob demanda (já viabilizado pelo passo 1).

## Detalhes técnicos
- `React.lazy` + `Suspense` com fallback usando os skeletons já presentes em `src/components/common`.
- `React.memo` em cards e linhas de tabela; `useCallback` em handlers passados para listas grandes.
- Cleanup de canais Supabase: padronizar via hook `useRealtimeTable(table, filter, onChange)` reutilizado pelas rotas.
- Mutações: padrão `setState(optimistic) → await supabase → on error: rollback + toast`.
- Sem mudanças em RLS, esquema ou design.

## Fora do escopo
- Reescritas de tela.
- Novas dependências (sem `react-window`, sem novas libs de DnD).
- Mudanças visuais ou de UX além de skeletons em transições.

## Entrega faseada (para revisão incremental)
1. Code-splitting de rotas + skeleton fallback.
2. Kanban otimista + memoização + patch realtime.
3. Auditoria de queries (`select` explícito, dedupe refetch+realtime).
4. Paginação em Estoque/Finanças/Arquivos.
5. Bater Ponto: timer isolado.
6. Polimento de widgets.

Confirma para eu começar pela fase 1, ou prefere outra ordem?
