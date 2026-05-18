## Refatoração do Kanban — Funis + Upload de Arquivos

Vou transformar o Kanban atual (1 board único) em um sistema multi-funis com anexos completos.

### 1. Banco de dados (migração)

**Nova tabela `kanban_funnels`** (funis/boards independentes)
- `name`, `description`, `color`, `icon`, `position`, `workspace_id`, `user_id`

**Nova tabela `kanban_attachments`** (anexos por card)
- `card_id`, `name`, `url`, `storage_path`, `mime_type`, `size`, `uploaded_by`, `uploader_name`, `workspace_id`

**Alterar `kanban_columns` e `kanban_cards`**
- Adicionar `funnel_id uuid` (FK lógica para `kanban_funnels`)
- Backfill: criar funil "Geral" por workspace existente e atribuir colunas/cards a ele

**RLS**: políticas `ws_*` baseadas em `is_workspace_member` (mesmo padrão atual).

**Storage**: criar bucket privado `kanban-attachments` + policies (membros do workspace podem ler/escrever no path `{workspace_id}/{card_id}/...`).

### 2. UI — Funis

- Barra superior com **tabs de funis** (selecionar funil ativo). Cada tab mostra nome + ícone + contador de cards.
- Botões: **+ Novo funil**, editar (nome/cor/ícone), excluir, reordenar (drag).
- Só o funil ativo é renderizado (board completo de colunas).
- Quando não há nenhum funil, criar "Geral" automaticamente.

### 3. UI — Anexos (modal do card)

Adicionar seção **Anexos** dentro do modal `openCard`:
- Drag-and-drop zone + botão "Adicionar arquivo"
- Upload múltiplo com **barra de progresso**
- Lista de anexos: ícone por tipo, nome, tamanho, autor, data
- Ações: preview (imagens/PDF abrem em nova aba), download, excluir
- Sincronização realtime via canal `kanban_attachments`

Aceita: imagens, PDFs, docs, vídeos, áudios, ZIPs. Limite por arquivo: 50 MB.

### 4. Realtime e persistência

- Canais Supabase Realtime para `kanban_funnels`, `kanban_columns`, `kanban_cards`, `kanban_attachments` filtrados por `workspace_id`.
- Autosave em todos os edits inline (já é o padrão).
- Ordem dos funis/colunas/cards persistida em `position`.

### 5. Visual

Mantém o dark mode atual (tokens semânticos). Tabs de funis com glow sutil no ativo, cards de anexo modulares, ícones por tipo de arquivo.

### Arquivos afetados

- `supabase/migrations/<nova>.sql` — tabelas + bucket + policies
- `src/routes/app.kanban.tsx` — refator completo (funis + anexos no modal)
- `src/components/KanbanFunnelTabs.tsx` (novo) — barra de funis
- `src/components/KanbanAttachments.tsx` (novo) — seção de anexos no modal

### Fora do escopo desta entrega

- Drag-and-drop **entre funis diferentes** (cards permanecem dentro do funil ativo) — pode ser adicionado depois via menu "Mover para funil…".
- Múltiplos layouts (lista/calendário) — só Kanban por enquanto.

Confirma para eu seguir?
