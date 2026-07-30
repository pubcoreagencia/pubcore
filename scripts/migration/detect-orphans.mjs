#!/usr/bin/env node
import { publicTables } from "./migration-config.mjs";
import { getDatabaseUrl, quoteIdent, relation, runPsql, writeJson } from "./lib.mjs";

const kind = process.argv[2];
const defaultOutput = "reports/restored-local-orphans.json";
const output = process.argv[3] || defaultOutput;

if (!["source", "target"].includes(kind)) {
  console.error("Usage: node scripts/migration/detect-orphans.mjs <source|target> [output.json]");
  process.exit(1);
}

const databaseUrl = getDatabaseUrl(kind);

function reqTable(schema, table) {
  return { schema, table };
}

function reqColumn(schema, table, column) {
  return { schema, table, column };
}

function getCatalog() {
  const sql = `
select coalesce(jsonb_agg(jsonb_build_object(
  'schema', table_schema,
  'table', table_name,
  'column', column_name
) order by table_schema, table_name, ordinal_position), '[]'::jsonb)::text
from information_schema.columns
where table_schema in ('auth', 'public', 'storage');
`;
  const rows = JSON.parse(runPsql(databaseUrl, sql));
  const tables = new Set();
  const columns = new Set();

  for (const row of rows) {
    tables.add(`${row.schema}.${row.table}`);
    columns.add(`${row.schema}.${row.table}.${row.column}`);
  }

  return { tables, columns };
}

function hasRequirement(catalog, requirement) {
  const tableKey = `${requirement.schema}.${requirement.table}`;
  if (!catalog.tables.has(tableKey)) return false;
  if (!requirement.column) return true;
  return catalog.columns.has(`${tableKey}.${requirement.column}`);
}

function missingRequirements(catalog, requirements) {
  return requirements
    .filter((requirement) => !hasRequirement(catalog, requirement))
    .map((requirement) => requirement.column
      ? `${requirement.schema}.${requirement.table}.${requirement.column}`
      : `${requirement.schema}.${requirement.table}`);
}

function tableReqs(schema, table, columns = []) {
  return [
    reqTable(schema, table),
    ...columns.map((column) => reqColumn(schema, table, column)),
  ];
}

function authUserCheck({ name, table, column }) {
  const publicTable = relation("public", table);
  const columnIdent = quoteIdent(column);
  return {
    name,
    requirements: [
      ...tableReqs("public", table, [column]),
      ...tableReqs("auth", "users", ["id"]),
    ],
    sql: `select count(*)::bigint from ${publicTable} t left join auth.users u on u.id = t.${columnIdent} where t.${columnIdent} is not null and u.id is null`,
  };
}

function workspaceCheck({ name, table, column = "workspace_id" }) {
  const publicTable = relation("public", table);
  const columnIdent = quoteIdent(column);
  return {
    name,
    requirements: [
      ...tableReqs("public", table, [column]),
      ...tableReqs("public", "workspaces", ["id"]),
    ],
    sql: `select count(*)::bigint from ${publicTable} t left join public.workspaces w on w.id = t.${columnIdent} where t.${columnIdent} is not null and w.id is null`,
  };
}

const definedChecks = [
  {
    name: "profiles_without_auth_user",
    requirements: [
      ...tableReqs("public", "profiles", ["id"]),
      ...tableReqs("auth", "users", ["id"]),
    ],
    sql: "select count(*)::bigint from public.profiles p left join auth.users u on u.id = p.id where u.id is null",
  },
  authUserCheck({ name: "workspaces_owner_id_without_auth_user", table: "workspaces", column: "owner_id" }),
  workspaceCheck({ name: "workspace_members_without_workspace", table: "workspace_members" }),
  authUserCheck({ name: "workspace_members_user_id_without_auth_user", table: "workspace_members", column: "user_id" }),
  authUserCheck({ name: "user_roles_user_id_without_auth_user", table: "user_roles", column: "user_id" }),
  {
    name: "files_items_without_storage_object",
    requirements: [
      ...tableReqs("public", "files_items", ["storage_path"]),
      ...tableReqs("storage", "objects", ["id", "bucket_id", "name"]),
    ],
    sql: "select count(*)::bigint from public.files_items i left join storage.objects o on o.bucket_id = 'files' and o.name = i.storage_path where i.storage_path is not null and o.id is null",
  },
  {
    name: "disco_versions_without_storage_object",
    requirements: [
      ...tableReqs("public", "disco_versions", ["storage_path"]),
      ...tableReqs("storage", "objects", ["id", "bucket_id", "name"]),
    ],
    sql: "select count(*)::bigint from public.disco_versions v left join storage.objects o on o.bucket_id = 'files' and o.name = v.storage_path where v.storage_path is not null and o.id is null",
  },
  {
    name: "kanban_attachments_without_storage_object",
    requirements: [
      ...tableReqs("public", "kanban_attachments", ["storage_path"]),
      ...tableReqs("storage", "objects", ["id", "bucket_id", "name"]),
    ],
    sql: "select count(*)::bigint from public.kanban_attachments a left join storage.objects o on o.bucket_id = 'kanban-attachments' and o.name = a.storage_path where a.storage_path is not null and o.id is null",
  },
  {
    name: "ponto_session_edits_without_session",
    requirements: [
      ...tableReqs("public", "ponto_session_edits", ["session_id"]),
      ...tableReqs("public", "ponto_sessions", ["id"]),
    ],
    sql: "select count(*)::bigint from public.ponto_session_edits e left join public.ponto_sessions s on s.id = e.session_id where e.session_id is not null and s.id is null",
  },
  workspaceCheck({ name: "ponto_session_edits_without_workspace", table: "ponto_session_edits" }),
  authUserCheck({ name: "ponto_session_edits_edited_by_without_auth_user", table: "ponto_session_edits", column: "edited_by" }),
];

for (const item of publicTables) {
  if (item.table === "ponto_session_edits") continue;

  if (item.sensitiveColumns.includes("workspace_id")) {
    definedChecks.push(workspaceCheck({
      name: `${item.table}_workspace_id_without_workspace`,
      table: item.table,
    }));
  }

  for (const column of ["user_id", "created_by", "updated_by", "owner_id", "author_id", "shared_by_user_id", "edited_by"]) {
    if (item.sensitiveColumns.includes(column)) {
      definedChecks.push(authUserCheck({
        name: `${item.table}_${column}_without_auth_user`,
        table: item.table,
        column,
      }));
    }
  }

  for (const column of ["source_workspace_id", "target_workspace_id"]) {
    if (item.sensitiveColumns.includes(column)) {
      definedChecks.push(workspaceCheck({
        name: `${item.table}_${column}_without_workspace`,
        table: item.table,
        column,
      }));
    }
  }
}

const catalog = getCatalog();
const checked = [];
const skipped = [];
const orphanCounts = [];
const errors = [];

for (const check of definedChecks) {
  const missing = missingRequirements(catalog, check.requirements);
  if (missing.length > 0) {
    skipped.push({
      check: check.name,
      reason: "missing table or column",
      missing,
    });
    continue;
  }

  checked.push(check.name);

  try {
    const rawCount = runPsql(databaseUrl, check.sql);
    orphanCounts.push({
      check: check.name,
      count: Number(rawCount),
    });
  } catch (error) {
    errors.push({
      check: check.name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const report = {
  kind,
  generatedAt: new Date().toISOString(),
  ok: errors.length === 0 && orphanCounts.every((item) => Number(item.count) === 0),
  checked,
  skipped,
  orphanCounts,
  errors,
};

const written = writeJson(defaultOutput, report);
console.log(`Wrote ${written}`);
if (output !== defaultOutput) {
  const extraWritten = writeJson(output, report);
  console.log(`Wrote ${extraWritten}`);
}
console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exitCode = 2;
}
