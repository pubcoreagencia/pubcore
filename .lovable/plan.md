# Reestruturação PUB CORE — Empresas como Núcleo

## Objetivo
Transformar **Empresas** na entidade central da plataforma e padronizar CRUD completo (criar / editar / duplicar / arquivar / excluir / reordenar) em todos os módulos, com sincronização em tempo real entre eles.

---

## 1. Módulo Empresas (novo, dedicado)

Rota: `/app/companies` (novo item na sidebar, grupo "Gestão", logo após CRM).

A tabela `checklist_companies` já existe e é usada hoje pelo Checklist e pelo Ponto. Vamos **promovê-la a tabela canônica de empresas** e adicionar colunas faltantes:

- `segment` (text)
- `responsible` (text)
- `status` (text: `active` | `archived`)
- `notes` (text)
- `sort_order` (int) — já existe? caso não, adicionar
- `color` já existe

Renomear conceitualmente para "Empresa" na UI (a tabela permanece `checklist_companies` para evitar migração destrutiva; criamos uma view `companies` somente leitura para clareza opcional).

### Tela Empresas
- Lista em grid responsivo (card por empresa) com cor, nome, segmento, responsável, status.
- Ações por card: **Editar**, **Duplicar**, **Arquivar/Desarquivar**, **Excluir**.
- Botão "Nova Empresa" abre dialog com todos os campos.
- Drag-and-drop para reordenar.
- Filtro por status e busca por nome.

### Exclusão com impacto
Ao clicar **Excluir**, chamar nova RPC `company_impact_report(workspace_id, name)` que retorna contagens em:
`checklist_tasks`, `checklist_daily_completions`, `ponto_sessions`, `finance_transactions`, `finance_products`, `finance_costs`, `stock_items`, `stock_movements`, `kanban_funnels`, `kanban_cards`, `crm_leads`.

Diálogo com 3 botões:
- **Cancelar**
- **Transferir registros para…** (select de outra empresa) → RPC `transfer_company_records(ws, from_name, to_name)`
- **Excluir tudo** → RPC existente `delete_checklist_company_cascade` expandida para incluir as tabelas listadas acima.

---

## 2. Vinculação Global Empresa

Adicionar coluna `company` (text, nullable até backfill) onde ainda não existe:
- `finance_transactions`, `finance_products`, `finance_costs`, `finance_categories`
- `stock_items` (já tem stock_companies — manter mas alimentar pelo cadastro central)
- `kanban_funnels`, `kanban_cards`
- `crm_leads`
- `calendar_events`, `notes`

Todos os **selects de empresa em formulários** passam a consumir o hook `useChecklistCompanies` (já é a fonte única). Remover quaisquer listas hardcoded restantes em `src/lib/mock-data.ts` e `src/lib/operations.tsx`.

### Renomeação propaga
Estender RPC existente `rename_checklist_company` para atualizar também as novas tabelas. Renomear na UI dispara invalidação Realtime (já presente) e React Query → reflete em todos os módulos sem refresh.

---

## 3. Padronização CRUD por módulo

Para cada módulo abaixo, expor um **menu de ações** (`⋮`) em cada registro com: Editar · Duplicar · Arquivar · Excluir. Adicionar também "Alterar empresa vinculada" onde aplicável.

| Módulo | Itens com CRUD completo + duplicar/arquivar | Reordenar |
|---|---|---|
| Checklist | tarefas, etapas | sim |
| Ponto | sessões, tarefas de sessão | sim |
| Financeiro | receitas, despesas, categorias | — |
| Estoque | produtos | — |
| Kanban | funis, colunas, cards | sim (DnD) |
| CRM | clientes (leads) | — |

Componentes reutilizáveis a criar:
- `RecordActionsMenu` (dropdown de ações)
- `CompanyPicker` (select dinâmico a partir de `useChecklistCompanies`)
- `DeleteWithImpactDialog` (genérico para exclusão com aviso)

Para "arquivar" onde não existe coluna: adicionar `archived_at timestamptz null` nas tabelas listadas. Filtros padrão escondem arquivados.

---

## 4. Dashboard — filtros por empresa

Adicionar barra de filtro persistente em `/app`:
- **Todas as empresas** | **Empresa única** | **Grupo de empresas** (multi-select)

Estado salvo em URL search params para deep-link. Indicadores existentes passam a aceitar `companyFilter` como prop.

---

## 5. Realtime e Performance

Já há Realtime em várias tabelas. Garantir publicação `supabase_realtime` para:
`checklist_companies`, `finance_transactions`, `stock_items`, `kanban_funnels`, `kanban_cards`, `crm_leads`.

Hooks usam React Query — qualquer mutação invalida as queries relevantes. Sem refresh manual.

---

## 6. Responsividade e UX

- Diálogos viram **Drawer** em mobile (já existe `ui/drawer`).
- Action menu acessível por toque (tamanho ≥40px).
- Cards de lista em grid 1 col mobile / 2 tablet / 3+ desktop.

---

## Detalhes Técnicos

### Migrações SQL (uma migração consolidada)
1. `ALTER TABLE public.checklist_companies ADD COLUMN IF NOT EXISTS segment text, ADD COLUMN responsible text, ADD COLUMN status text DEFAULT 'active', ADD COLUMN notes text;`
2. Adicionar `company text`, `archived_at timestamptz` nas tabelas listadas (com `IF NOT EXISTS`).
3. Novas RPCs (SECURITY DEFINER, checar `is_workspace_admin` ou `has_app_role('master')`):
   - `company_impact_report(_ws uuid, _name text) returns jsonb`
   - `transfer_company_records(_ws uuid, _from text, _to text) returns void`
4. Estender `rename_checklist_company` e `delete_checklist_company_cascade` para cobrir todas as tabelas.
5. `ALTER PUBLICATION supabase_realtime ADD TABLE …` para as faltantes.

### Frontend
- Nova rota `src/routes/app.companies.tsx`.
- Item na sidebar (`src/components/nav-config.ts`).
- Novos componentes em `src/components/companies/` (List, CompanyCard, CompanyDialog, DeleteWithImpactDialog).
- `src/components/common/RecordActionsMenu.tsx` reutilizado em Checklist, Ponto, Financeiro, Estoque, Kanban, CRM.
- `src/components/common/CompanyPicker.tsx` substitui qualquer dropdown estático de empresa.
- Filtro de dashboard em `src/routes/app.index.tsx` com `validateSearch`.

---

## Escopo desta entrega
Dado o volume, proponho entregar em **duas fases**:

**Fase 1 (esta tarefa)**
- Migração SQL completa (colunas + RPCs + realtime).
- Módulo Empresas completo (CRUD + impacto + transferência).
- `CompanyPicker` + `RecordActionsMenu` reutilizáveis.
- Integração em Checklist e Financeiro (módulos mais usados).
- Filtro por empresa no Dashboard.

**Fase 2 (próxima mensagem após validação)**
- Estender ações completas (duplicar/arquivar) em Ponto, Estoque, Kanban, CRM.
- Migração de listas remanescentes em `mock-data.ts`.
- Polimento mobile (Drawer) em todos os diálogos.

Posso seguir com a Fase 1?
