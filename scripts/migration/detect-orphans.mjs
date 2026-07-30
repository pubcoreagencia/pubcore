#!/usr/bin/env node
import { publicTables } from "./migration-config.mjs";
import { getDatabaseUrl, quoteIdent, relation, runPsql, writeJson } from "./lib.mjs";

const kind = process.argv[2];
const output = process.argv[3];

if (!["source", "target"].includes(kind)) {
  console.error("Usage: node scripts/migration/detect-orphans.mjs <source|target> [output.json]");
  process.exit(1);
}

const checks = [
  {
    name: "profiles_without_auth_user",
    sql: "select count(*)::bigint from public.profiles p left join auth.users u on u.id = p.id where u.id is null",
  },
  {
    name: "workspaces_without_owner",
    sql: "select count(*)::bigint from public.workspaces w left join auth.users u on u.id = w.owner_id where w.owner_id is not null and u.id is null",
  },
  {
    name: "workspace_members_without_workspace",
    sql: "select count(*)::bigint from public.workspace_members m left join public.workspaces w on w.id = m.workspace_id where w.id is null",
  },
  {
    name: "workspace_members_without_auth_user",
    sql: "select count(*)::bigint from public.workspace_members m left join auth.users u on u.id = m.user_id where u.id is null",
  },
  {
    name: "user_roles_without_auth_user",
    sql: "select count(*)::bigint from public.user_roles r left join auth.users u on u.id = r.user_id where u.id is null",
  },
  {
    name: "files_items_without_storage_object",
    sql: "select count(*)::bigint from public.files_items i left join storage.objects o on o.bucket_id = 'files' and o.name = i.storage_path where i.storage_path is not null and o.id is null",
  },
  {
    name: "disco_versions_without_storage_object",
    sql: "select count(*)::bigint from public.disco_versions v left join storage.objects o on o.bucket_id = 'files' and o.name = v.storage_path where v.storage_path is not null and o.id is null",
  },
  {
    name: "kanban_attachments_without_storage_object",
    sql: "select count(*)::bigint from public.kanban_attachments a left join storage.objects o on o.bucket_id = 'kanban-attachments' and o.name = a.storage_path where a.storage_path is not null and o.id is null",
  },
];

for (const item of publicTables) {
  const table = relation("public", item.table);
  if (item.sensitiveColumns.includes("workspace_id")) {
    checks.push({
      name: `${item.table}_without_workspace`,
      sql: `select count(*)::bigint from ${table} t left join public.workspaces w on w.id = t.workspace_id where t.workspace_id is not null and w.id is null`,
    });
  }
  for (const column of ["user_id", "created_by", "updated_by", "owner_id", "author_id", "shared_by_user_id"]) {
    if (item.sensitiveColumns.includes(column)) {
      checks.push({
        name: `${item.table}_${column}_without_auth_user`,
        sql: `select count(*)::bigint from ${table} t left join auth.users u on u.id = t.${quoteIdent(column)} where t.${quoteIdent(column)} is not null and u.id is null`,
      });
    }
  }
  for (const column of ["source_workspace_id", "target_workspace_id"]) {
    if (item.sensitiveColumns.includes(column)) {
      checks.push({
        name: `${item.table}_${column}_without_workspace`,
        sql: `select count(*)::bigint from ${table} t left join public.workspaces w on w.id = t.${quoteIdent(column)} where t.${quoteIdent(column)} is not null and w.id is null`,
      });
    }
  }
}

const unionSql = checks.map((check) => `select '${check.name}' as check_name, (${check.sql}) as orphan_count`).join("\nunion all\n");
const sql = `
with checks as (
${unionSql}
)
select coalesce(jsonb_agg(jsonb_build_object(
  'check', check_name,
  'count', orphan_count
) order by check_name), '[]'::jsonb)::text
from checks;
`;

const databaseUrl = getDatabaseUrl(kind);
const results = JSON.parse(runPsql(databaseUrl, sql));
const report = {
  kind,
  generatedAt: new Date().toISOString(),
  ok: results.every((item) => Number(item.count) === 0),
  results,
};

if (output) {
  const written = writeJson(output, report);
  console.log(`Wrote ${written}`);
} else {
  console.log(JSON.stringify(report, null, 2));
}

if (!report.ok) {
  process.exitCode = 2;
}

