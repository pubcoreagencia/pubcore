## Visão geral

Evoluir a aba Kanban para suportar **dois modos de visualização** dos mesmos dados:

1. **Kanban Tradicional** (atual, intocado): Funil → Colunas → Cards
2. **Fluxograma** (novo): Funil → Nós conectados em árvore/ramificações

Os nós do fluxograma **são os mesmos cards** do Kanban — apenas mudam a apresentação. Toda a estrutura existente (cards, anexos, comentários, descrição, empresa, responsáveis, status, prioridade) é reaproveitada.

## Modelo de dados

Adicionar à tabela `kanban_cards` (sem quebrar nada):

- `parent_card_id uuid null` — referência ao nó pai (raiz quando null)
- `flow_x double precision null` — posição X livre no canvas (modo fluxograma)
- `flow_y double precision null` — posição Y livre no canvas
- `flow_collapsed boolean default false` — recolher ramo

Nova tabela `kanban_card_links` para conexões extras (além da hierarquia pai→filho), permitindo "múltiplos caminhos" que não sejam apenas árvore pura:

- `id`, `funnel_id`, `from_card_id`, `to_card_id`, `label text null`, `created_at`

Com GRANTs + RLS espelhando as policies atuais de `kanban_cards` (workspace member).

**Migração automática**: cards existentes ficam com `parent_card_id = null` (todos viram raízes no fluxograma inicial), `flow_x/flow_y = null` (auto-layout). Nada se perde, nada quebra: colunas, ordem, anexos, etc. continuam funcionando exatamente como hoje.

## UI

Na rota `/app/kanban`, adicionar um toggle no header do funil: **[ Kanban | Fluxograma ]** (persistido por funil em `localStorage`).

### Modo Fluxograma

- Canvas com **pan** (arrastar fundo) e **zoom** (scroll / pinch).
- Renderizar cada card como um nó retangular compacto exibindo: título, badge de empresa, prioridade, status, contagem de anexos/comentários.
- Linhas SVG ligando pai → filhos (curvas Bézier suaves estilo Whimsical/FigJam).
- Linhas extras de `kanban_card_links` em estilo tracejado.
- Drag-and-drop livre dos nós (atualiza `flow_x/flow_y`).
- Botão **+** ao lado de cada nó para criar filho (cria card com `parent_card_id` setado).
- Clicar no nó abre o **mesmo dialog de detalhe** já existente (edição completa: descrição, anexos, comentários, responsáveis, etc.).
- Modo de conexão: clicar em "ligar" num nó e depois em outro cria entrada em `kanban_card_links`.
- Auto-layout inicial (Reingold–Tilford simples) quando `flow_x/flow_y` é null, depois persiste posições.
- Recolher/expandir ramos (`flow_collapsed`).

### Performance

- Lista de nós em `useMemo`; conexões em SVG único.
- Drag com transform CSS + commit ao soltar (1 update no Supabase).
- Virtualização não necessária no MVP; limitar re-renders via componente `Node` memoizado.

### Responsividade

- Desktop: pan = botão do meio ou espaço+drag; zoom = scroll.
- Touch (tablet/mobile): pan = 1 dedo no fundo, zoom = pinça, drag de nó = 1 dedo no nó.
- Toolbar flutuante: zoom in/out, fit, recentrar, alternar modo.

## Estrutura técnica

```text
src/routes/app.kanban.tsx               (adiciona toggle de modo)
src/components/kanban/FlowCanvas.tsx    (novo — canvas, pan/zoom, SVG)
src/components/kanban/FlowNode.tsx      (novo — nó memoizado)
src/components/kanban/FlowToolbar.tsx   (novo)
src/lib/kanban-flow.ts                  (novo — auto-layout, helpers de geometria)
```

Reutiliza o store/dialog atuais do Kanban — nenhuma lógica de cards é reescrita.

## Migração SQL

```sql
ALTER TABLE public.kanban_cards
  ADD COLUMN parent_card_id uuid NULL REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  ADD COLUMN flow_x double precision NULL,
  ADD COLUMN flow_y double precision NULL,
  ADD COLUMN flow_collapsed boolean NOT NULL DEFAULT false;

CREATE INDEX idx_kanban_cards_parent ON public.kanban_cards(parent_card_id);

CREATE TABLE public.kanban_card_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  funnel_id uuid NOT NULL,
  from_card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  to_card_id   uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  label text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_card_links TO authenticated;
GRANT ALL ON public.kanban_card_links TO service_role;
ALTER TABLE public.kanban_card_links ENABLE ROW LEVEL SECURITY;
-- policies idênticas às de kanban_cards (workspace member)
```

## O que NÃO muda

- Tabelas `kanban_funnels`, `kanban_columns`, `kanban_attachments` permanecem como estão.
- Modo Kanban tradicional permanece 100% igual: colunas, drag horizontal, ordering.
- Dialog de edição de card é o mesmo nos dois modos.
- Histórico, anexos e comentários existentes intactos.

## Escopo do MVP (esta entrega)

1. Migração + types regenerados.
2. Toggle Kanban/Fluxograma na rota.
3. FlowCanvas com pan, zoom, auto-layout, drag de nós, criar filho, abrir detalhe.
4. Conexões extras (`kanban_card_links`) — criar e renderizar.
5. Suporte touch básico (pan/pinch/drag).

Refinamentos futuros (não nesta entrega): mini-mapa, snap-to-grid, undo/redo, templates de fluxo.

## Confirmação

Posso seguir com essa abordagem? Se sim, começo pela migração do banco.