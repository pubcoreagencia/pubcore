## Refactor Estoque — multi-empresa 100% editável

Transforma `/app/stock` em um workspace por empresa, com schema dinâmico (estilo Airtable) e hierarquia grupo → categoria. Tudo persistido no Supabase com realtime.

### 1. Banco de dados (migration)

Novas tabelas (todas com `workspace_id`, RLS `is_workspace_member OR master`, realtime):

- **`stock_companies`** — `name`, `slug`, `color`, `icon`, `position`. Substitui o array fixo `COMPANIES`. Seeded com as 6 empresas no primeiro acesso (front-side, idempotente).
- **`stock_groups`** — `company_id`, `name`, `color`, `icon`, `position`.
- **`stock_field_defs`** — `company_id`, `key`, `label`, `type` (`text`|`number`|`currency`|`select`|`date`|`boolean`|`textarea`), `options` jsonb (para select), `position`, `required`, `visible`, `is_system` (campos base não excluíveis).

Alterações em tabelas existentes:

- **`stock_categories`** — adicionar `company_id uuid`, `group_id uuid`.
- **`stock_items`** — adicionar `company_id uuid`, `group_id uuid`, `category_id uuid`, `data jsonb DEFAULT '{}'` (valores dos campos custom). Mantém `name`, `quantity`, `cost`, `price`, `sku`, `supplier`, `location`, `notes`, `min_quantity` como campos base.
- **`stock_movements`** — adicionar `company_id uuid` para escopar histórico.

Sem foreign keys (segue padrão do projeto). Limpezas de órfãos via lógica no front.

### 2. Frontend — `src/routes/app.stock.tsx` (rewrite)

```text
┌────────────────────────────────────────────────────────────┐
│ [Pub 3D] [Pub IA] [Pub RECORDS] [Films] [Bricks] [+ Add]  │  ← abas de empresa (editáveis)
├────────────────────────────────────────────────────────────┤
│ ⚙ Configurar empresa  |  Grupos  |  Categorias  |  Campos │
├────────────────────────────────────────────────────────────┤
│ 🔍 busca   filtros: grupo▾ categoria▾   [Tabela|Cards]    │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ≡  Item        Qtd  Custo  Preço  SKU  Fornec  ⋯     │ │
│ │ ≡  ●  Resina   12   R$80   R$200  R-1  X        ⋯     │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Componentes principais:**

- `CompanyTabs` — lista de `stock_companies`, drag-to-reorder, dialog para criar/renomear/excluir. Aba ativa salva em `localStorage`.
- `CompanyConfigDialog` — gerencia grupos, categorias, campos custom da empresa selecionada (3 sub-abas internas).
- `FieldsManager` — CRUD dos `stock_field_defs`: tipo, label, options (para select), reordenar via drag, toggle visível.
- `GroupsManager` / `CategoriesManager` — CRUD com cor/ícone, drag-to-reorder. Categoria pertence a um grupo.
- `ItemsView` — alterna tabela / cards. Tabela renderiza colunas dinamicamente a partir de `field_defs.visible` + base. Edição inline (click na célula → input → blur autosave). Drag-to-reorder linhas. Filtros por grupo/categoria, busca em tempo real (debounce 200ms).
- `MovementDialog` — registrar entrada/saída/ajuste. Atualiza `stock_items.quantity` + insere `stock_movements`.

**Persistência / realtime:**

- Hook `useStockData(companyId)` — fetch + canal `stock:${workspaceId}:${companyId}` ouvindo as 6 tabelas com filtro por workspace; refetch on change.
- Autosave: cada edição inline faz `update` direto no Supabase, com optimistic UI e toast em erro.
- Drag-and-drop: usa `@dnd-kit/core` + `@dnd-kit/sortable` (já usado no projeto se disponível; senão instalo) para reordenar abas, grupos, categorias, campos e linhas. Salva `position` em batch.

**Seed inicial (idempotente):**

Quando o usuário abre a aba pela primeira vez e `stock_companies` está vazia para o workspace, cria as 6 empresas padrão + os campos base (`name`, `quantity`, `min_quantity`, `cost`, `price`, `sku`, `supplier`, `location`, `notes`) marcados como `is_system=true`. Itens já existentes (com `company` text) são migrados via SQL na própria migration mapeando `company` → `company_id`.

### 3. Visual

Mantém o dark premium do resto da PUB CORE. Tabs de empresa com cor própria (chip arredondado, border colorido quando ativa). Tabela com linhas hover, células editáveis com ring no focus. Drag handle só aparece on hover. Cards (modo alternativo) em grid responsivo.

### 4. Fora do escopo

- Importação CSV / exportação avançada (mantém só a operação CRUD).
- Permissões granulares por empresa (continua usando RLS de workspace).
- Histórico/undo de edições inline além do `stock_movements`.
- Anexos de arquivo nos itens.

### 5. Observação técnica

A migration faz `ALTER TABLE` adicionando colunas nullable + tabelas novas — não quebra dados existentes. O seed roda no client e é idempotente (`upsert` por `slug`).

Confirme e eu aplico a migration + escrevo o módulo (rota inteira reescrita, ~1.5k linhas distribuídas em arquivos `src/routes/app.stock.tsx` + helpers em `src/lib/stock/`).
