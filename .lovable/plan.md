## Aba "Finanças" — Central financeira da PUB CORE

Nova aba `/app/finance` totalmente integrada ao sistema multi-workspace existente, com persistência no Supabase e realtime.

### 1. Banco de dados (migration)

Tabelas novas (todas com `workspace_id`, RLS `is_workspace_member OR master`, realtime habilitado):

- **`finance_categories`** — categorias customizáveis de entrada/saída. Campos: `name`, `kind` (`income`|`expense`), `color`, `icon`, `position`.
- **`finance_transactions`** — entradas e saídas. Campos: `kind` (`income`|`expense`), `amount` (numeric), `description`, `category_id`, `company`, `occurred_on` (date), `recurrence` (`none`|`monthly`|`weekly`|`yearly`), `responsible`, `notes`.
- **`finance_costs`** — custos fixos/variáveis. Campos: `name`, `kind` (`fixed`|`variable`), `amount_monthly`, `company`, `category`, `notes`, `active`.
- **`finance_products`** — catálogo. Campos: `name`, `company` (Pub 3D, Pub IA, Pub RECORDS, Pub Films, Bricks, Têxtil), `cost`, `price`, `avg_demand_monthly`, `stock`, `category`, `notes`. Markup, margem e lucro unitário derivados no front.

Sem alterações em tabelas existentes.

### 2. Frontend

**Rota raiz `src/routes/app.finance.tsx`** com tabs internas (estilo Linear/Stripe):

```text
[ Dashboard | Entradas/Saídas | Custos | Produtos | Breakeven | Relatórios ]
```

- **Dashboard** — KPIs (faturamento, lucro líquido, despesas, saldo, breakeven diário/mensal), gráfico de evolução (Recharts area), comparativo mês atual vs anterior, top empresas, top produtos, alertas de saúde.
- **Entradas/Saídas** — tabela unificada com filtros (tipo, categoria, empresa, período, busca), modal de criação/edição, ações de excluir, badge de recorrência.
- **Custos** — duas listas (Fixos / Variáveis), totais por tipo, impacto mensal, comparativo por empresa.
- **Produtos** — grid de cards por empresa, modal CRUD, exibe markup/margem/lucro unitário calculados.
- **Breakeven** — calcula a partir de custos fixos + variáveis médios + ticket médio dos produtos: ponto de equilíbrio diário/mensal, faturamento mínimo, qtd mínima de vendas, "quanto falta para o azul" (vs entradas do mês), barras de progresso, ranking empresas lucrativas vs no prejuízo.
- **Relatórios** — tabelas mensais/semanais, métricas por empresa e produto, comparativos históricos, export CSV.

**Sidebar** — adicionar item "Finanças" no grupo "Gestão" com ícone `Wallet`.

**Realtime** — canal único `finance:${workspaceId}` escutando as 4 tabelas, refetch on change.

**Stores leves** — sem provider global; cada tab usa hooks `useFinance*` com `useEffect` + estado local, escopados ao `activeWorkspaceId` do `useWorkspace()`.

### 3. Visual

Dark premium consistente com o resto da PUB CORE: cards com `bg-card/50`, bordas sutis, glow no KPI principal via `--gradient-primary`, números em `font-display`, microinterações com `transition-colors`. Recharts usando tokens semânticos (`hsl(var(--primary))`, etc).

### 4. Integração

- Activity log: registra `created`/`updated`/`deleted` em `finance_transactions` (entity_type `finance_transaction` — adicionar ao type union).
- Tudo escopado a `activeWorkspaceId`; troca de workspace recarrega.
- Persistência e recovery automáticos via Supabase + realtime.

### 5. Fora de escopo (não vou fazer agora)

- Importação de extrato bancário / OFX.
- Conciliação automática.
- Multi-moeda (assumindo BRL).
- Notas fiscais / integração contábil.

Confirme e eu já aplico a migration e construo a aba.
