import { createServerFn } from "@tanstack/react-start";

const TABLES = [
  "workspaces",
  "workspace_members",
  "profiles",
  "checklist_companies",
  "checklist_tasks",
  "checklist_daily_completions",
  "ponto_sessions",
  "ponto_session_tasks",
  "ponto_session_edits",
  "kanban_funnels",
  "kanban_columns",
  "kanban_cards",
  "kanban_cards_archive",
  "kanban_attachments",
  "kanban_card_links",
  "completion_reports",
  "calendar_events",
  "crm_leads",
  "notes",
  "note_categories",
  "sticky_notes",
  "files_folders",
  "files_items",
  "finance_transactions",
  "finance_products",
  "finance_costs",
  "finance_categories",
  "stock_items",
  "stock_categories",
  "stock_groups",
  "stock_companies",
  "stock_movements",
  "stock_field_defs",
  "trends_seasonalities",
  "trends_hype",
  "trends_opportunities",
  "shared_items",
  "shared_item_comments",
  "shared_item_activity",
  "gratitude_entries",
  "disco_projects",
  "disco_tracks",
  "disco_versions",
  "disco_comments",
  "user_roles",
] as const;

function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [u, d] = email.split("@");
  if (!d) return "***";
  const uMask = u.length <= 2 ? u[0] + "*" : u[0] + "***" + u[u.length - 1];
  return `${uMask}@${d}`;
}

export const getAuditReport = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin;

  const counts: Record<string, { count: number; error?: string }> = {};
  await Promise.all(
    TABLES.map(async (t) => {
      const { count, error } = await admin
        .from(t as any)
        .select("*", { count: "exact", head: true });
      counts[t] = { count: count ?? 0, ...(error ? { error: error.message } : {}) };
    }),
  );

  // Workspaces overview
  const { data: workspaces } = await admin
    .from("workspaces")
    .select("id, name, slug, owner_id, created_at")
    .order("created_at", { ascending: false });

  const { data: members } = await admin
    .from("workspace_members")
    .select("workspace_id, user_id, role");

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, display_name, status, created_at");

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const memberByWs = new Map<string, number>();
  for (const m of members ?? []) {
    memberByWs.set(m.workspace_id, (memberByWs.get(m.workspace_id) ?? 0) + 1);
  }

  const workspacesOut = (workspaces ?? []).map((w) => {
    const owner = profileMap.get(w.owner_id);
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      created_at: w.created_at,
      member_count: memberByWs.get(w.id) ?? 0,
      owner_name: owner?.display_name ?? "—",
      owner_email_masked: maskEmail(owner?.email),
    };
  });

  // Inconsistency checks
  const inconsistencies: { id: string; label: string; count: number; details?: string }[] = [];

  // 1) Ponto sessions open with stale updated_at (>24h working/paused)
  {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("ponto_sessions")
      .select("*", { count: "exact", head: true })
      .in("status", ["working", "paused"])
      .lt("updated_at", cutoff);
    if ((count ?? 0) > 0) {
      inconsistencies.push({
        id: "stale_ponto",
        label: "Sessões de ponto abertas há mais de 24h",
        count: count ?? 0,
      });
    }
  }

  // 2) files_items sem storage_path
  {
    const { count } = await admin
      .from("files_items")
      .select("*", { count: "exact", head: true })
      .is("storage_path", null);
    if ((count ?? 0) > 0) {
      inconsistencies.push({
        id: "files_no_path",
        label: "Arquivos sem storage_path",
        count: count ?? 0,
      });
    }
  }

  // 3) Perfis pendentes
  {
    const { count } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if ((count ?? 0) > 0) {
      inconsistencies.push({
        id: "pending_profiles",
        label: "Contas pendentes de aprovação",
        count: count ?? 0,
      });
    }
  }

  // 4) Kanban cards órfãos (coluna inexistente) — best-effort via join miss
  {
    const { data: cardCols } = await admin.from("kanban_cards").select("column_id");
    const { data: cols } = await admin.from("kanban_columns").select("id");
    const colSet = new Set((cols ?? []).map((c) => c.id));
    const orphan = (cardCols ?? []).filter((c) => c.column_id && !colSet.has(c.column_id)).length;
    if (orphan > 0) {
      inconsistencies.push({
        id: "orphan_cards",
        label: "Cards do Kanban com coluna inexistente",
        count: orphan,
      });
    }
  }

  // Modules summary
  const modules = [
    {
      key: "operacao",
      label: "Centro Operacional (Kanban + Checklist)",
      counts: {
        funis: counts.kanban_funnels?.count ?? 0,
        colunas: counts.kanban_columns?.count ?? 0,
        cards: counts.kanban_cards?.count ?? 0,
        arquivados: counts.kanban_cards_archive?.count ?? 0,
        anexos: counts.kanban_attachments?.count ?? 0,
        tarefas_checklist: counts.checklist_tasks?.count ?? 0,
        conclusoes_diarias: counts.checklist_daily_completions?.count ?? 0,
      },
    },
    {
      key: "ponto",
      label: "Bater Ponto / Histórico / Métricas",
      counts: {
        sessoes: counts.ponto_sessions?.count ?? 0,
        tarefas_de_ponto: counts.ponto_session_tasks?.count ?? 0,
        edicoes: counts.ponto_session_edits?.count ?? 0,
      },
    },
    {
      key: "arquivos",
      label: "Central de Arquivos",
      counts: {
        pastas: counts.files_folders?.count ?? 0,
        itens: counts.files_items?.count ?? 0,
      },
    },
    {
      key: "relatorios",
      label: "Relatórios de Conclusão",
      counts: { relatorios: counts.completion_reports?.count ?? 0 },
    },
    {
      key: "empresas",
      label: "Empresas",
      counts: { empresas: counts.checklist_companies?.count ?? 0 },
    },
    {
      key: "workspaces",
      label: "Workspaces / Membros",
      counts: {
        workspaces: counts.workspaces?.count ?? 0,
        membros: counts.workspace_members?.count ?? 0,
        perfis: counts.profiles?.count ?? 0,
        papeis: counts.user_roles?.count ?? 0,
      },
    },
    {
      key: "crm_cal_notes",
      label: "CRM / Calendário / Notas",
      counts: {
        leads: counts.crm_leads?.count ?? 0,
        eventos: counts.calendar_events?.count ?? 0,
        notas: counts.notes?.count ?? 0,
        sticky: counts.sticky_notes?.count ?? 0,
      },
    },
    {
      key: "financas",
      label: "Finanças / Estoque",
      counts: {
        transacoes: counts.finance_transactions?.count ?? 0,
        produtos: counts.finance_products?.count ?? 0,
        custos: counts.finance_costs?.count ?? 0,
        estoque_itens: counts.stock_items?.count ?? 0,
        movimentacoes: counts.stock_movements?.count ?? 0,
      },
    },
    {
      key: "tendencias",
      label: "Painel de Tendências",
      counts: {
        sazonalidades: counts.trends_seasonalities?.count ?? 0,
        hype: counts.trends_hype?.count ?? 0,
        oportunidades: counts.trends_opportunities?.count ?? 0,
      },
    },
    {
      key: "compartilhados",
      label: "Compartilhamento cross-workspace",
      counts: {
        itens: counts.shared_items?.count ?? 0,
        comentarios: counts.shared_item_comments?.count ?? 0,
        atividades: counts.shared_item_activity?.count ?? 0,
      },
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    counts,
    modules,
    workspaces: workspacesOut,
    inconsistencies,
    permissions_note:
      "Rota pública read-only. Nenhum dado sensível (emails completos, tokens, chaves, conteúdo de arquivos) é exposto. Consultas usam service role apenas no servidor para agregar contagens.",
  };
});
