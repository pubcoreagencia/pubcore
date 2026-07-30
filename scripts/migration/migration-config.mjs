export const buckets = ["files", "kanban-attachments"];

export const authTables = [
  { schema: "auth", table: "users", group: "auth", order: 1, sensitiveColumns: ["id", "email"] },
  { schema: "auth", table: "identities", group: "auth", order: 2, sensitiveColumns: ["user_id"] },
];

export const publicTables = [
  { table: "profiles", group: "perfis/workspaces/roles", order: 10, sensitiveColumns: ["id"] },
  { table: "workspaces", group: "perfis/workspaces/roles", order: 11, sensitiveColumns: ["owner_id"] },
  { table: "workspace_members", group: "perfis/workspaces/roles", order: 12, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "user_roles", group: "perfis/workspaces/roles", order: 13, sensitiveColumns: ["user_id"] },

  { table: "checklist_companies", group: "empresas/checklists", order: 20, sensitiveColumns: ["workspace_id"] },
  { table: "checklist_tasks", group: "empresas/checklists", order: 21, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "checklist_daily_completions", group: "empresas/checklists", order: 22, sensitiveColumns: ["workspace_id", "user_id"] },

  { table: "ponto_sessions", group: "ponto/historico", order: 30, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "ponto_session_tasks", group: "ponto/historico", order: 31, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "ponto_session_edits", group: "ponto/historico", order: 32, sensitiveColumns: ["workspace_id", "user_id"] },

  { table: "kanban_funnels", group: "kanban", order: 40, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "kanban_columns", group: "kanban", order: 41, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "kanban_cards", group: "kanban", order: 42, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "kanban_card_links", group: "kanban", order: 43, sensitiveColumns: ["workspace_id"] },
  { table: "kanban_attachments", group: "kanban", order: 44, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "kanban_cards_archive", group: "kanban", order: 45, sensitiveColumns: ["workspace_id"] },

  { table: "notes", group: "notas/sticky", order: 50, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "note_categories", group: "notas/sticky", order: 51, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "sticky_notes", group: "notas/sticky", order: 52, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "gratitude_entries", group: "notas/sticky", order: 53, sensitiveColumns: ["user_id"] },

  { table: "files_folders", group: "arquivos/storage metadata", order: 60, sensitiveColumns: ["workspace_id", "created_by"] },
  { table: "files_items", group: "arquivos/storage metadata", order: 61, sensitiveColumns: ["workspace_id", "created_by"] },
  { table: "disco_projects", group: "arquivos/storage metadata", order: 62, sensitiveColumns: ["workspace_id", "created_by"] },
  { table: "disco_tracks", group: "arquivos/storage metadata", order: 63, sensitiveColumns: ["workspace_id", "created_by"] },
  { table: "disco_versions", group: "arquivos/storage metadata", order: 64, sensitiveColumns: ["workspace_id", "created_by"] },
  { table: "disco_comments", group: "arquivos/storage metadata", order: 65, sensitiveColumns: ["workspace_id", "author_id"] },

  { table: "finance_categories", group: "financas", order: 70, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "finance_transactions", group: "financas", order: 71, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "finance_costs", group: "financas", order: 72, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "finance_products", group: "financas", order: 73, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "pfin_accounts", group: "financas", order: 74, sensitiveColumns: ["user_id"] },
  { table: "pfin_categories", group: "financas", order: 75, sensitiveColumns: ["user_id"] },
  { table: "pfin_transactions", group: "financas", order: 76, sensitiveColumns: ["user_id"] },
  { table: "pfin_goals", group: "financas", order: 77, sensitiveColumns: ["user_id"] },

  { table: "stock_companies", group: "estoque", order: 80, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "stock_groups", group: "estoque", order: 81, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "stock_categories", group: "estoque", order: 82, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "stock_field_defs", group: "estoque", order: 83, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "stock_items", group: "estoque", order: 84, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "stock_movements", group: "estoque", order: 85, sensitiveColumns: ["workspace_id", "user_id"] },

  { table: "completion_reports", group: "relatorios", order: 90, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "calendar_events", group: "relatorios", order: 91, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "crm_leads", group: "relatorios", order: 92, sensitiveColumns: ["workspace_id", "user_id"] },

  { table: "trends_seasonalities", group: "tendencias", order: 100, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "trends_hype", group: "tendencias", order: 101, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "trends_opportunities", group: "tendencias", order: 102, sensitiveColumns: ["workspace_id", "user_id"] },

  { table: "shared_items", group: "compartilhamento", order: 110, sensitiveColumns: ["source_workspace_id", "target_workspace_id", "shared_by_user_id"] },
  { table: "shared_item_comments", group: "compartilhamento", order: 111, sensitiveColumns: ["workspace_id", "user_id"] },
  { table: "shared_item_activity", group: "compartilhamento", order: 112, sensitiveColumns: ["user_id"] },
];

export const allCountTargets = [
  ...authTables,
  ...publicTables.map((item) => ({ schema: "public", ...item })),
  { schema: "storage", table: "buckets", group: "storage", order: 120, sensitiveColumns: [] },
  { schema: "storage", table: "objects", group: "storage", order: 121, sensitiveColumns: ["bucket_id", "name", "owner"] },
].sort((a, b) => a.order - b.order);

